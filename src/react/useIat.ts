import { useEffect } from "react";
import { IatClient, IatClientOptions, IatBusiness } from "../core/IatClient";
import { BaseXfyunClientOptions } from "../core/BaseXfyunClient";
import { ErrorRecoveryStrategy } from "../utils/errorMap";
import { AudioFramePayload } from "../utils/audio";
import { useBaseXfyun } from "./useBaseXfyun";

/**
 * IAT Hook选项
 */
export interface IatOptions extends BaseXfyunClientOptions {
    /** IAT业务参数配置 */
    business?: IatBusiness;
    /** 识别增量文本回调 */
    onResult?: (text: string, isFinal: boolean) => void;
    /** 原始消息回调（调试用） */
    onMessage?: (msg: any) => void;
    /** 连接打开回调（包含 sid） */
    onOpen?: (sid?: string) => void;
    /** 连接关闭回调 */
    onClose?: (code?: number, reason?: string) => void;
    /** 心跳间隔（毫秒），0表示禁用 */
    heartbeatMs?: number;
    /** 最大重试次数（默认3） */
    maxRetries?: number;
    /** 重连退避策略（可选，不传使用默认） */
    retryStrategy?: ErrorRecoveryStrategy;
}

/**
 * 科大讯飞语音听写(IAT) Hook
 * 
 * 支持实时语音转文字功能，特点：
 * - WebSocket实时连接
 * - 支持动态修正
 * - 支持增量识别结果
 * - 自动断句处理
 * 
 * 使用示例：
 * ```typescript
 * const { status, error, open, sendFrame, close, reset } = useIat({
 *   serverBase: 'http://localhost:8083',
 *   business: { language: 'zh_cn', vad_eos: 2000 },
 *   onResult: (text, isFinal) => console.log(text, isFinal)
 * });
 * 
 * await open();
 * sendFrame(audioData, false);
 * ```
 */
export function useIat(options?: IatOptions) {
    const { status, error, reset, close, ensureClient } = useBaseXfyun(
        (opts) => new IatClient({
            ...opts,
            onResult: (text, isFinal) => options?.onResult?.(text, isFinal),
            onMessage: (msg) => options?.onMessage?.(msg),
            onOpen: (sid) => options?.onOpen?.(sid),
            onClose: (code, reason) => options?.onClose?.(code, reason),
            onError: (message, sid) => options?.onError?.(message, sid),
            heartbeatMs: options?.heartbeatMs,
            maxRetries: options?.maxRetries,
            retryStrategy: options?.retryStrategy,
        } as IatClientOptions),
        options
    );

    /**
     * 建立IAT WebSocket连接并发送首帧
     * 
     * @throws Error 连接失败时抛出异常
     */
    async function open(): Promise<void> {
        const client = ensureClient();
        await client.open();
    }

    /**
     * 发送音频帧
     * 
     * @param frame 音频帧数据
     * @param isLast 是否为最后一帧
     */
    function sendFrame(frame: AudioFramePayload, isLast: boolean): void {
        const client = ensureClient();
        client.sendFrame(frame, isLast);
    }

    // 当业务参数变更时，重建客户端实例
    useEffect(() => {
        ensureClient();
    }, [JSON.stringify(options?.business)]);

    return {
        status,
        error,
        open,
        sendFrame,
        close,
        reset
    };
}


