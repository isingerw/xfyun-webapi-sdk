/**
 * IAT（在线语音听写）Vue 组合式 API
 *
 * 用法示例：
 * const { open, sendFrame, close } = useIat({ serverBase, getAuthCode, business: {...}, maxRetries: 3 });
 * await open();
 * sendFrame(buffer, false);
 * sendFrame(new ArrayBuffer(0), true);
 */
import { useBaseXfyun } from './useBaseXfyun';
import { IatClient, type IatClientOptions, type IatBusiness } from '../core/IatClient';
import type { BaseXfyunClientOptions } from '../core/BaseXfyunClient';
import type { ErrorRecoveryStrategy } from '../utils/errorMap';
import type { AudioFramePayload } from '../utils/audio';

/**
 * IAT Hook 选项
 * - business: 业务参数（仅发送显式设置项，默认 domain=iat）
 * - onResult: 文本回调（isFinal 标记最终结果）
 * - onMessage/onOpen/onClose/onError: 生命周期回调
 * - heartbeatMs: 心跳间隔（毫秒），0 表示禁用
 * - maxRetries/retryStrategy: 断线重连次数与退避策略
 * - enableLangCheck: 启用语言/口音与 URL 域名的匹配提示
 */
export interface IatOptions extends BaseXfyunClientOptions {
    business?: IatBusiness;
    onResult?: (text: string, isFinal: boolean) => void;
    onMessage?: (msg: any) => void;
    onOpen?: (sid?: string) => void;
    onClose?: (code?: number, reason?: string) => void;
    heartbeatMs?: number;
    /** 最大重试次数（默认3） */
    maxRetries?: number;
    /** 重连退避策略 */
    retryStrategy?: ErrorRecoveryStrategy;
    /** 语言/口音校验提示（前端提示，不影响调用） */
    enableLangCheck?: boolean;
}

export interface UseIatResult {
    status: import('vue').Ref<import('./useBaseXfyun').BaseHookStatus>;
    error: import('vue').Ref<string | null>;
    open: () => Promise<void>;
    sendFrame: (frame: AudioFramePayload, isLast: boolean) => void;
    close: () => void;
    reset: () => void;
}

/**
 * 创建并管理 IAT 客户端实例。
 * @param options IatOptions
 * @returns UseIatResult
 */
export function useIat(options?: IatOptions): UseIatResult {
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
            enableLangCheck: options?.enableLangCheck,
        } as IatClientOptions),
        options as any
    );

    async function open(): Promise<void> {
        const client = ensureClient();
        await client.open();
    }

    function sendFrame(frame: AudioFramePayload, isLast: boolean): void {
        const client = ensureClient();
        client.sendFrame(frame, isLast);
    }

    return { status, error, open, sendFrame, close, reset };
}


