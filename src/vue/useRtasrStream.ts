import { ref, shallowRef, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import { RtasrClient } from '../core/RtasrClient';
import { AUDIO_CONFIG, createScriptProcessor, getSharedAudioContext, float32ToInt16, releaseSharedAudioContext } from '../utils/audio';

export interface UseRtasrStreamOptions {
    /** 已配置的 RTASR 客户端实例 */ client: RtasrClient;
    /** 帧长（毫秒），默认 40ms */ frameMs?: number;
}

export interface UseRtasrStreamResult {
    /** 是否正在推流 */ streaming: Ref<boolean>;
    /** 开始推流（申请麦克风、建立图、必要时打开连接） */ start: () => Promise<void>;
    /** 停止推流（发送结束帧并释放资源） */ stop: () => void;
}

/**
 * 使用浏览器麦克风流向 RTASR 发送音频数据（Vue 组合式 API）
 */
export function useRtasrStream(options: UseRtasrStreamOptions): UseRtasrStreamResult {
    const { client, frameMs = 40 } = options;
    const streaming = ref(false);
    const mediaStreamRef = shallowRef<MediaStream | null>(null);
    const audioCtxRef = shallowRef<AudioContext | null>(null);
    const processorRef = shallowRef<ScriptProcessorNode | null>(null);
    const bufferRef = shallowRef<Float32Array[]>([]);

    /** 断开节点与停止轨道，释放资源 */
    function cleanup(): void {
        try { 
            if (processorRef.value) {
                processorRef.value.disconnect();
                processorRef.value = null;
            }
        } catch (e) {
            console.warn('断开ScriptProcessor时出错:', e);
        }
        
        try { 
            if (mediaStreamRef.value) {
                mediaStreamRef.value.getTracks().forEach(t => t.stop());
                mediaStreamRef.value = null;
            }
        } catch (e) {
            console.warn('停止媒体轨道时出错:', e);
        }
        
        // 不直接关闭AudioContext，而是释放引用
        try {
            if (audioCtxRef.value) {
                // 使用引用计数管理，避免重复关闭
                releaseSharedAudioContext();
                audioCtxRef.value = null;
            }
        } catch (e) {
            console.warn('释放AudioContext时出错:', e);
        }
        
        bufferRef.value = [];
    }

    onBeforeUnmount(() => cleanup());

    /** 开始采集并推送到 RTASR */
    async function start(): Promise<void> {
        if (streaming.value) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 }, video: false });
        mediaStreamRef.value = stream;
        const audioCtx = getSharedAudioContext(AUDIO_CONFIG.DEFAULT_SAMPLE_RATE);
        audioCtxRef.value = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = createScriptProcessor(audioCtx, (data) => {
            // 累积原始采样到缓冲
            bufferRef.value!.push(new Float32Array(data));
            const needSamples = Math.floor((AUDIO_CONFIG.DEFAULT_SAMPLE_RATE * (frameMs / 1000)));
            let total = 0;
            for (const buf of bufferRef.value!) total += buf.length;
            if (total >= needSamples) {
                const merged = new Float32Array(total);
                let off = 0;
                for (const buf of bufferRef.value!) { merged.set(buf, off); off += buf.length; }
                bufferRef.value = [];
                const cut = merged.subarray(0, needSamples);
                const int16 = float32ToInt16(cut);
                // 显式拷贝为 ArrayBuffer，规避 SharedArrayBuffer 兼容性
                const ab = new Uint8Array(int16.buffer.slice(0)).buffer as ArrayBuffer;
                client.sendFrame(ab, false);
            }
        });
        processorRef.value = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination); // 连接到输出，确保处理回调被触发
        if (client.status !== 'open') await client.open();
        streaming.value = true;
    }

    /** 停止推流，发送结束帧并释放资源 */
    function stop(): void {
        if (!streaming.value) return;
        try { client.sendFrame(new ArrayBuffer(0), true); } catch {}
        cleanup();
        streaming.value = false;
    }

    return { streaming, start, stop };
}


