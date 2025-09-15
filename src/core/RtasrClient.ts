import { BaseXfyunClient, BaseXfyunClientOptions } from "./BaseXfyunClient";
import { validateAudioSpec, int16ToFloat32 } from "../utils/audio";
import { calculateRetryDelay, ErrorRecoveryStrategy, DEFAULT_RECOVERY_STRATEGY } from "../utils/errorMap";

/**
 * RTASR业务参数配置
 */
export interface RtasrBusiness {
    /** 语种，默认为 zh_cn */
    language?: string;
    /** 业务领域，固定为 rtasr */
    domain?: string;
    /** 方言/口音（中文场景），默认 mandarin */
    accent?: string;
    /** 静音断句阈值（毫秒），默认 2000 */
    vad_eos?: number;
    /** 动态修正开关，默认 "wpgs" */
    dwa?: string;
    /** 是否返回标点（1/0），默认 1 */
    ptt?: 0 | 1;
    /** 产品类型，默认 "edu" */
    pd?: string;
    /** 产品引擎 */
    pd_engine?: string;
    /** 结果语言 */
    rlang?: string;
    /** 候选结果数量 */
    nbest?: number;
    /** 候选词数量 */
    wbest?: number;
}

/**
 * RTASR客户端选项
 */
export interface RtasrClientOptions extends BaseXfyunClientOptions {
    /** RTASR业务参数配置 */
    business?: RtasrBusiness;
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
    /** 最大重试次数（默认3） */
    maxRetries?: number;
    /** 重连退避策略（可选，不传使用默认） */
    retryStrategy?: ErrorRecoveryStrategy;
    /** 输入采样率（用于自动重采样判断） */
    inputSampleRate?: number;
    /** 输入声道数（默认1） */
    inputChannels?: number;
    /** 是否自动重采样到16k单声道（默认false） */
    autoResample?: boolean;
}

/**
 * 科大讯飞实时语音转写(RTASR)客户端
 *
 * 支持长时间语音转文字功能，特点：
 * - WebSocket实时连接
 * - 支持连续音频流识别
 * - 自动重连机制
 * - 支持动态修正
 *
 * 使用示例：
 * ```typescript
 * const client = new RtasrClient({
 *   serverBase: 'http://localhost:8083',
 *   business: { language: 'zh_cn', domain: 'rtasr' },
 *   onResult: (text, isFinal) => console.log(text, isFinal)
 * });
 * await client.open();
 * client.sendFrame(audioData, false);
 * ```
 */
export class RtasrClient extends BaseXfyunClient<RtasrClientOptions> {
    private ws: WebSocket | null = null;
    public status: "idle" | "connecting" | "open" | "closing" | "closed" = "idle";

    private resultTemp = "";
    private resultArray: Array<any | null> = [];
    private appId = "";
    private sid: string | undefined;
    private started: boolean = false;
    private pendingFrames: Array<{ frame: ArrayBuffer; isLast: boolean }> = [];
    private lastMessageTime = 0;
    private lastAudioTime = 0;
    private messageCheckTimer: NodeJS.Timeout | null = null;
    private audioTimeoutTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: any = null;
    private retryCount: number = 0;
    private ended: boolean = false;
    private sentEnd: boolean = false;
    private visibilityHandler?: () => void;
    private pausedByPageHidden: boolean = false;

    constructor(options?: RtasrClientOptions) {
        super(options);
    }

    /**
     * 清理现有连接，确保完全关闭
     */
    private async cleanupExistingConnection(): Promise<void> {
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            
            // 等待WebSocket完全关闭
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                return new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve();
                    }, 5000); // 5秒超时
                    
                    ws.onclose = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    
                    ws.onerror = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    
                    try {
                        ws.close();
                    } catch (e) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            }
        }
        
        // 清理定时器
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.messageCheckTimer) {
            clearInterval(this.messageCheckTimer);
            this.messageCheckTimer = null;
        }
        if (this.audioTimeoutTimer) {
            clearInterval(this.audioTimeoutTimer);
            this.audioTimeoutTimer = null;
        }
        
        // 清理事件监听器
        if (this.visibilityHandler) {
            try {
                document.removeEventListener('visibilitychange', this.visibilityHandler, false);
            } catch {}
            this.visibilityHandler = undefined as any;
        }
        
        // 重置状态
        this.started = false;
        this.ended = false;
        this.sentEnd = false;
        this.pendingFrames = [];
        this.retryCount = 0;
    }

    /**
     * 建立RTASR WebSocket连接并发送首帧
     *
     * @throws Error 连接失败时抛出异常
     */
    async open(): Promise<void> {
        // 检查当前状态，防止重复连接
        if (this.status === "connecting") {
            throw new Error("RTASR正在连接中，请等待连接完成");
        }
        if (this.status === "open") {
            throw new Error("RTASR连接已存在，请先关闭现有连接");
        }

        // 先完全清理现有连接
        await this.cleanupExistingConnection();

        // 重置所有状态
        this.reset();
        this.status = "connecting";
        this.ended = false;
        this.sentEnd = false;
        this.started = false;

        try {
            const signData = await this.getSignature("rtasr");
            const { url } = signData;
            const appIdFromSign = signData.appId || signData.app_id;
            this.appId = appIdFromSign || "";
            if (!this.appId) {
                const errorMsg = "签名返回缺少appId/app_id，请检查后端签名服务配置";
                this.handleError(errorMsg);
                throw new Error(errorMsg);
            }

            const ws = new WebSocket(url);
            this.ws = ws;

            // 等待底层连接建立（TCP/WS open）
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket连接超时，请检查网络连接'));
                }, 10000); // 10秒超时
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket连接失败: ${error}`));
                };
            });

            // 按官方文档，RTASR握手参数在URL上携带。建立连接后无需发送任何首帧JSON。
            // 等待服务端返回 { action: 'started' } 后再发送二进制音频数据。

            // 等待服务端 started 再认为就绪
            await new Promise<void>((resolve, reject) => {
                const startedTimeout = setTimeout(() => {
                    reject(new Error('RTASR启动超时，未收到started消息，请检查服务端状态'));
                }, 15000);

                const prevOnMessage = ws.onmessage;
                ws.onmessage = (evt) => {
                    try {
                        this.lastMessageTime = Date.now();
                        if (!(evt.data instanceof ArrayBuffer)) {
                            const msg = JSON.parse(evt.data);
                            if (msg?.sid) this.sid = msg.sid;
                            this.options.onMessage?.(msg);
                            if (msg?.action === 'started' && (msg?.code === 0 || msg?.code === '0')) {
                                clearTimeout(startedTimeout);
                                this.started = true;
                                this.status = 'open';
                                this.retryCount = 0;
                                this.options.onOpen?.(this.sid);
                                console.log('RTASR连接建立成功，SID:', this.sid);
                                // 冲刷队列
                                this.flushPendingFrames();
                                // 恢复onmessage链
                                ws.onmessage = prevOnMessage as any;
                                // 交给原有处理继续处理当前消息（如果需要）
                                if (prevOnMessage) {
                                    prevOnMessage.call(ws, evt as any);
                                }
                                resolve();
                                return;
                            }
                        }
                    } catch {}
                    // 非 started 的消息，交由后续 onmessage 正常流程
                    if (prevOnMessage) {
                        prevOnMessage.call(ws, evt as any);
                    }
                };
            });

            // 官方不鼓励发送空JSON心跳，这里禁用默认心跳；若需保活，应由后端签名/网关层处理。
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

            // 启动消息检查定时器
            this.messageCheckTimer = setInterval(() => {
                const now = Date.now();
                const timeSinceLastMessage = now - this.lastMessageTime;
                if (timeSinceLastMessage > 10000 && this.lastMessageTime > 0) {
                    console.warn('RTASR: 已超过10秒未收到服务器消息');
                }
            }, 5000);

            // 启动音频发送超时检测（根据API文档：音频发送间隔超时时间为15秒）
            // 注意：只有在连接建立后才启用超时检测，避免在静音期间误关闭
            this.audioTimeoutTimer = setInterval(() => {
                const now = Date.now();
                const timeSinceLastAudio = now - this.lastAudioTime;
                // 只有在已经发送过音频数据且超过30秒未发送时才关闭（给用户更多缓冲时间）
                if (timeSinceLastAudio > 30000 && this.lastAudioTime > 0 && this.status === 'open') {
                    console.error('RTASR: 超过30秒未发送音频数据，连接将被关闭');
                    this.handleError('音频发送超时');
                    ws.close();
                }
            }, 10000); // 每10秒检查一次，减少检查频率

            ws.onmessage = (evt) => {
                try {
                    this.lastMessageTime = Date.now();

                    // 检查消息类型
                    if (evt.data instanceof ArrayBuffer) {
                        console.log('RTASR收到二进制消息，长度:', evt.data.byteLength);
                        return;
                    }

                    // 处理文本消息（JSON格式）
                    const msg = JSON.parse(evt.data);

                    console.log('RTASR收到服务器消息:', {
                        action: msg.action,
                        code: msg.code,
                        desc: msg.desc,
                        sid: msg.sid,
                        hasData: !!msg.data,
                        dataLength: msg.data ? msg.data.length : 0
                    });

                    if (msg?.sid) {
                        this.sid = msg.sid;
                    }

                    this.options.onMessage?.(msg);

                    // 处理连接建立消息（冗余保护）
                    if (msg?.action === 'started' && (msg?.code === 0 || msg?.code === '0')) {
                        if (!this.started) {
                            this.started = true;
                            this.status = 'open';
                            this.retryCount = 0;
                            this.options.onOpen?.(this.sid);
                            console.log('RTASR连接建立成功，SID:', this.sid);
                            this.flushPendingFrames();
                        }
                    }

                    // 处理识别结果
                    if (msg?.action === 'result' && (msg?.code === '0' || msg?.code === 0)) {
                        console.log('RTASR收到识别结果:', {
                            action: msg.action,
                            code: msg.code,
                            data: msg.data,
                            desc: msg.desc,
                            sid: msg.sid
                        });
                        this.processRecognitionResult(msg);
                    }

                    // 处理错误消息
                    else if (msg?.code !== 0 && msg?.code !== '0') {
                        console.error('RTASR收到错误消息:', {
                            action: msg.action,
                            code: msg.code,
                            desc: msg.desc,
                            sid: msg.sid
                        });
                        this.processXfyunError(msg?.code, msg?.message, this.sid, {
                            lastEvent: 'rtasr.onmessage',
                            wsReadyState: this.ws?.readyState,
                        });
                        ws.close();
                    }
                } catch (error) {
                    console.error("RTASR消息解析错误:", error);
                    this.handleError('消息解析错误', this.sid, { lastEvent: 'rtasr.onmessage.parseError' });
                }
            };

            ws.onclose = (ev) => {
                this.status = "closed";
                this.ended = false;
                if (this.heartbeatTimer) {
                    clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
                if (this.messageCheckTimer) {
                    clearInterval(this.messageCheckTimer);
                    this.messageCheckTimer = null;
                }
                if (this.audioTimeoutTimer) {
                    clearInterval(this.audioTimeoutTimer);
                    this.audioTimeoutTimer = null;
                }
                try { if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler, false); } catch {}

                // 如果不是正常关闭，尝试重连（指数退避+抖动）
                const maxRetries = this.options.maxRetries ?? DEFAULT_RECOVERY_STRATEGY.maxRetries;
                if (!ev.wasClean && this.retryCount < maxRetries) {
                    this.retryCount++;
                    const strategy = this.options.retryStrategy ?? DEFAULT_RECOVERY_STRATEGY;
                    const baseDelay = calculateRetryDelay(this.retryCount, strategy);
                    const jitter = Math.floor(Math.random() * 300); // 0-300ms 抖动
                    const delay = baseDelay + jitter;
                    setTimeout(() => {
                        this.open().catch(error => {
                            console.error(`重连失败: ${error}`);
                        });
                    }, delay);
                }

                this.options.onClose?.(ev.code, ev.reason);
            };

            ws.onerror = (error) => {
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
     * @param msg 消息数据
     */
    private processRecognitionResult(msg: any): void {
        try {
            const resultData = JSON.parse(msg.data);
            let recognizedText = '';

            // 处理普通识别结果
            if (resultData.cn?.st?.rt) {
                const rt = resultData.cn.st.rt;
                for (const segment of rt) {
                    if (segment.ws) {
                        for (const word of segment.ws) {
                            if (word.cw) {
                                for (const char of word.cw) {
                                    if (char.w) {
                                        recognizedText += char.w;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 处理翻译结果
            if (resultData.biz === 'trans') {
                recognizedText = resultData.src || '';
            }

            if (recognizedText) {
                this.resultTemp = recognizedText;
                this.options.onResult?.(recognizedText, false);
            }

            // 检查是否为最终结果
            const isFinal = resultData.cn?.st?.type === '0' || resultData.isEnd === true;
            if (isFinal) {
                this.options.onResult?.(recognizedText, true);
            }
        } catch (error) {
            console.error('解析识别结果失败:', error);
        }
    }

    /**
     * 发送音频帧
     *
     * @param frame 音频帧数据
     * @param isLast 是否为最后一帧
     */
    sendFrame(frame: ArrayBuffer, isLast: boolean): void {
        // 结束后禁止继续入队/发送
        if (this.ended || this.sentEnd) {
            return;
        }
        // 页面隐藏时暂停发送
        if (this.pausedByPageHidden) {
            return;
        }
        // 握手未完成：统一入队，待 started 后冲刷
        if (!this.started) {
            this.pendingFrames.push({ frame, isLast });
            return;
        }
        // 连接未就绪：不发送，但保守入队（避免数据丢失）
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== 'open') {
            this.pendingFrames.push({ frame, isLast });
            return;
        }

        // 调试日志：发送音频帧信息
        console.log('RTASR发送音频帧:', {
            isLast,
            frameSize: frame.byteLength,
            wsReadyState: this.ws.readyState,
            status: this.status
        });

        // 如果是结束帧，发送结束标识（JSON格式）
        if (isLast) {
            const endMessage = JSON.stringify({end: true});
            try {
                this.ws.send(endMessage);
            } catch {}
            console.log('RTASR发送结束帧:', endMessage);
            this.status = "closing";
            this.ended = true;
            this.sentEnd = true;
            // 结束帧不更新音频时间，避免触发超时
            return;
        }

        // 可选：对非16k/单声道输入进行重采样（同步接口仅告警，建议调用方预处理）
        if (this.options.autoResample) {
            const sr = this.options.inputSampleRate || 16000;
            const ch = this.options.inputChannels || 1;
            if (!validateAudioSpec({ sampleRate: sr, channels: ch, bitDepth: 16 })) {
                try {
                    const int16 = new Int16Array(frame);
                    const f32 = int16ToFloat32(int16);
                    // 同 IAT，暂不同步替换，给出提示
                    // void resampleTo16kMono(f32, sr, ch).then(() => {});
                    console.warn('RTASR: 输入音频非16k单声道，建议预先重采样后再传入，或未来使用异步接口');
                } catch {}
            }
        }

        // 检查音频数据是否有效
        const int16Array = new Int16Array(frame);
        const hasNonZeroData = int16Array.some(value => value !== 0);
        const maxValue = Math.max(...Array.from(int16Array));
        const minValue = Math.min(...Array.from(int16Array));

        console.log('RTASR音频数据检查:', {
            frameSize: frame.byteLength,
            hasNonZeroData: hasNonZeroData,
            maxValue: maxValue,
            minValue: minValue
        });

        // 根据API文档，RTASR应该发送binary message（音频的二进制数据）
        // 不是JSON格式，而是直接的音频二进制数据
        console.log('RTASR发送二进制音频数据:', {
            frameSize: frame.byteLength,
            hasNonZeroData: hasNonZeroData,
            maxValue: maxValue,
            minValue: minValue
        });

        // 更新最后音频发送时间
        this.lastAudioTime = Date.now();

        // 发送二进制音频数据
        this.ws.send(frame);
    }

    /**
     * 冲刷等待队列
     */
    private flushPendingFrames(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const queue = this.pendingFrames;
        this.pendingFrames = [];
        for (const item of queue) {
            if (this.ended || this.sentEnd) continue;
            if (item.isLast) {
                const endMessage = JSON.stringify({ end: true });
                try { this.ws.send(endMessage); } catch {}
                this.status = "closing";
                this.ended = true;
                this.sentEnd = true;
            } else {
                try { this.ws.send(item.frame); } catch {}
                this.lastAudioTime = Date.now();
            }
        }
    }

    /**
     * 重置客户端状态
     */
    override reset(): void {
        super.reset();
        this.resultTemp = "";
        this.resultArray = [];
        this.ended = false;
    }

    /**
     * 关闭WebSocket连接
     */
    override close(): void {
        // 使用异步清理，但不等待完成
        this.cleanupExistingConnection().catch(() => {
            // 忽略清理过程中的错误
        });
        this.status = "closed";
    }
}
