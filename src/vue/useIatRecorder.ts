import {ref, shallowRef, onBeforeUnmount} from 'vue';
import type {Ref} from 'vue';
import {IatClient} from '../core/IatClient';
import {
    AUDIO_CONFIG,
    createScriptProcessor,
    getSharedAudioContext,
    calculateLevel,
    float32ToInt16
} from '../utils/audio';

/**
 * useIatRecorder 选项
 * - client: IatClient 实例（需外部创建与配置）
 * - vadThreshold: 本地音量阈值（0-100），用于电平显示（当前仅用于 UI 展示）
 * - frameMs: 发送帧长（毫秒），默认 40ms（即约 640 样本 @16kHz）
 */
export interface UseIatRecorderOptions {
    client: IatClient;
    vadThreshold?: number;
    frameMs?: number;
}

export interface UseIatRecorderResult {
    /** 是否正在录音 */ recording: Ref<boolean>;
    /** 电平（0-100），基于当前帧 RMS 估算 */ level: Ref<number>;
    /** 开始录音与推流（申请麦克风、建立处理图、必要时打开连接） */ start: () => Promise<void>;
    /** 停止录音与推流（发送结束帧、释放资源） */ stop: () => void;
}

/**
 * 基于浏览器麦克风的 IAT 录音组合式 API。
 * - 通过 ScriptProcessor 聚合帧，并以 16bit PCM 发送给 IatClient
 */
export function useIatRecorder(options: UseIatRecorderOptions): UseIatRecorderResult {
    const {client, vadThreshold = 3, frameMs = 40} = options;

    const recording = ref(false);
    const level = ref(0);

    const mediaStreamRef = shallowRef<MediaStream | null>(null);
    const audioCtxRef = shallowRef<AudioContext | null>(null);
    const processorRef = shallowRef<ScriptProcessorNode | null>(null);
    const bufferRef = shallowRef<Float32Array[]>([]);

    /**
     * 断开节点与停止轨道，释放资源
     */
    function cleanup(): void {
        try {
            processorRef.value && processorRef.value.disconnect();
        } catch {
        }
        // 不要断开共享AudioContext的destination，这会影响其他使用
        // try {
        //     audioCtxRef.value && audioCtxRef.value.destination.disconnect();
        // } catch {
        // }
        try {
            mediaStreamRef.value && mediaStreamRef.value.getTracks().forEach(t => t.stop());
        } catch {
        }
        processorRef.value = null;
        // 不清理共享AudioContext引用，由SDK管理
        // audioCtxRef.value = null;
        mediaStreamRef.value = null;
        bufferRef.value = [];
    }

    onBeforeUnmount(() => cleanup());

    /**
     * 开始录音与推流
     * - 获取用户媒体（单声道，期望 16kHz）
     * - 创建共享 AudioContext 与 ScriptProcessor
     * - 聚合 frameMs 时长的样本为一帧，转换 Int16 后发送
     */
    async function start(): Promise<void> {
        if (recording.value) return;
        // 申请麦克风权限（仅音频）
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {channelCount: 1, sampleRate: 16000},
            video: false
        });
        mediaStreamRef.value = stream;
        // 统一使用共享 AudioContext，内部已处理重复创建
        const audioCtx = getSharedAudioContext(AUDIO_CONFIG.DEFAULT_SAMPLE_RATE);
        audioCtxRef.value = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream); // 输入源：麦克风轨
        const processor = createScriptProcessor(audioCtx, (data) => {
            // 1) 计算电平用于 UI 显示
            level.value = calculateLevel(data);
            // 2) 追加本帧到缓冲
            bufferRef.value!.push(new Float32Array(data));
            // 3) 当累积样本数 ≥ 期望帧长（samples）时，聚合并发送
            const needSamples = Math.floor((AUDIO_CONFIG.DEFAULT_SAMPLE_RATE * (frameMs / 1000)));
            let total = 0;
            for (const buf of bufferRef.value!) total += buf.length;
            if (total >= needSamples) {
                const merged = new Float32Array(total);
                let off = 0;
                for (const buf of bufferRef.value!) {
                    merged.set(buf, off);
                    off += buf.length;
                }
                bufferRef.value = [];
                const cut = merged.subarray(0, needSamples);
                const int16 = float32ToInt16(cut); // Float32 → Int16 PCM（小端）
                client.sendFrame(int16, false); // 发送非最后一帧
            }
        });
        processorRef.value = processor;
        source.connect(processor); // 将音源接入处理器
        processor.connect(audioCtx.destination); // 挂到输出节点以确保回调被触发
        if (client.status !== 'open') await client.open(); // 必要时建立 WS 连接
        recording.value = true;
    }

    /**
     * 停止推流并发送结束帧
     */
    function stop(): void {
        if (!recording.value) return;
        try {
            client.sendFrame(new Int16Array(0), true);
        } catch {
        }
        cleanup();
        recording.value = false;
    }

    return {recording, level, start, stop};
}


