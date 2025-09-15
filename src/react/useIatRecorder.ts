import { useCallback, useEffect, useRef, useState } from 'react';
import { IatClient } from '../core/IatClient';
import { AUDIO_CONFIG, createScriptProcessor, getSharedAudioContext, calculateLevel, float32ToInt16 } from '../utils/audio';

/**
 * useIatRecorder 选项
 * - client: IatClient 实例（需外部创建与配置）
 * - vadThreshold: 本地音量阈值（0-100），用于粗略静音门限显示/控制
 * - frameMs: 发送给服务端的帧长（毫秒），默认 40ms（约 640 samples @16kHz）
 */
export interface UseIatRecorderOptions {
    client: IatClient;
    vadThreshold?: number; // 0-100, 静音阈值（保留参数，当前用于电平显示）
    frameMs?: number; // 帧长，默认40ms
}

/**
 * 基于浏览器麦克风的 IAT 录音 Hook。
 * - 内部通过 WebAudio 的 ScriptProcessor 聚合帧，并以 16bit PCM 发送给 IatClient
 * - 提供 recording/level 状态与 start/stop 控制方法
 */
export function useIatRecorder(options: UseIatRecorderOptions) {
    const { client, vadThreshold = 3, frameMs = 40 } = options;
    const [recording, setRecording] = useState(false);
    const [level, setLevel] = useState(0);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const bufferRef = useRef<Float32Array[]>([]);
    const lastSendTimeRef = useRef<number>(0);

    // 清理 WebAudio 节点与麦克风流，防止资源泄漏
    const cleanup = useCallback(() => {
        try { processorRef.current && processorRef.current.disconnect(); } catch {}
        try { audioCtxRef.current && audioCtxRef.current.destination.disconnect(); } catch {}
        try { mediaStreamRef.current && mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        processorRef.current = null;
        audioCtxRef.current = null;
        mediaStreamRef.current = null;
        bufferRef.current = [];
    }, []);

    useEffect(() => () => { cleanup(); }, [cleanup]);

    /**
     * 开始录音并建立 IAT 连接
     * - 申请麦克风权限，创建 AudioContext 与 ScriptProcessor
     * - 按 frameMs 聚合样本并转换为 Int16 发送
     */
    const start = useCallback(async () => {
        if (recording) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 }, video: false });
        mediaStreamRef.current = stream;
        const audioCtx = getSharedAudioContext(AUDIO_CONFIG.DEFAULT_SAMPLE_RATE); // 统一的共享 AudioContext
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = createScriptProcessor(audioCtx, (data) => {
            // 计算声级用于 UI 显示（0-100）
            setLevel(calculateLevel(data));
            // push 原始采样至缓冲
            bufferRef.current.push(new Float32Array(data));
            const now = Date.now();
            const needBytes = Math.floor((AUDIO_CONFIG.DEFAULT_SAMPLE_RATE * (frameMs / 1000)) /* samples */);
            // 尝试聚合足够样本后发送一帧
            let total = 0;
            for (const buf of bufferRef.current) total += buf.length;
            if (total >= needBytes) {
                const merged = new Float32Array(total);
                let off = 0;
                for (const buf of bufferRef.current) { merged.set(buf, off); off += buf.length; }
                bufferRef.current = [];
                const cut = merged.subarray(0, needBytes);
                const int16 = float32ToInt16(cut); // Float32 -> Int16 PCM
                client.sendFrame(int16, false); // 发送非最后一帧
                lastSendTimeRef.current = now;
            }
        });
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination); // 挂到输出，部分浏览器需要连接到 destination 才会回调
        if (client.status !== 'open') await client.open();
        setRecording(true);
    }, [client, frameMs, recording]);

    /**
     * 停止录音并发送结束帧
     */
    const stop = useCallback(() => {
        if (!recording) return;
        try { client.sendFrame(new Int16Array(0), true); } catch {}
        cleanup();
        setRecording(false);
    }, [client, cleanup, recording]);

    return { recording, level, start, stop };
}


