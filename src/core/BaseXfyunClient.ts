import { mapXfyunError, formatErrorContext } from "../utils/errorMap";

/**
 * 讯飞客户端基础配置接口
 */
export interface BaseXfyunClientOptions {
    /** 后端服务基础地址 */
    serverBase?: string;
    /** 获取认证码的方法 */
    getAuthCode?: () => string;
    /** 错误回调 */
    onError?: (message: string, sid?: string) => void;
    /** 统一日志回调（可用于上报） */
    onLog?: (level: 'info' | 'warn' | 'error', payload: Record<string, any>) => void;
}

/**
 * 讯飞客户端基础类
 *
 * 提供所有讯飞客户端的通用功能：
 * - 统一的错误处理
 * - 统一的签名获取
 * - 统一的状态管理
 *
 * @template T 具体的客户端选项类型
 */
export abstract class BaseXfyunClient<T extends BaseXfyunClientOptions = BaseXfyunClientOptions> {
    protected readonly serverBase: string;
    protected readonly options: T;
    public error: string | null = null;
    protected lastContext: Record<string, any> | null = null;
    protected sessionId: string = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    constructor(options?: T) {
        this.options = options || ({} as T);
        this.serverBase = this.options.serverBase || "";
    }

    /**
     * 获取签名信息
     *
     * @param type 签名类型 (iat|tts|rtasr|dts/create|dts/query)
     * @returns 签名响应数据
     * @throws Error 获取签名失败时抛出异常
     */
    protected async getSignature(type: string): Promise<any> {
        try {
            const auth = this.options.getAuthCode?.() || "";
            const response = await fetch(`${this.serverBase}/api/v1/xfyun/sign/${type}`, {
                headers: { Authorization: `Bearer ${auth}` }
            });

            if (!response.ok) {
                throw new Error(`获取${type}签名失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errorCode !== 0) {
                throw new Error(`获取${type}签名失败: ${result.message || '未知错误'}`);
            }

            return result.data;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : `获取${type}签名失败`;
            this.handleError(errorMessage);
            throw error;
        }
    }

    /**
     * 统一错误处理
     *
     * @param message 错误消息
     * @param sid 会话ID（可选）
     */
    protected handleError(message: string, sid?: string, context?: Record<string, any>): void {
        this.error = message;
        this.lastContext = { ...(context || {}), sid, message };
        try {
            const summary = formatErrorContext(this.lastContext);
            if (summary) console.error('[XFYUN] ErrorContext:', summary);
            this.options.onLog?.('error', {
                sessionId: this.sessionId,
                timestamp: Date.now(),
                message,
                ...this.lastContext,
            });
        } catch {}
        this.options.onError?.(message, sid);
    }

    /**
     * 处理讯飞API错误码
     *
     * @param code 错误码
     * @param message 原始错误消息
     * @param sid 会话ID（可选）
     * @returns 处理后的错误消息
     */
    protected processXfyunError(code?: number, message?: string, sid?: string, extra?: Record<string, any>): string {
        const errorMessage = mapXfyunError(code, message);
        this.handleError(errorMessage, sid, { code, ...extra });
        return errorMessage;
    }

    /**
     * 重置客户端状态
     */
    public reset(): void {
        this.error = null;
        this.lastContext = null;
        this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    }

    /**
     * 关闭客户端连接
     *
     * 子类可以重写此方法来实现具体的关闭逻辑
     */
    public close(): void {
        // 默认实现为空，子类可以重写
        this.reset();
    }

}
