/**
 * 讯飞错误码映射表
 */
const XFYUN_ERROR_MAP: Record<number, string> = {
    0: '成功',
    10105: '参数错误或鉴权失败',
    10109: '访问频率超限',
    10007: '服务不可用或超时',
    10800: '连接数超限，请等待后重试',
    11200: '音频格式不支持或数据异常',
    11201: '音频过短或静音',
    11202: '音频采样率不匹配（需16k单声道）',
    11203: '音频通道数不匹配（需单声道）',
    11204: '音频位深度不匹配（需16bit）',
    11401: '文本编码不支持或内容异常',
    11500: '服务端内部错误',
    11999: '内部错误，请稍后重试',
} as const;

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
    NETWORK = 'network',
    AUTHENTICATION = 'authentication',
    PARAMETER = 'parameter',
    AUDIO = 'audio',
    WEBSOCKET = 'websocket',
    UNKNOWN = 'unknown',
}

/**
 * 增强的错误信息接口
 */
export interface XfyunError {
    code: number;
    message: string;
    severity: ErrorSeverity;
    type: ErrorType;
    retryable: boolean;
    timestamp: number;
    context?: Record<string, any> | undefined;
}

/**
 * 映射讯飞错误码为友好的错误消息
 * 
 * @param code 错误码
 * @param message 原始错误消息
 * @returns 友好的错误消息
 */
export function mapXfyunError(code?: number, message?: string): string {
    // 如果没有错误码，返回原始消息或默认消息
    if (code === undefined || code === null) {
        return message || '未知错误';
    }
    
    // 成功状态
    if (code === 0) {
        return '成功';
    }
    
    // 查找映射的错误消息
    const mappedMessage = XFYUN_ERROR_MAP[code];
    if (mappedMessage) {
        return mappedMessage;
    }
    
    // 如果没有映射，返回原始消息或包含错误码的消息
    return message || `错误码：${code}`;
}

/**
 * 检查是否为可重试的错误
 * 
 * @param code 错误码
 * @returns 是否可重试
 */
export function isRetryableError(code?: number): boolean {
    if (code === undefined || code === null) return false;
    
    const retryableCodes = [10007, 10109, 10800, 11500, 11999];
    return retryableCodes.includes(code);
}

/**
 * 获取错误严重程度
 * 
 * @param code 错误码
 * @returns 错误严重程度
 */
export function getErrorSeverity(code?: number): ErrorSeverity {
    if (code === undefined || code === null) return ErrorSeverity.MEDIUM;
    
    const highSeverityCodes = [10105, 11200, 11201, 11202];
    const lowSeverityCodes = [10109, 10800];
    const criticalSeverityCodes = [11999];
    
    if (criticalSeverityCodes.includes(code)) return ErrorSeverity.CRITICAL;
    if (highSeverityCodes.includes(code)) return ErrorSeverity.HIGH;
    if (lowSeverityCodes.includes(code)) return ErrorSeverity.LOW;
    return ErrorSeverity.MEDIUM;
}

/**
 * 获取错误类型
 * 
 * @param code 错误码
 * @returns 错误类型
 */
export function getErrorType(code?: number): ErrorType {
    if (code === undefined || code === null) return ErrorType.UNKNOWN;
    
    const authCodes = [10105, 10109, 10800];
    const paramCodes = [11200, 11201, 11202, 11203, 11204, 11401];
    const networkCodes = [10007];
    
    if (authCodes.includes(code)) return ErrorType.AUTHENTICATION;
    if (paramCodes.includes(code)) return ErrorType.PARAMETER;
    if (networkCodes.includes(code)) return ErrorType.NETWORK;
    return ErrorType.UNKNOWN;
}

/**
 * 创建增强的错误对象
 * 
 * @param code 错误码
 * @param message 原始错误消息
 * @param context 错误上下文
 * @returns 增强的错误对象
 */
export function createXfyunError(
    code: number, 
    message?: string, 
    context?: Record<string, any>
): XfyunError {
    return {
        code,
        message: mapXfyunError(code, message),
        severity: getErrorSeverity(code),
        type: getErrorType(code),
        retryable: isRetryableError(code),
        timestamp: Date.now(),
        context,
    };
}

/**
 * 错误恢复策略
 */
export interface ErrorRecoveryStrategy {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxRetryDelay: number;
}

/**
 * 默认错误恢复策略
 */
export const DEFAULT_RECOVERY_STRATEGY: ErrorRecoveryStrategy = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxRetryDelay: 10000,
};

/**
 * 计算重试延迟
 * 
 * @param attempt 当前尝试次数
 * @param strategy 恢复策略
 * @returns 延迟时间（毫秒）
 */
export function calculateRetryDelay(
    attempt: number, 
    strategy: ErrorRecoveryStrategy = DEFAULT_RECOVERY_STRATEGY
): number {
    const delay = strategy.retryDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
    return Math.min(delay, strategy.maxRetryDelay);
}

/**
 * 生成可读的错误日志上下文
 */
export function formatErrorContext(ctx?: Record<string, any>): string {
    if (!ctx) return '';
    try {
        const safe: Record<string, any> = {};
        const keys = ['sid', 'type', 'code', 'message', 'lastEvent', 'wsReadyState'];
        for (const k of keys) if (ctx[k] !== undefined) safe[k] = ctx[k];
        return JSON.stringify(safe);
    } catch {
        return '';
    }
}


