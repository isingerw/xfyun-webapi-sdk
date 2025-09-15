/**
 * 通用 Base Hook（Vue 版本）
 *
 * 职责：
 * - 统一管理 SDK 客户端实例生命周期
 * - 提供状态/错误/关闭/重置 等通用方法
 * - 使用 shallowRef + markRaw 避免实例被 Vue 深代理
 */
import { ref, shallowRef, markRaw, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import type { BaseXfyunClient, BaseXfyunClientOptions } from '../core/BaseXfyunClient';

export type BaseHookStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';

export interface BaseHookOptions extends BaseXfyunClientOptions {
    autoCleanup?: boolean;
}

// 最小化 Ref 外部可见类型，避免 UnwrapRef 推断带来不兼容
export type XfyunClientRef<T> = { value: T | null };

export function useBaseXfyun<T extends BaseXfyunClient<O>, O extends BaseHookOptions = BaseHookOptions>(
    createClient: (options?: O) => T,
    options?: O
) : {
    status: Ref<BaseHookStatus>;
    error: Ref<string | null>;
    reset: () => void;
    close: () => void;
    ensureClient: () => T;
    clientRef: XfyunClientRef<T>;
} {
    const status = ref<BaseHookStatus>('idle');
    const error = ref<string | null>(null);
    const clientRef = shallowRef<T | null>(null);

    function ensureClient(): T {
        if (!clientRef.value) {
            const client = createClient(options);
            // 避免被 Vue 深层 proxy 影响类型与实例方法
            clientRef.value = markRaw(client) as T;
        }
        return clientRef.value as T;
    }

    function reset(): void {
        error.value = null;
        status.value = 'idle';
        // 强制重新创建客户端实例，确保使用最新的options
        if (clientRef.value) {
            clientRef.value.close();
            clientRef.value = null;
        }
        ensureClient().reset();
    }

    function close(): void {
        if (clientRef.value) {
            clientRef.value.close();
        }
    }

    // 自动清理（Vue2+@vue/composition-api / Vue3 均可）
    if (options?.autoCleanup !== false) {
        onBeforeUnmount(() => close());
    }

    return {
        status,
        error,
        reset,
        close,
        ensureClient,
        clientRef: clientRef as unknown as XfyunClientRef<T>,
    };
}


