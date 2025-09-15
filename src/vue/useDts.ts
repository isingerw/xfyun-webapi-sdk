/**
 * DTS（长文本语音合成）Vue 组合式 API
 *
 * 支持创建任务、查询任务与等待完成三种方式获取结果。
 */
import { ref } from 'vue';
import { useBaseXfyun } from './useBaseXfyun';
import { DtsClient, type DtsClientOptions, type DtsBusiness } from '../core/DtsClient';
import type { BaseXfyunClientOptions } from '../core/BaseXfyunClient';

export interface DtsOptions extends BaseXfyunClientOptions {
    business?: DtsBusiness;
    onTaskCreated?: (taskId: string) => void;
    onTaskCompleted?: (result: any) => void;
    /** 轮询任务状态的超时时间（毫秒） */
    pollTimeoutMs?: number;
    /** 轮询任务状态的最大次数 */
    maxPollTimes?: number;
}

export type DtsStatus = 'idle' | 'creating' | 'querying' | 'completed' | 'error';

export interface UseDtsResult {
    status: import('vue').Ref<import('./useBaseXfyun').BaseHookStatus>;
    error: import('vue').Ref<string | null>;
    taskId: import('vue').Ref<string | null>;
    result: import('vue').Ref<any>;
    createTask: (text: string, business?: DtsBusiness) => Promise<string>;
    queryTask: (taskId: string) => Promise<any>;
    waitForTask: (taskId: string, intervalMs?: number) => Promise<any>;
    reset: () => void;
    downloadResult: (taskId: string, format?: 'mp3' | 'wav') => Promise<Blob>;
}

export function useDts(options?: DtsOptions): UseDtsResult {
    const { status: baseStatus, error, reset, ensureClient } = useBaseXfyun(
        (opts) => new DtsClient({
            ...opts,
            onTaskCreated: (taskId) => {
                taskIdRef.value = taskId;
                options?.onTaskCreated?.(taskId);
            },
            onTaskCompleted: (result) => {
                resultRef.value = result;
                options?.onTaskCompleted?.(result);
            },
            pollTimeoutMs: options?.pollTimeoutMs,
            maxPollTimes: options?.maxPollTimes,
        } as DtsClientOptions),
        options as any
    );

    const taskIdRef = ref<string | null>(null);
    const resultRef = ref<any>(null);
    const status = baseStatus; // 简化：沿用基础状态

    async function createTask(text: string, business?: DtsBusiness): Promise<string> {
        const client = ensureClient();
        const taskId = await client.createTask(text, business);
        taskIdRef.value = taskId;
        return taskId;
    }

    async function queryTask(taskId: string): Promise<any> {
        const client = ensureClient();
        const r = await client.queryTask(taskId);
        if (r?.status === 4) resultRef.value = r;
        return r;
    }

    async function waitForTask(taskId: string, intervalMs: number = 2000): Promise<any> {
        const client = ensureClient();
        const r = await client.waitForTask(taskId, intervalMs);
        resultRef.value = r;
        return r;
    }

    async function downloadResult(taskId: string, format: 'mp3' | 'wav' = 'mp3'): Promise<Blob> {
        const client = ensureClient();
        const blob = await client.downloadResult(taskId, format);
        if (!blob) {
            throw new Error('下载结果为空，可能任务尚未完成或链接已过期');
        }
        return blob;
    }

    function resetDts(): void {
        reset();
        taskIdRef.value = null;
        resultRef.value = null;
    }

    return { status, error, taskId: taskIdRef, result: resultRef, createTask, queryTask, waitForTask, reset: resetDts, downloadResult };
}


