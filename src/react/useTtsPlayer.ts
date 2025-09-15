import { useCallback, useEffect, useRef, useState } from 'react';
import { TtsClient } from '../core/TtsClient';

/**
 * useTtsPlayer 选项
 * - client: TtsClient 实例
 */
export interface UseTtsPlayerOptions {
    client: TtsClient;
}

/**
 * TTS 播放控制 Hook。
 * - 封装 speak/pause/resume/stop 控制
 * - 暴露播放状态与音量电平 level（0-100）
 */
export function useTtsPlayer({ client }: UseTtsPlayerOptions) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'playing' | 'closed' | 'error'>('idle');
    const [level, setLevel] = useState(0);

    useEffect(() => {
        // 订阅音量电平回调
        const onLevel = (lv: number) => setLevel(lv);
        const orig = (client as any).onAudio;
        (client as any).onLevel = onLevel;
        return () => { (client as any).onLevel = undefined; (client as any).onAudio = orig; };
    }, [client]);

    useEffect(() => {
        // 轮询同步客户端状态
        const id = setInterval(() => setStatus(client.status as any), 100);
        return () => clearInterval(id);
    }, [client]);

    /**
     * 触发合成与播放。如果尚未连接，将在内部建立连接。
     */
    const speak = useCallback(async (text: string) => {
        await client.speak(text);
        setStatus(client.status as any);
    }, [client]);

    /** 暂停播放 */
    const pause = useCallback(() => client.pause(), [client]);
    /** 恢复播放 */
    const resume = useCallback(() => client.resume(), [client]);
    /** 停止播放并清空队列 */
    const stop = useCallback(() => client.stop(), [client]);

    return { status, level, speak, pause, resume, stop, requestAutoplay: () => client.requestAutoplay() };
}


