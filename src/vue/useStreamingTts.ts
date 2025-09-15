import {computed, type ComputedRef, onUnmounted, type Ref, ref} from 'vue';
import {StreamingTtsClient, StreamingTtsOptions} from '../core/StreamingTtsClient';

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
    status: Ref<'idle' | 'connecting' | 'open' | 'synthesizing' | 'playing' | 'paused' | 'closed' | 'error'>;
    isConnected: ComputedRef<boolean>;
    isPlaying: ComputedRef<boolean>;
    error: Ref<string | null>;

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
    currentText: Ref<string>;
    totalTextLength: Ref<number>;
}

/**
 * Vue Composable：流式语音合成
 * - 负责实例化 `StreamingTtsClient` 并通过事件驱动 Vue 响应式状态
 * - 暴露便捷控制方法与本地音量控制
 * @param options 组合式函数配置，可覆盖客户端选项并接收 Hook 级别回调
 * @returns 组合式函数返回的状态、控制方法与文本统计
 */
export function useStreamingTts(options?: UseStreamingTtsOptions): UseStreamingTtsResult {
    const clientRef = ref<StreamingTtsClient | null>(null);
    const status = ref<'idle' | 'connecting' | 'open' | 'synthesizing' | 'playing' | 'paused' | 'closed' | 'error'>('idle');
    const error = ref<string | null>(null);
    const currentText = ref('');
    const totalTextLength = ref(0);

    // 计算属性：避免直接存连通状态，按客户端推断
    const isConnected = computed(() => {
        const client = clientRef.value;
        return client ? client.isConnected() : false;
    });

    const isPlaying = computed(() => {
        const client = clientRef.value;
        return client ? client.isPlaying() : false;
    });

    // 单例化客户端并桥接回调 → Vue 状态
    const ensureClient = () => {
        if (!clientRef.value) {
            clientRef.value = new StreamingTtsClient({
                ...options,
                business: options?.business || { aue: 'raw', vcn: 'x4_yezi', speed: 50, volume: 50, pitch: 50, tte: 'utf8', auf: 'audio/L16;rate=16000' },
                onTextReceived: (text) => {
                    currentText.value += text;
                    totalTextLength.value += text.length;
                    options?.onTextReceived?.(text);
                },
                onAudioReceived: (audio) => {
                    options?.onAudioReceived?.(audio);
                },
                onPlaying: (playing) => {
                    options?.onPlaying?.(playing);
                },
                onComplete: () => {
                    status.value = 'closed';
                    options?.onComplete?.();
                },
                onError: (err) => {
                    error.value = err;
                    status.value = 'error';
                    options?.onError?.(err);
                },
                onLog: (level, payload) => {
                    options?.onLog?.(level, payload);
                },
                onOpen: () => {
                    status.value = 'open';
                },
                onClose: () => {
                    status.value = 'closed';
                },
                onStatusChange: (s) => {
                    status.value = s;
                }
            });
        }
        return clientRef.value;
    };

    /** 开始流式合成：重置状态并调用客户端 start */
    const start = async () => {
        try {
            error.value = null;
            currentText.value = '';
            totalTextLength.value = 0;

            const client = ensureClient();
            await client.start();
            status.value = client.getStatus();
        } catch (err) {
            error.value = err instanceof Error ? err.message : '启动流式TTS失败';
            status.value = 'error';
            throw err;
        }
    };

    /** 追加文本（分片） */
    const appendText = (text: string) => {
        const client = clientRef.value;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.appendText(text);
    };

    /** 结束文本输入 */
    const endText = () => {
        const client = clientRef.value;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.endText();
    };

    /** 暂停播放 */
    const pause = () => {
        const client = clientRef.value;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.pause();
    };

    /** 恢复播放 */
    const resume = () => {
        const client = clientRef.value;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.resume();
    };

    /** 停止合成并复位状态 */
    const stop = () => {
        const client = clientRef.value;
        if (client) {
            client.stop();
            status.value = 'idle';
            currentText.value = '';
            totalTextLength.value = 0;
        }
    };

    /** 关闭连接并释放资源 */
    const close = () => {
        const client = clientRef.value;
        if (client) {
            client.close();
            clientRef.value = null;
            status.value = 'idle';
            currentText.value = '';
            totalTextLength.value = 0;
        }
    };

    /** 设置本地音量（0..1） */
    const setLocalVolume = (v: number) => {
        const client = clientRef.value;
        if (!client) {
            throw new Error('StreamingTtsClient not initialized');
        }
        client.setLocalVolume(v);
    };

    // 组件卸载：兜底关闭连接
    onUnmounted(() => {
        const client = clientRef.value;
        if (client) {
            client.close();
        }
    });

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
