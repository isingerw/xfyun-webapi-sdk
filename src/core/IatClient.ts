import { BaseXfyunClient, BaseXfyunClientOptions } from "./BaseXfyunClient";
import { toBase64, AudioFramePayload, validateAudioSpec, int16ToFloat32 } from "../utils/audio";
import { calculateRetryDelay, ErrorRecoveryStrategy, DEFAULT_RECOVERY_STRATEGY } from "../utils/errorMap";

/**
 * IAT业务参数配置
 */
export interface IatBusiness {
    /** 语种，默认为 zh_cn */
    language?: string;
    /** 业务领域，固定为 iat */
    domain?: string;
    /** 方言/口音（中文场景），默认 mandarin */
    accent?: string;
    /** 静音断句阈值（毫秒），默认 2000 */
    vad_eos?: number;
    /** 动态修正开关，默认 "wpgs" */
    dwa?: string;
    /** 是否返回标点（1/0），默认 1 */
    ptt?: 0 | 1;
    /** 返回字级别信息 */
    vinfo?: 0 | 1;
    /** 返回结果格式（plain/json 等） */
    rst?: string;
    /** 返回结果语言 */
    rlang?: string;
    /** 产品类型 */
    pd?: string;
    /** 产品引擎 */
    pd_engine?: string;
    /** 候选结果数量 */
    nbest?: number;
    /** 候选词数量 */
    wbest?: number;
}

/**
 * IAT客户端选项
 */
export interface IatClientOptions extends BaseXfyunClientOptions {
    /** IAT业务参数配置 */
    business?: IatBusiness;
    /** 识别增量文本回调 */
    onResult?: (text: string, isFinal: boolean) => void;
    /** 原始消息回调（调试用） */
    onMessage?: (msg: any) => void;
    /** 连接打开回调（包含 sid） */
    onOpen?: (sid?: string) => void;
    /** 连接关闭回调 */
    onClose?: (code?: number, reason?: string) => void;
    /** 心跳间隔（毫秒），0表示禁用 */
    heartbeatMs?: number;
    /** 输入采样率（用于自动重采样判断） */
    inputSampleRate?: number;
    /** 输入声道数（默认1） */
    inputChannels?: number;
    /** 是否自动重采样到16k单声道（默认false） */
    autoResample?: boolean;
    /** 最大重试次数（默认3） */
    maxRetries?: number;
    /** 重连退避策略（可选，不传使用默认） */
    retryStrategy?: ErrorRecoveryStrategy;
    /** 是否启用语言/方言与URL匹配校验（默认true） */
    enableLangCheck?: boolean;
}

/**
 * 科大讯飞语音听写(IAT)客户端
 *
 * 支持实时语音转文字功能，特点：
 * - WebSocket实时连接
 * - 支持动态修正
 * - 支持增量识别结果
 * - 自动断句处理
 *
 * 使用示例：
 * ```typescript
 * const client = new IatClient({
 *   serverBase: 'http://localhost:8083',
 *   business: { language: 'zh_cn', vad_eos: 2000 },
 *   onResult: (text, isFinal) => console.log(text, isFinal)
 * });
 * await client.open();
 * client.sendFrame(audioData, false);
 * ```
 */
export class IatClient extends BaseXfyunClient<IatClientOptions> {
    private ws: WebSocket | null = null;
    public status: "idle" | "connecting" | "open" | "closing" | "closed" = "idle";

    private resultTemp = "";
    private resultMap: Map<number, any> = new Map();
    private maxResultWindow: number = 200; // 限制窗口，避免内存膨胀
    private lastSnSeen: number = -1;
    private appId = "";
    private sid: string | undefined;
    private heartbeatTimer: any = null;
    private visibilityHandler?: () => void;
    private pausedByPageHidden: boolean = false;
    private retryCount: number = 0;

    constructor(options?: IatClientOptions) {
        super(options);
    }

    /**
     * 建立IAT WebSocket连接并发送首帧
     *
     * 首帧内容：
     * - common.app_id: 来自后端签名返回
     * - business: 语言/断句/标点/动态修正等配置
     * - data: { status:0, format:'audio/L16;rate=16000', encoding:'raw' }
     *
     * @throws Error 连接失败时抛出异常
     */
    async open(): Promise<void> {
        this.reset();
        this.status = "connecting";

        try {
            const signData = await this.getSignature("iat");
            const { url } = signData;
            const appIdFromSign = signData.appId || signData.app_id;
            this.appId = appIdFromSign || "";
            if (!this.appId) {
                this.handleError("签名返回缺少appId/app_id");
                throw new Error("签名返回缺少appId/app_id");
            }

            const ws = new WebSocket(url);
            this.ws = ws;

            ws.onopen = () => {
                this.status = "open";
                this.options.onOpen?.(this.sid);

                // 构建业务参数：仅发送用户显式配置的字段；始终包含 domain 默认为 iat
                const business: any = { domain: this.options.business?.domain || "iat" };
                const src = this.options.business || {};
                const maybeAssign = (key: keyof IatBusiness) => {
                    const value = (src as any)[key];
                    if (value !== undefined && value !== null) {
                        (business as any)[key] = value;
                    }
                };
                maybeAssign("language");
                maybeAssign("accent");
                maybeAssign("vad_eos");
                maybeAssign("ptt");
                maybeAssign("dwa");
                maybeAssign("vinfo");
                maybeAssign("rst");
                maybeAssign("rlang");
                maybeAssign("pd");
                maybeAssign("pd_engine");
                maybeAssign("nbest");
                maybeAssign("wbest");

                // 语言/方言与URL匹配校验（提示级，不阻断）
                if (this.options.enableLangCheck !== false) {
                    try {
                        const warns: string[] = [];
                        const lang = business.language as string | undefined;
                        const accent = business.accent as string | undefined;
                        const urlHost = (() => {
                            try { return new URL(signData.url).host; } catch { return ''; }
                        })();
                        const isChinese = !lang || lang === 'zh_cn';
                        if (!isChinese) {
                            // 小语种：不建议设置中文口音；URL 建议 niche 域名
                            if (accent) {
                                warns.push('小语种场景不应设置 accent，已检测到 accent=' + accent);
                            }
                            if (urlHost && !/iat-niche-api\.xfyun\.cn/i.test(urlHost)) {
                                warns.push('当前 language=' + lang + '，建议使用 iat-niche-api.xfyun.cn 域名');
                            }
                        } else {
                            // 中文：可设置 accent；如 URL 为 niche 域名，亦给出提示
                            if (urlHost && /iat-niche-api\.xfyun\.cn/i.test(urlHost)) {
                                warns.push('中文场景建议使用 iat-api.xfyun.cn 或 ws-api.xfyun.cn 域名');
                            }
                        }
                        if (warns.length) {
                            console.warn('[IAT] 语言/URL校验提示:', { warns, urlHost, lang, accent });
                            this.options.onMessage?.({ type: 'warning', category: 'language-url-check', warns, urlHost, lang, accent });
                        }
                    } catch {}
                }

                // 发送首帧
                ws.send(JSON.stringify({
                    common: { app_id: this.appId },
                    business,
                    data: { status: 0, format: "audio/L16;rate=16000", encoding: "raw" },
                }));

                // 统一会话追踪日志
                this.options.onLog?.('info', {
                    event: 'iat.open',
                    sessionId: this.sessionId,
                    appId: this.appId,
                    timestamp: Date.now(),
                });

                // 官方不鼓励发送空JSON心跳，这里不主动发送保活数据。

                // 监听页面可见性，隐藏时暂停发送；可见时恢复
                this.visibilityHandler = () => {
                    if (typeof document === 'undefined') return;
                    if (document.hidden) {
                        this.pausedByPageHidden = true;
                    } else {
                        this.pausedByPageHidden = false;
                    }
                };
                try { document.addEventListener('visibilitychange', this.visibilityHandler!, false); } catch {}
            };

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg?.sid) this.sid = msg.sid;
                    this.options.onMessage?.(msg);

                    // 处理识别结果
                    if (msg?.data?.result) {
                        this.processRecognitionResult(msg.data.result);
                    }

                    // 处理最终结果
                    if (msg?.code === 0 && msg?.data?.status === 2) {
                        this.options.onResult?.(this.resultTemp, true);
                        this.status = "closing";
                        ws.close();
                    } else if (msg?.code !== 0) {
                        this.processXfyunError(msg?.code, msg?.message, this.sid, {
                            lastEvent: 'iat.onmessage',
                            wsReadyState: this.ws?.readyState,
                        });
                        this.status = "closed";
                        ws.close();
                    }
                } catch (error) {
                    console.error("IAT消息解析错误:", error);
                    this.handleError("消息解析错误", this.sid, { lastEvent: 'iat.onmessage.parseError' });
                }
            };

            ws.onclose = (ev) => {
                this.status = "closed";
                if (this.heartbeatTimer) {
                    clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
                try { if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler, false); } catch {}
                // 如果不是正常关闭，尝试重连（指数退避+抖动）
                const maxRetries = this.options.maxRetries ?? DEFAULT_RECOVERY_STRATEGY.maxRetries;
                if (!ev.wasClean && this.retryCount < maxRetries) {
                    this.retryCount++;
                    const strategy = this.options.retryStrategy ?? DEFAULT_RECOVERY_STRATEGY;
                    const baseDelay = calculateRetryDelay(this.retryCount, strategy);
                    const jitter = Math.floor(Math.random() * 300);
                    const delay = baseDelay + jitter;
                    setTimeout(() => {
                        this.open().catch(error => {
                            console.error(`IAT重连失败: ${error}`);
                        });
                    }, delay);
                } else {
                    this.retryCount = 0;
                }
                this.options.onClose?.(ev.code, ev.reason);
            };

            ws.onerror = () => {
                this.handleError("WebSocket错误", this.sid);
            };
        } catch (error) {
            this.handleError(error instanceof Error ? error.message : "连接失败");
            throw error;
        }
    }

    /**
     * 处理识别结果
     *
     * @param result 识别结果数据
     */
    private processRecognitionResult(result: any): void {
        try {
            const sn: number | undefined = result?.sn;
            if (typeof sn !== 'number') {
                return;
            }

            // 忽略重复结果（简单判定：同 sn 且 ws 长度未增长）
            const prev = this.resultMap.get(sn);
            if (prev && Array.isArray(prev.ws) && Array.isArray(result.ws) && result.ws.length <= prev.ws.length) {
                // 但若为替换型 pgs=rpl 仍继续处理
                if (result.pgs !== 'rpl') {
                    return;
                }
            }

            // 处理动态修正：pgs === 'rpl' 时，删去区间 [rg[0], rg[1]] 的历史，再写入当前 sn
            if (result.pgs === 'rpl' && Array.isArray(result.rg)) {
                const [start, end] = result.rg as [number, number];
                for (let i = start; i <= end; i++) {
                    if (i !== sn) this.resultMap.delete(i);
                }
            }

            // 写入/覆盖当前 sn 结果
            this.resultMap.set(sn, result);
            this.lastSnSeen = Math.max(this.lastSnSeen, sn);

            // 窗口裁剪：只保留最近 maxResultWindow 个片段
            if (this.resultMap.size > this.maxResultWindow) {
                const ordered = Array.from(this.resultMap.keys()).sort((a, b) => a - b);
                const toDelete = ordered.length - this.maxResultWindow;
                for (let i = 0; i < toDelete; i++) {
                    this.resultMap.delete(ordered[i]);
                }
            }

            // 按 sn 升序全量重建文本，兼容乱序/丢失
            const orderedSn = Array.from(this.resultMap.keys()).sort((a, b) => a - b);
            let merged = '';
            for (const key of orderedSn) {
                const seg = this.resultMap.get(key);
                if (!seg) continue;
                const wsArr = seg.ws || [];
                for (const s of wsArr) {
                    if (s.cw && s.cw[0]) {
                        merged += s.cw[0].w || '';
                    }
                }
            }
            this.resultTemp = merged;
            this.options.onResult?.(merged, false);
        } catch {
            // ignore parse errors for robustness
        }
    }

    /**
     * 调试/测试专用：注入一条识别结果并走内部重建逻辑
     * 不建立网络连接即可验证动态修正与乱序容错
     */
    public debugProcessRecognitionResult(result: any): void {
        this.processRecognitionResult(result);
    }

    /**
     * 发送音频帧
     *
     * @param frame 音频帧数据
     * @param isLast 是否为最后一帧
     */
    sendFrame(frame: AudioFramePayload, isLast: boolean): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket未连接，无法发送音频帧');
            return;
        }
        if (this.pausedByPageHidden) {
            // 页面隐藏时暂停发送，避免被服务端判空闲
            return;
        }

        // 可选：对非16k/单声道输入进行重采样
        if (this.options.autoResample) {
            const sr = this.options.inputSampleRate || 16000;
            const ch = this.options.inputChannels || 1;
            if (!validateAudioSpec({ sampleRate: sr, channels: ch, bitDepth: 16 })) {
                try {
                    let int16: Int16Array;
                    if (frame instanceof Int16Array) {
                        int16 = frame;
                    } else if (frame instanceof ArrayBuffer) {
                        int16 = new Int16Array(frame);
                    } else {
                        int16 = new Int16Array(frame.buffer);
                    }
                    const f32 = int16ToFloat32(int16);
                    // 注意：异步重采样，这里无法直接 await，因此提示调用方改用异步管道更合适。
                    // 为保持API同步性，仍然发送原始帧，但输出警告，建议调用方在喂帧前重采样。
                    // 也可在后续版本新增 sendFrameAsync 以便真正替换帧数据。
                    // void resampleTo16kMono(f32, sr, ch).then(() => {});
                    console.warn('IAT: 输入音频非16k单声道，建议预先重采样后再传入，或未来使用异步接口');
                } catch {}
            }
        }

        const audioData = toBase64(frame);
        const message = {
            data: {
                status: isLast ? 2 : 1,
                format: "audio/L16;rate=16000",
                encoding: "raw",
                audio: audioData,
            },
        };

        console.log('发送音频帧:', {
            isLast,
            frameSize: frame instanceof ArrayBuffer ? frame.byteLength : frame.length,
            audioDataLength: audioData.length,
            wsReadyState: this.ws.readyState
        });

        this.ws.send(JSON.stringify(message));

        if (isLast) this.status = "closing";
    }

    /**
     * 重置客户端状态
     */
    override reset(): void {
        super.reset();
        this.resultTemp = "";
        this.resultMap = new Map();
    }

    /**
     * 关闭WebSocket连接
     */
    override close(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        this.ws = null;
    }
}


