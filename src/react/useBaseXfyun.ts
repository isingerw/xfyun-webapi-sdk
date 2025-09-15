import { useEffect, useRef, useState } from "react";
import { BaseXfyunClient, BaseXfyunClientOptions } from "../core/BaseXfyunClient";

/**
 * 基础Hook状态类型
 */
export type BaseHookStatus = "idle" | "connecting" | "open" | "closing" | "closed" | "error";

/**
 * 基础Hook选项
 */
export interface BaseHookOptions extends BaseXfyunClientOptions {
    /** 是否自动清理资源 */
    autoCleanup?: boolean;
}

/**
 * 基础讯飞Hook
 * 
 * 提供所有讯飞Hook的通用功能：
 * - 统一的状态管理
 * - 统一的错误处理
 * - 统一的资源清理
 * 
 * @template T 具体的客户端类型
 * @template O 具体的选项类型
 */
export function useBaseXfyun<T extends BaseXfyunClient<O>, O extends BaseHookOptions = BaseHookOptions>(
    createClient: (options?: O) => T,
    options?: O
) {
    const [status, setStatus] = useState<BaseHookStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const clientRef = useRef<T | null>(null);

    /**
     * 确保客户端实例存在
     */
    function ensureClient(): T {
        if (!clientRef.current) {
            const client = createClient(options);
            clientRef.current = client;
        }
        return clientRef.current;
    }


    /**
     * 重置状态
     */
    function reset(): void {
        setError(null);
        setStatus("idle");
        ensureClient().reset();
    }

    /**
     * 关闭客户端
     */
    function close(): void {
        if (clientRef.current) {
            clientRef.current.close();
        }
    }

    // 自动清理资源
    useEffect(() => {
        if (options?.autoCleanup !== false) {
            return () => {
                close();
            };
        }
        return undefined;
    }, []);

    // 当核心配置变更时，重建底层客户端实例
    useEffect(() => {
        clientRef.current = null;
    }, [options?.serverBase, options?.getAuthCode]);

    return {
        status,
        error,
        reset,
        close,
        ensureClient,
        clientRef,
    };
}
