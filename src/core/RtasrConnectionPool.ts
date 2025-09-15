import { RtasrClient, RtasrClientOptions } from './RtasrClient';

/**
 * RTASR连接池管理器
 * 
 * 提供连接复用和管理功能，支持多次调用
 */
export class RtasrConnectionPool {
    private static instance: RtasrConnectionPool | null = null;
    private connections: Map<string, RtasrClient> = new Map();
    private connectionOptions: Map<string, RtasrClientOptions> = new Map();

    private constructor() {}

    /**
     * 获取单例实例
     */
    static getInstance(): RtasrConnectionPool {
        if (!RtasrConnectionPool.instance) {
            RtasrConnectionPool.instance = new RtasrConnectionPool();
        }
        return RtasrConnectionPool.instance;
    }

    /**
     * 生成连接键
     */
    private generateKey(options: RtasrClientOptions): string {
        const business = options.business || {};
        return JSON.stringify({
            serverBase: options.serverBase,
            language: business.language || 'zh_cn',
            accent: business.accent || 'mandarin',
            domain: business.domain || 'rtasr'
        });
    }

    /**
     * 获取或创建连接
     */
    async getConnection(options: RtasrClientOptions): Promise<RtasrClient> {
        const key = this.generateKey(options);
        
        // 检查是否已有可用连接
        let client = this.connections.get(key);
        if (client && client.status === 'open') {
            return client;
        }

        // 清理无效连接
        if (client && (client.status === 'closed' || client.status === 'closing')) {
            this.connections.delete(key);
            this.connectionOptions.delete(key);
        }

        // 创建新连接
        client = new RtasrClient(options);
        this.connections.set(key, client);
        this.connectionOptions.set(key, options);

        try {
            await client.open();
            return client;
        } catch (error) {
            // 连接失败时清理
            this.connections.delete(key);
            this.connectionOptions.delete(key);
            
            // 提供更详细的错误信息
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            throw new Error(`RTASR连接失败: ${errorMessage}。请检查网络连接和服务端状态。`);
        }
    }

    /**
     * 关闭指定连接
     */
    closeConnection(options: RtasrClientOptions): void {
        const key = this.generateKey(options);
        const client = this.connections.get(key);
        
        if (client) {
            client.close();
            this.connections.delete(key);
            this.connectionOptions.delete(key);
        }
    }

    /**
     * 关闭所有连接
     */
    closeAllConnections(): void {
        for (const [key, client] of this.connections) {
            try {
                client.close();
            } catch (e) {
                console.warn(`关闭连接 ${key} 时出错:`, e);
            }
        }
        this.connections.clear();
        this.connectionOptions.clear();
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(options: RtasrClientOptions): 'none' | 'connecting' | 'open' | 'closed' | 'closing' | 'idle' {
        const key = this.generateKey(options);
        const client = this.connections.get(key);
        
        if (!client) {
            return 'none';
        }
        
        return client.status;
    }

    /**
     * 获取连接数量
     */
    getConnectionCount(): number {
        return this.connections.size;
    }

    /**
     * 清理无效连接
     */
    cleanupInvalidConnections(): void {
        for (const [key, client] of this.connections) {
            if (client.status === 'closed' || client.status === 'closing') {
                this.connections.delete(key);
                this.connectionOptions.delete(key);
            }
        }
    }
}

/**
 * 获取RTASR连接池实例
 */
export function getRtasrConnectionPool(): RtasrConnectionPool {
    return RtasrConnectionPool.getInstance();
}
