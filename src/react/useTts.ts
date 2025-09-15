import { useEffect, useRef } from "react";
import { TtsClient, TtsClientOptions, TtsBusiness } from "../core/TtsClient";
import { BaseXfyunClientOptions } from "../core/BaseXfyunClient";
import { getSharedAudioContext } from "../utils/audio";
import { useBaseXfyun } from "./useBaseXfyun";

/**
 * TTS Hook选项
 */
export interface TtsOptions extends BaseXfyunClientOptions {
    /** TTS业务参数配置 */
    business?: TtsBusiness;
    /** 音量电平回调（0-100） */
    onLevel?: (level: number) => void;
    /** MP3音频块回调 */
    onMp3Chunk?: (bytes: Uint8Array) => void;
    /** 合成完成回调 */
    onComplete?: () => void;
}

/**
 * 科大讯飞语音合成(TTS) Hook
 * 
 * 支持文字转语音功能，特点：
 * - WebSocket实时连接
 * - 支持多种音频格式（PCM/MP3）
 * - 实时音频播放
 * - 音量电平监控
 * 
 * 使用示例：
 * ```typescript
 * const { status, error, speak, stop } = useTts({
 *   serverBase: 'http://localhost:8083',
 *   business: { aue: 'raw', vcn: 'x4_yezi', speed: 50 },
 *   onLevel: (level) => console.log('音量:', level)
 * });
 * 
 * await speak('你好世界');
 * ```
 */
export function useTts(options?: TtsOptions) {
    // 创建一个动态参数获取函数
    const getCurrentOptions = () => ({
        ...options,
        business: options?.business
    });

    const { status, error, reset, close, ensureClient, clientRef } = useBaseXfyun(
        (opts) => {
            const currentOptions = getCurrentOptions();
            return new TtsClient({
                ...opts,
                // 动态获取最新的业务参数
                business: currentOptions.business,
                onLevel: (level) => currentOptions.onLevel?.(level),
                onMp3Chunk: (bytes) => currentOptions.onMp3Chunk?.(bytes),
                onComplete: () => currentOptions.onComplete?.(),
            } as TtsClientOptions);
        },
        options
    );

    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const pcmQueueRef = useRef<Float32Array[]>([]);
    const processingRef = useRef<boolean>(false);

    /**
     * 播放PCM音频队列
     */
    async function playPcmQueue(): Promise<void> {
        if (processingRef.current) return;
        processingRef.current = true;
        
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = getSharedAudioContext(16000);
            }
            
            const ctx = audioCtxRef.current;
            
            // 改进：顺序播放音频块，避免重叠和回声
            let currentTime = ctx.currentTime;
            while (pcmQueueRef.current.length) {
                const floatData = pcmQueueRef.current.shift()!;
                const audioBuffer = ctx.createBuffer(1, floatData.length, 16000);
                const channelData = audioBuffer.getChannelData(0);
                channelData.set(floatData);
                
                const src = ctx.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx.destination);
                
                // 确保连续播放，避免重叠
                const startTime = Math.max(currentTime, ctx.currentTime + 0.01);
                src.start(startTime);
                
                // 更新下次播放时间
                currentTime = startTime + audioBuffer.duration;
                sourceRef.current = src;
                
                // 等待当前音频块播放完成再播放下一个
                await new Promise<void>((resolve) => {
                    src.onended = () => resolve();
                });
            }
        } finally {
            processingRef.current = false;
        }
    }

    /**
     * 发起TTS合成并实时播放
     * 
     * @param text 待合成的文本
     * @throws Error 合成失败时抛出异常
     */
    async function speak(text: string): Promise<void> {
        // 每次speak时重新创建客户端，确保使用最新的参数
        const client = ensureClient();
        
        // 获取最新的选项参数
        const currentOptions = getCurrentOptions();
        
        // 清空之前的音频队列，避免重叠播放
        pcmQueueRef.current = [];
        
        // 设置音频处理回调
        client.onAudio = (bytes) => {
            const samples = Math.floor(bytes.byteLength / 2);
            const float32 = new Float32Array(samples);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < samples; i++) {
                float32[i] = view.getInt16(i * 2, true) / 0x8000;
            }
            pcmQueueRef.current.push(float32);
            playPcmQueue();
        };
        
        await client.speak(text);
    }

    /**
     * 停止播放并清空缓存
     */
    function stop(): void {
        if (clientRef.current) {
            clientRef.current.close();
        }
        sourceRef.current?.stop();
        pcmQueueRef.current = [];
    }

    /**
     * 强制重新创建客户端（用于参数更新）
     */
    function forceRecreate(): void {
        if (clientRef.current) {
            (clientRef.current as any).forceRecreate?.();
        }
        pcmQueueRef.current = [];
        // 强制重新创建客户端实例，确保使用最新参数
        reset();
    }

    // 当业务参数变更时，重建客户端实例
    useEffect(() => {
        ensureClient();
    }, [JSON.stringify(options?.business)]);

    return {
        status,
        error,
        speak,
        stop,
        forceRecreate
    };
}


