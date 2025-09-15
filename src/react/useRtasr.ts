import { useEffect } from "react";
import { RtasrClient, RtasrClientOptions, RtasrBusiness } from "../core/RtasrClient";
import { BaseXfyunClientOptions } from "../core/BaseXfyunClient";
import { ErrorRecoveryStrategy } from "../utils/errorMap";
import { useBaseXfyun } from "./useBaseXfyun";
import { getRtasrConnectionPool } from "../core/RtasrConnectionPool";

/**
 * RTASR Hook选项
 */
export interface RtasrOptions extends BaseXfyunClientOptions {
    /** RTASR业务参数配置 */
    business?: RtasrBusiness;
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
 * 科大讯飞实时语音转写(RTASR) Hook
 * 
 * 支持长时间语音转文字功能，特点：
 * - WebSocket实时连接
 * - 支持连续音频流识别
 * - 自动重连机制
 * - 支持动态修正
 * 
 * 使用示例：
 * ```typescript
 * const { status, error, open, sendFrame, close, reset } = useRtasr({
 *   serverBase: 'http://localhost:8083',
 *   business: { language: 'zh_cn', domain: 'rtasr' },
 *   onResult: (text, isFinal) => console.log(text, isFinal)
 * });
 * 
 * await open();
 * sendFrame(audioData, false);
 * ```
 */
export function useRtasr(options?: RtasrOptions) {
    const { status, error, reset, close: baseClose, ensureClient, clientRef } = useBaseXfyun(
        (opts) => new RtasrClient({
            ...opts,
            onResult: (text, isFinal) => options?.onResult?.(text, isFinal),
            onMessage: (msg) => options?.onMessage?.(msg),
            onOpen: (sid) => options?.onOpen?.(sid),
            onClose: (code, reason) => options?.onClose?.(code, reason),
            onError: (message, sid) => options?.onError?.(message, sid),
            heartbeatMs: options?.heartbeatMs,
            maxRetries: options?.maxRetries,
            retryStrategy: options?.retryStrategy,
        } as RtasrClientOptions),
        options
    );

    /**
     * 建立RTASR WebSocket连接并发送首帧
     * 
     * @throws Error 连接失败时抛出异常
     */
    async function open(): Promise<void> {
        try {
            // 使用连接池获取连接
            const pool = getRtasrConnectionPool();
            const client = await pool.getConnection(options || {});
            
            // 更新客户端引用
            clientRef.current = client;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 发送音频帧
     * 
     * @param frame 音频帧数据
     * @param isLast 是否为最后一帧
     */
    function sendFrame(frame: ArrayBuffer, isLast: boolean): void {
        const client = ensureClient();
        client.sendFrame(frame, isLast);
    }

    /**
     * 关闭连接
     */
    function close(): void {
        if (clientRef.current && options) {
            const pool = getRtasrConnectionPool();
            pool.closeConnection(options);
        }
        clientRef.current = null;
        baseClose();
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
        reset,
        client: clientRef.current
    };
}


