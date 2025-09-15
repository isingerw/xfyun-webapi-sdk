/**
 * TTS（在线语音合成）Vue 组合式 API
 *
 * - 提供实时 PCM 播放与 MP3 透传回调
 * - 支持 autoplay（手势恢复）与 onLevel 音量电平
 */
import { ref } from 'vue';
import { useBaseXfyun } from './useBaseXfyun';
import { TtsClient, type TtsClientOptions, type TtsBusiness } from '../core/TtsClient';
import type { BaseXfyunClientOptions } from '../core/BaseXfyunClient';
import { getSharedAudioContext } from '../utils/audio';

export interface TtsOptions extends BaseXfyunClientOptions {
    business?: TtsBusiness;
    onLevel?: (level: number) => void;
    onMp3Chunk?: (bytes: Uint8Array) => void;
    onComplete?: () => void;
    /** 是否启用自动播放策略（移动端建议配合用户手势） */
    autoplay?: boolean;
    /** 是否启用 MP3 播放透传（默认 PCM 内部播放） */
    mp3Playback?: boolean;
}

export interface UseTtsResult {
    status: import('vue').Ref<import('./useBaseXfyun').BaseHookStatus>;
    error: import('vue').Ref<string | null>;
    speak: (text: string) => Promise<void>;
    stop: () => void;
    forceRecreate: () => void;
}

export function useTts(options?: TtsOptions): UseTtsResult {
    const { status, error, reset, close, ensureClient, clientRef } = useBaseXfyun(
        (opts) => new TtsClient({
            ...opts,
            onLevel: (level) => options?.onLevel?.(level),
            onMp3Chunk: (bytes) => options?.onMp3Chunk?.(bytes),
            onComplete: () => options?.onComplete?.(),
            autoplayGesture: options?.autoplay,
        } as TtsClientOptions),
        options as any
    );

    const audioCtxRef = ref<AudioContext | null>(null);
    const pcmQueueRef = ref<Float32Array[]>([]);
    const processingRef = ref<boolean>(false);

    async function playPcmQueue(): Promise<void> {
        if (processingRef.value) return;
        processingRef.value = true;
        try {
            if (!audioCtxRef.value) {
                audioCtxRef.value = getSharedAudioContext(16000);
            }
            const ctx = audioCtxRef.value;
            
            // 改进：顺序播放音频块，避免重叠和回声
            while (pcmQueueRef.value.length) {
                const floatData = pcmQueueRef.value.shift()!;
                const audioBuffer = ctx!.createBuffer(1, floatData.length, 16000);
                audioBuffer.getChannelData(0).set(floatData);
                const src = ctx!.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx!.destination);
                
                // 确保连续播放，避免重叠
                const startTime = Math.max(ctx!.currentTime + 0.01, 0);
                src.start(startTime);
                
                // 等待当前音频块播放完成再播放下一个
                await new Promise<void>((resolve) => {
                    src.onended = () => resolve();
                });
            }
        } finally {
            processingRef.value = false;
        }
    }

    async function speak(text: string): Promise<void> {
        const client = ensureClient();
        
        // 始终设置onAudio回调来处理音频数据，但根据autoplay设置决定是否播放
        client.onAudio = (bytes) => {
            const samples = Math.floor(bytes.byteLength / 2);
            const float32 = new Float32Array(samples);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < samples; i++) {
                float32[i] = view.getInt16(i * 2, true) / 0x8000;
            }
            
            // 只有在autoplay为true时才进行内置播放
            if (options?.autoplay === true) {
                pcmQueueRef.value.push(float32);
                void playPcmQueue();
            }
        };
        
        await client.speak(text);
    }

    /**
     * 停止合成播放并清理队列
     */
    function stop(): void {
        if (clientRef.value) clientRef.value.close();
        pcmQueueRef.value = [];
    }

    /**
     * 强制重新创建客户端（用于参数更新）
     */
    function forceRecreate(): void {
        if (clientRef.value) {
            (clientRef.value as any).forceRecreate?.();
        }
        pcmQueueRef.value = [];
    }

    return { status, error, speak, stop, forceRecreate };
}


