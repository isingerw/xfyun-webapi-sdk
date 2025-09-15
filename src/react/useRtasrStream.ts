import { useCallback, useEffect, useRef, useState } from 'react';
import { RtasrClient } from '../core/RtasrClient';
import { AUDIO_CONFIG, createScriptProcessor, getSharedAudioContext, float32ToInt16, releaseSharedAudioContext } from '../utils/audio';

/**
 * useRtasrStream 选项
 * - client: RtasrClient 实例
 * - frameMs: 帧长（毫秒），默认 40ms
 */
export interface UseRtasrStreamOptions {
    client: RtasrClient;
    frameMs?: number; // 默认40ms
}

/**
 * 使用浏览器麦克风流向 RTASR 发送音频数据的 Hook。
 * - 内部以 ScriptProcessor 聚合帧并转换为 Int16 PCM，通过 WebSocket 发送
 * - 提供 streaming 状态与 start/stop 控制
 */
export function useRtasrStream(options: UseRtasrStreamOptions) {
    const { client, frameMs = 40 } = options;
    const [streaming, setStreaming] = useState(false);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const bufferRef = useRef<Float32Array[]>([]);

    // 释放资源，断开节点与停止轨道
    const cleanup = useCallback(() => {
        try { 
            if (processorRef.current) {
                processorRef.current.disconnect();
                processorRef.current = null;
            }
        } catch (e) {
            console.warn('断开ScriptProcessor时出错:', e);
        }
        
        try { 
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
            }
        } catch (e) {
            console.warn('停止媒体轨道时出错:', e);
        }
        
        // 不直接关闭AudioContext，而是释放引用
        try {
            if (audioCtxRef.current) {
                // 使用引用计数管理，避免重复关闭
                releaseSharedAudioContext();
                audioCtxRef.current = null;
            }
        } catch (e) {
            console.warn('释放AudioContext时出错:', e);
        }
        
        bufferRef.current = [];
    }, []);

    useEffect(() => () => { cleanup(); }, [cleanup]);

    /**
     * 开始采集与推流
     */
    const start = useCallback(async () => {
        if (streaming) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 }, video: false });
        mediaStreamRef.current = stream;
        const audioCtx = getSharedAudioContext(AUDIO_CONFIG.DEFAULT_SAMPLE_RATE);
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = createScriptProcessor(audioCtx, (data) => {
            bufferRef.current.push(new Float32Array(data));
            const needBytes = Math.floor((AUDIO_CONFIG.DEFAULT_SAMPLE_RATE * (frameMs / 1000)) /* samples */);
            let total = 0;
            for (const buf of bufferRef.current) total += buf.length;
            if (total >= needBytes) {
                const merged = new Float32Array(total);
                let off = 0;
                for (const buf of bufferRef.current) { merged.set(buf, off); off += buf.length; }
                bufferRef.current = [];
                const cut = merged.subarray(0, needBytes);
                const int16 = float32ToInt16(cut);
                // 显式拷贝为 ArrayBuffer，规避 SharedArrayBuffer 等兼容性
                const ab = new Uint8Array(int16.buffer.slice(0)).buffer as ArrayBuffer;
                client.sendFrame(ab, false);
            }
        });
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination); // 连接到输出，确保音频处理回调被触发
        if (client.status !== 'open') await client.open();
        setStreaming(true);
    }, [client, frameMs, streaming]);

    /**
     * 停止推流，发送结束帧
     */
    const stop = useCallback(() => {
        if (!streaming) return;
        try { client.sendFrame(new ArrayBuffer(0), true); } catch {}
        cleanup();
        setStreaming(false);
    }, [client, cleanup, streaming]);

    return { streaming, start, stop };
}


