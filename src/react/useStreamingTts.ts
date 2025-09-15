import { useRef, useCallback, useEffect, useState } from 'react';
import { StreamingTtsClient, StreamingTtsOptions } from '../core/StreamingTtsClient';

/**
 * useStreamingTts 选项
 * 继承底层客户端选项（屏蔽底层回调以便由 Hook 转发）。
 */
export interface UseStreamingTtsOptions extends Omit<StreamingTtsOptions, 'onTextReceived' | 'onAudioReceived' | 'onPlaying' | 'onComplete' | 'onError' | 'onLog'> {
    onTextReceived?: (text: string) => void;
    onAudioReceived?: (audio: Uint8Array) => void;
    onPlaying?: (isPlaying: boolean) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
    onLog?: (level: 'info' | 'warn' | 'error', payload: any) => void;
}

/**
 * useStreamingTts 返回结果
 */
export interface UseStreamingTtsResult {
    // 状态
    status: 'idle' | 'connecting' | 'open' | 'synthesizing' | 'playing' | 'paused' | 'closed' | 'error';
    isConnected: boolean;
    isPlaying: boolean;
    error: string | null;

    // 控制方法
    start: () => Promise<void>;
    appendText: (text: string) => void;
    endText: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    close: () => void;
    setLocalVolume: (v: number) => void;

    // 文本管理
    currentText: string;
    totalTextLength: number;
}

/**
 * React Hook：流式语音合成
 * - 负责实例化 `StreamingTtsClient` 并通过回调事件驱动 React 状态
 * - 暴露便捷控制方法与本地音量控制
 * @param options Hook 配置，可覆盖客户端选项并接收 Hook 级别回调
 * @returns Hook 返回的状态、控制方法与文本统计
 */
export function useStreamingTts(options?: UseStreamingTtsOptions): UseStreamingTtsResult {
    const clientRef = useRef<StreamingTtsClient | null>(null);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'synthesizing' | 'playing' | 'paused' | 'closed' | 'error'>('idle');
    const [isConnected, setIsConnected] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentText, setCurrentText] = useState('');
    const [totalTextLength, setTotalTextLength] = useState(0);

    // 单例化客户端并桥接回调 → React 状态
    const ensureClient = useCallback(() => {
        if (!clientRef.current) {
            clientRef.current = new StreamingTtsClient({
                ...options,
                business: options?.business || { aue: 'raw', vcn: 'x4_yezi', speed: 50, volume: 50, pitch: 50, tte: 'utf8', auf: 'audio/L16;rate=16000' },
                onTextReceived: (text) => {
                    setCurrentText(prev => prev + text);
                    setTotalTextLength(prev => prev + text.length);
                    options?.onTextReceived?.(text);
                },
                onAudioReceived: (audio) => {
                    options?.onAudioReceived?.(audio);
                },
                onPlaying: (playing) => {
                    setIsPlaying(playing);
                    options?.onPlaying?.(playing);
                },
                onComplete: () => {
                    setStatus('closed');
                    setIsPlaying(false);
                    options?.onComplete?.();
                },
                onError: (err) => {
                    setError(err);
                    setStatus('error');
                    options?.onError?.(err);
                },
                onLog: (level, payload) => {
                    options?.onLog?.(level, payload);
                },
                onOpen: () => {
                    setIsConnected(true);
                    setStatus('open');
                },
                onClose: () => {
                    setIsConnected(false);
                    setStatus('closed');
                },
                onStatusChange: (s) => {
                    setStatus(s);
                    setIsConnected(s === 'open' || s === 'synthesizing' || s === 'playing' || s === 'paused');
                }
            });
        }
        return clientRef.current;
    }, [options]);

    /** 开始流式合成：重置 Hook 状态并调用客户端 start */
    const start = useCallback(async () => {
        try {
            setError(null);
            setCurrentText('');
            setTotalTextLength(0);

            const client = ensureClient();
            await client.start();
            setStatus(client.getStatus());
            setIsConnected(client.isConnected());
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '启动流式TTS失败';
            setError(errorMsg);
            setStatus('error');
            throw err;
        }
    }, [ensureClient]);

    /** 追加文本（分片） */
    const appendText = useCallback((text: string) => {
        const client = clientRef.current;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.appendText(text);
    }, []);

    /** 结束文本输入 */
    const endText = useCallback(() => {
        const client = clientRef.current;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.endText();
    }, []);

    /** 暂停播放 */
    const pause = useCallback(() => {
        const client = clientRef.current;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.pause();
    }, []);

    /** 恢复播放 */
    const resume = useCallback(() => {
        const client = clientRef.current;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.resume();
    }, []);

    /** 停止合成并复位 Hook 状态 */
    const stop = useCallback(() => {
        const client = clientRef.current;
        if (client) {
            client.stop();
            setStatus('idle');
            setIsConnected(false);
            setIsPlaying(false);
            setCurrentText('');
            setTotalTextLength(0);
        }
    }, []);

    /** 关闭连接并释放资源 */
    const close = useCallback(() => {
        const client = clientRef.current;
        if (client) {
            client.close();
            clientRef.current = null;
            setStatus('idle');
            setIsConnected(false);
            setIsPlaying(false);
            setCurrentText('');
            setTotalTextLength(0);
        }
    }, []);

    /** 设置本地音量（0..1） */
    const setLocalVolume = useCallback((v: number) => {
        const client = clientRef.current;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.setLocalVolume(v);
    }, []);

    // 组件卸载时确保关闭连接
    useEffect(() => {
        return () => {
            const client = clientRef.current;
            if (client) {
                client.close();
            }
        };
    }, []);

    return {
        status,
        isConnected,
        isPlaying,
        error,
        start,
        appendText,
        endText,
        pause,
        resume,
        stop,
        close,
        setLocalVolume,
        currentText,
        totalTextLength
    };
}
