/**
 * RTASR（实时语音转写）Vue 组合式 API
 *
 * 注意：
 * - 握手成功（action:'started'）后，SDK 才会发送二进制音频帧
 * - 结束时仅发送一次 { end: true } 文本消息
 * - 支持 maxRetries/retryStrategy 进行断线重连
 */
import { useBaseXfyun } from './useBaseXfyun';
import { RtasrClient, type RtasrClientOptions, type RtasrBusiness } from '../core/RtasrClient';
import type { BaseXfyunClientOptions } from '../core/BaseXfyunClient';
import type { ErrorRecoveryStrategy } from '../utils/errorMap';
import { getRtasrConnectionPool } from '../core/RtasrConnectionPool';

export interface RtasrOptions extends BaseXfyunClientOptions {
    business?: RtasrBusiness;
    onResult?: (text: string, isFinal: boolean) => void;
    onMessage?: (msg: any) => void;
    onOpen?: (sid?: string) => void;
    onClose?: (code?: number, reason?: string) => void;
    heartbeatMs?: number;
    /** 最大重试次数（默认3） */
    maxRetries?: number;
    /** 重连退避策略 */
    retryStrategy?: ErrorRecoveryStrategy;
}

export interface UseRtasrResult {
    status: import('vue').Ref<import('./useBaseXfyun').BaseHookStatus>;
    error: import('vue').Ref<string | null>;
    open: () => Promise<void>;
    sendFrame: (frame: ArrayBuffer, isLast: boolean) => void;
    close: () => void;
    reset: () => void;
    client: any;
}

/**
 * 创建并管理 RTASR 客户端实例。
 */
export function useRtasr(options?: RtasrOptions): UseRtasrResult {
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
        options as any
    );

    async function open(): Promise<void> {
        try {
            status.value = "connecting";
            
            // 使用连接池获取连接
            const pool = getRtasrConnectionPool();
            const client = await pool.getConnection(options || {});
            
            // 更新客户端引用
            clientRef.value = client;
            status.value = client.status;
        } catch (err) {
            status.value = "error";
            error.value = err instanceof Error ? err.message : "连接失败";
            throw err;
        }
    }

    function sendFrame(frame: ArrayBuffer, isLast: boolean): void {
        const client = ensureClient();
        client.sendFrame(frame, isLast);
    }

    function close(): void {
        if (clientRef.value && options) {
            const pool = getRtasrConnectionPool();
            pool.closeConnection(options);
        }
        clientRef.value = null;
        status.value = "closed";
        baseClose();
    }

    return { status, error, open, sendFrame, close, reset, client: clientRef.value };
}


