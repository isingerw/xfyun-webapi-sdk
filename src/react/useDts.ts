import { useEffect, useState } from "react";
import { DtsClient, DtsClientOptions, DtsBusiness } from "../core/DtsClient";
import { BaseXfyunClientOptions } from "../core/BaseXfyunClient";
import { useBaseXfyun } from "./useBaseXfyun";

/**
 * DTS Hook选项
 */
export interface DtsOptions extends DtsClientOptions {
    // 继承 DtsClientOptions 的所有属性
}

/**
 * DTS Hook状态类型
 */
export type DtsStatus = "idle" | "creating" | "querying" | "completed" | "error";

/**
 * 科大讯飞长文本语音合成(DTS) Hook
 *
 * 支持长文本语音合成功能，特点：
 * - HTTP API调用
 * - 支持10万字左右的长文本
 * - 异步任务处理
 * - 任务状态查询
 *
 * 使用示例：
 * ```typescript
 * const { status, error, taskId, result, createTask, waitForTask } = useDts({
 *   serverBase: 'http://localhost:8083',
 *   business: { aue: 'raw', vcn: 'x4_mingge', speed: 50 },
 *   onTaskCreated: (taskId) => console.log('任务ID:', taskId)
 * });
 *
 * const taskId = await createTask('很长的文本...');
 * const result = await waitForTask(taskId);
 * ```
 */
export function useDts(options?: DtsOptions) {
    const { status: baseStatus, error, reset, ensureClient } = useBaseXfyun<DtsClient, DtsClientOptions>(
        (opts) => new DtsClient({
            serverBase: opts?.serverBase || '',
            getAuthCode: opts?.getAuthCode || (() => ''),
            ...opts,
            onTaskCreated: (taskId) => {
                setTaskId(taskId);
                options?.onTaskCreated?.(taskId);
            },
            onTaskCompleted: (result) => {
                setResult(result);
                options?.onTaskCompleted?.(result);
            },
        }),
        options
    );

    const [taskId, setTaskId] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    // 转换基础状态为DTS状态
    const status: DtsStatus = baseStatus === "open" ? "idle" : baseStatus as DtsStatus;

    /**
     * 创建DTS任务
     *
     * @param text 待合成的文本
     * @param business 业务参数（可选）
     * @returns 任务ID
     * @throws Error 创建失败时抛出异常
     */
    async function createTask(text: string, business?: DtsBusiness): Promise<string> {
        const client = ensureClient();
        const taskId = await client.createTask(text, business);
        setTaskId(taskId);
        return taskId;
    }

    /**
     * 查询DTS任务状态
     *
     * @param taskId 任务ID
     * @returns 任务状态数据
     * @throws Error 查询失败时抛出异常
     */
    async function queryTask(taskId: string): Promise<any> {
        const client = ensureClient();
        const result = await client.queryTask(taskId);
        if (result.status === 4) {
            setResult(result);
        }
        return result;
    }

    /**
     * 轮询查询任务直到完成
     *
     * @param taskId 任务ID
     * @param intervalMs 轮询间隔（毫秒），默认2000
     * @returns 任务完成后的结果数据
     * @throws Error 任务失败或查询异常时抛出异常
     */
    async function waitForTask(taskId: string, intervalMs: number = 2000): Promise<any> {
        const client = ensureClient();
        const result = await client.waitForTask(taskId, intervalMs);
        setResult(result);
        return result;
    }

    /**
     * 重置Hook状态
     */
    function resetDts(): void {
        reset();
        setTaskId(null);
        setResult(null);
    }

    // 当业务参数变更时，重建客户端实例
    useEffect(() => {
        ensureClient();
    }, [JSON.stringify(options?.business)]);

    return {
        status,
        error,
        taskId,
        result,
        createTask,
        queryTask,
        waitForTask,
        reset: resetDts
    };
}
