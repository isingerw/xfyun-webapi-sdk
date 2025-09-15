import { BaseXfyunClient, BaseXfyunClientOptions } from "./BaseXfyunClient";

/**
 * DTS发音人配置
 */
export const DTS_VOICES = {
  // 中文发音人
  'x4_yeting': { name: '希涵', gender: '女', language: '中文/普通话', style: '游戏影视解说' },
  'x4_guanyijie': { name: '关山-专题', gender: '男', language: '中文/普通话', style: '专题片纪录片' },
  'x4_pengfei': { name: '小鹏', gender: '男', language: '中文/普通话', style: '新闻播报' },
  'x4_qianxue': { name: '千雪', gender: '女', language: '中文/普通话', style: '阅读听书' },
  'x4_lingbosong': { name: '聆伯松-老年男声', gender: '男', language: '中文/普通话', style: '阅读听书' },
  'x4_xiuying': { name: '秀英-老年女声', gender: '女', language: '中文/普通话', style: '阅读听书' },
  'x4_mingge': { name: '明哥', gender: '男', language: '中文/普通话', style: '阅读听书' },
  'x4_doudou': { name: '豆豆', gender: '男', language: '中文/男童', style: '阅读听书' },
  'x4_lingxiaoshan_profnews': { name: '聆小珊', gender: '女', language: '中文/普通话', style: '新闻播报' },
  'x4_xiaoguo': { name: '小果', gender: '女', language: '中文/普通话', style: '新闻播报' },
  'x4_xiaozhong': { name: '小忠', gender: '男', language: '中文/普通话', style: '新闻播报' },
  'x4_yezi': { name: '小露', gender: '女', language: '中文/普通话', style: '通用场景' },
  'x4_chaoge': { name: '超哥', gender: '男', language: '中文/普通话', style: '新闻播报' },
  'x4_feidie': { name: '飞碟哥', gender: '男', language: '中文/普通话', style: '游戏影视解说' },
  'x4_lingfeihao_upbeatads': { name: '聆飞皓-广告', gender: '男', language: '中文/普通话', style: '直播广告' },
  'x4_wangqianqian': { name: '嘉欣', gender: '女', language: '中文/普通话', style: '直播广告' },
  'x4_lingxiaozhen_eclives': { name: '聆小臻', gender: '女', language: '中文/普通话', style: '直播广告' },
  // 其他发音人
  'x4_EnUs_Catherine_profnews': { name: 'Catherine', gender: '女', language: '英语', style: '专业新闻' },
  'x5_lingfeizhe': { name: '灵飞哲', gender: '男', language: '中文/普通话', style: '通用场景' },
  'x5_lingxiaoxue': { name: '灵小雪', gender: '女', language: '中文/普通话', style: '通用场景' },
  'x4_lingfeihong_document': { name: '聆飞红-文档', gender: '女', language: '中文/普通话', style: '文档阅读' },
  'x4_lingfeichen_assist': { name: '聆飞晨-助手', gender: '男', language: '中文/普通话', style: '智能助手' },
  'x4_lingxiaoqi_assist': { name: '聆小七-助手', gender: '女', language: '中文/普通话', style: '智能助手' },
  'x4_lingfeihong_document_n': { name: '聆飞红-文档N', gender: '女', language: '中文/普通话', style: '文档阅读' }
} as const;

/**
 * DTS业务参数配置
 */
export interface DtsBusiness {
    /** 音频编码，默认 "raw" */
    aue?: string;
    /** 发音人，默认 "x4_mingge" */
    vcn?: 'x4_yeting' | 'x4_guanyijie' | 'x4_pengfei' | 'x4_qianxue' | 'x4_lingbosong' | 'x4_xiuying' | 'x4_mingge' | 'x4_doudou' | 'x4_lingxiaoshan_profnews' | 'x4_xiaoguo' | 'x4_xiaozhong' | 'x4_yezi' | 'x4_chaoge' | 'x4_feidie' | 'x4_lingfeihao_upbeatads' | 'x4_wangqianqian' | 'x4_lingxiaozhen_eclives' | 'x4_EnUs_Catherine_profnews' | 'x5_lingfeizhe' | 'x5_lingxiaoxue' | 'x4_lingfeihong_document' | 'x4_lingfeichen_assist' | 'x4_lingxiaoqi_assist' | 'x4_lingfeihong_document_n';
    /** 语速（0-100），默认 50 */
    speed?: number;
    /** 音量（0-100），默认 50 */
    volume?: number;
    /** 音调（0-100），默认 50 */
    pitch?: number;
    /** 背景音（0-100），默认 0 */
    bgs?: number;
    /** 文本处理类型，默认 0 */
    ttp?: number;
}

/**
 * DTS客户端选项
 */
export interface DtsClientOptions extends BaseXfyunClientOptions {
    /** 后端服务基础地址（必需） */
    serverBase: string;
    /** 获取认证码的方法（必需） */
    getAuthCode: () => string;
    /** DTS业务参数配置 */
    business?: DtsBusiness;
    /** 任务创建回调 */
    onTaskCreated?: (taskId: string) => void;
    /** 任务完成回调 */
    onTaskCompleted?: (result: any) => void;
    /** 任务轮询超时时间（毫秒，默认 10 分钟） */
    pollTimeoutMs?: number;
    /** 任务轮询最大次数（默认 300 次） */
    maxPollTimes?: number;
}

/**
 * 科大讯飞长文本语音合成(DTS)客户端
 * 
 * 支持长文本语音合成功能，特点：
 * - HTTP API调用
 * - 支持10万字左右的长文本
 * - 异步任务处理
 * - 任务状态查询
 * 
 * 使用示例：
 * ```typescript
 * const client = new DtsClient({
 *   serverBase: 'http://localhost:8083',
 *   business: { aue: 'raw', vcn: 'x4_mingge', speed: 50 },
 *   onTaskCreated: (taskId) => console.log('任务ID:', taskId)
 * });
 * const taskId = await client.createTask('很长的文本...');
 * const result = await client.waitForTask(taskId);
 * ```
 */
export class DtsClient extends BaseXfyunClient<DtsClientOptions> {
    constructor(options?: DtsClientOptions) {
        super(options);
    }

    /**
     * 创建DTS任务
     * 
     * @param text 待合成的文本
     * @param business 业务参数（可选，会覆盖默认配置）
     * @returns 任务ID
     * @throws Error 创建失败时抛出异常
     */
    async createTask(text: string, business?: DtsBusiness): Promise<string> {
        try {
            this.reset();

            // 1. 获取签名信息
            const signData = await this.getSignature("dts/create");
            const { url, appId, host, date, authorization } = signData;
            
            // 2. 构建业务参数
            const businessParams = {
                aue: business?.aue || this.options.business?.aue || "raw",
                vcn: business?.vcn || this.options.business?.vcn || "x4_mingge", // 使用当前API支持的发音人
                speed: business?.speed ?? this.options.business?.speed ?? 50,
                volume: business?.volume ?? this.options.business?.volume ?? 50,
                pitch: business?.pitch ?? this.options.business?.pitch ?? 50,
                bgs: business?.bgs ?? this.options.business?.bgs ?? 0,
                ttp: business?.ttp ?? this.options.business?.ttp ?? 0,
            };

            // 3. 构建讯飞API请求体（使用官方示例格式）
            const payload = {
                header: {
                    app_id: appId
                },
                parameter: {
                    dts: {
                        vcn: businessParams.vcn,
                        language: "zh",
                        speed: businessParams.speed,
                        volume: businessParams.volume,
                        pitch: businessParams.pitch,
                        rhy: 1,
                        audio: {
                            encoding: "lame",
                            sample_rate: 16000
                        },
                        pybuf: {
                            encoding: "utf8",
                            compress: "raw",
                            format: "plain"
                        }
                    }
                },
                payload: {
                    text: {
                        encoding: "utf8",
                        compress: "raw",
                        format: "plain",
                        text: btoa(unescape(encodeURIComponent(text)))
                    }
                }
            };

            // 4. 通过代理调用讯飞API（解决CORS问题）
            // 将完整的讯飞API URL转换为代理路径
            const proxyUrl = url.replace('https://api-dx.xf-yun.com', '');
            
            console.log('DTS请求URL:', url);
            console.log('DTS代理URL:', proxyUrl);
            console.log('DTS请求Host:', host);
            console.log('DTS请求Date:', date);
            console.log('DTS请求Authorization:', authorization);
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`DTS创建任务失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            console.log('DTS创建任务响应:', JSON.stringify(result, null, 2));

            if (result.header?.code !== 0) {
                throw new Error(`DTS创建任务失败: ${result.header?.message || '未知错误'}`);
            }

            const taskId = result.header?.task_id;
            if (!taskId) {
                throw new Error('DTS创建任务失败: 未返回task_id');
            }

            this.options.onTaskCreated?.(taskId);
            this.options.onLog?.('info', {
                event: 'dts.create',
                sessionId: this.sessionId,
                appId,
                taskId,
                timestamp: Date.now(),
            });
            return taskId;

        } catch (error) {
            this.handleError(error instanceof Error ? error.message : 'DTS创建任务失败');
            throw error;
        }
    }

    /**
     * 查询DTS任务状态
     * 
     * @param taskId 任务ID
     * @returns 任务状态数据
     * @throws Error 查询失败时抛出异常
     */
    async queryTask(taskId: string): Promise<any> {
        try {
            this.reset();

            // 1. 获取签名信息
            const signData = await this.getSignature("dts/query");
            const { url, appId, host, date, authorization } = signData;
            
            // 2. 构建讯飞API请求体（使用官方示例格式）
            const payload = {
                header: {
                    app_id: appId,
                    task_id: taskId
                }
            };

            // 3. 通过代理调用讯飞API（解决CORS问题）
            // 将完整的讯飞API URL转换为代理路径
            const proxyUrl = url.replace('https://api-dx.xf-yun.com', '');
            
            console.log('DTS查询请求URL:', url);
            console.log('DTS查询代理URL:', proxyUrl);
            console.log('DTS查询请求Host:', host);
            console.log('DTS查询请求Date:', date);
            console.log('DTS查询请求Authorization:', authorization);
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`DTS查询任务失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            console.log('DTS查询任务响应:', JSON.stringify(result, null, 2));

            if (result.header?.code !== 0) {
                throw new Error(`DTS查询任务失败: ${result.header?.message || '未知错误'}`);
            }

            const data = result.payload;

            // 如果任务完成，触发回调
            if (result.header?.task_status === "5") { // 5表示任务处理成功
                this.options.onTaskCompleted?.(data);
            }

            return {
                status: result.header?.task_status,
                data: data
            };

        } catch (error) {
            this.handleError(error instanceof Error ? error.message : 'DTS查询任务失败');
            throw error;
        }
    }

    /**
     * 轮询查询任务直到完成
     * 
     * @param taskId 任务ID
     * @param intervalMs 轮询间隔（毫秒），默认2000
     * @returns 任务完成后的结果数据
     * @throws Error 任务失败或查询异常时抛出异常
     */
    async waitForTask(taskId: string, intervalMs: number = 2000): Promise<any> {
        const timeoutMs = this.options.pollTimeoutMs ?? 10 * 60 * 1000;
        const maxTimes = this.options.maxPollTimes ?? 300;
        const start = Date.now();
        let times = 0;
        return new Promise((resolve, reject) => {
            const timer = setInterval(async () => {
                try {
                    times++;
                    if (Date.now() - start > timeoutMs || times > maxTimes) {
                        clearInterval(timer);
                        reject(new Error('DTS任务轮询超时'));
                        return;
                    }
                    const result = await this.queryTask(taskId);
                    if (result.status === "5") { // 任务处理成功
                        clearInterval(timer);
                        this.options.onTaskCompleted?.(result.data);
                        resolve(result.data);
                    } else if (result.status === "2" || result.status === "4") { // 任务派发失败或处理失败
                        clearInterval(timer);
                        reject(new Error('DTS任务执行失败'));
                    }
                } catch (error) {
                    clearInterval(timer);
                    reject(error);
                }
            }, intervalMs);
        });
    }

    /**
     * 下载任务结果产物
     * - 支持片段数组或单一直链
     */
    public async downloadResult(taskId: string, format?: string): Promise<Blob | null> {
        try {
            const result = await this.queryTask(taskId);
            const data = result.data;
            
            // 检查是否有音频数据
            if (!data?.audio?.audio) {
                console.log('DTS下载: 没有找到音频数据', data);
                return null;
            }
            
            // 解码Base64编码的音频URL
            const audioUrl = atob(data.audio.audio);
            console.log('DTS下载: 音频URL', audioUrl);
            
            // 下载音频文件
            const response = await fetch(audioUrl);
            if (!response.ok) {
                console.log('DTS下载: 音频下载失败', response.status, response.statusText);
                return null;
            }
            
            const blob = await response.blob();
            console.log('DTS下载: 音频下载成功', blob.size, 'bytes');
            
            // 根据格式设置MIME类型
            const mime = format === 'mp3' ? 'audio/mpeg' : 
                        (format === 'wav' ? 'audio/wav' : 
                        (format === 'pcm' ? 'audio/pcm' : 'application/octet-stream'));
            
            return new Blob([blob], { type: mime });
        } catch (error) {
            console.log('DTS下载: 下载失败', error);
            return null;
        }
    }

    /**
     * 关闭DTS客户端
     * 
     * DTS客户端使用HTTP API，无需特殊关闭逻辑
     */
    public override close(): void {
        super.close();
    }
}
