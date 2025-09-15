import { BaseXfyunClient, BaseXfyunClientOptions } from "./BaseXfyunClient";
import { getSharedAudioContext } from "../utils/audio";

/**
 * TTS业务参数配置
 */
export interface TtsBusiness {
    /** 音频编码，默认 "raw" */
    aue?: string;
    /** 发音人，默认 "x4_yezi" */
    vcn?: string;
    /** 语速（0-100），默认 50 */
    speed?: number;
    /** 音量（0-100），默认 50 */
    volume?: number;
    /** 音调（0-100），默认 50 */
    pitch?: number;
    /** 数字发音风格（按官方枚举/数值） */
    rdn?: number | string;
    /** 文本编码（默认 utf8，可覆盖） */
    tte?: string;
    /** 音频封装格式（默认 audio/L16;rate=16000，可覆盖） */
    auf?: string;
    /** 音库领域（如通用/教育等） */
    ent?: string;
}

/**
 * TTS客户端选项
 */
export interface TtsClientOptions extends BaseXfyunClientOptions {
    /** TTS业务参数配置 */
    business?: TtsBusiness;
    /** 音量电平回调（0-100） */
    onLevel?: (level: number) => void;
    /** MP3音频块回调 */
    onMp3Chunk?: (bytes: Uint8Array) => void;
    /** 合成完成回调 */
    onComplete?: () => void;
    /** 是否由SDK内置自动播放（PCM走WebAudio，MP3走MSE），默认 true */
    autoplay?: boolean;
    /** MP3 播放策略："mse" | "none"，默认 "mse"（仅当 autoplay=true 且 aue=mp3 生效） */
    mp3Playback?: "mse" | "none";
    /** 自动播放被策略阻止时，是否绑定一次性手势触发以恢复播放（默认 true） */
    autoplayGesture?: boolean;
}

/**
 * 科大讯飞语音合成(TTS)客户端
 *
 * 支持文字转语音功能，特点：
 * - WebSocket实时连接
 * - 支持多种音频格式（PCM/MP3）
 * - 实时音频播放
 * - 音量电平监控
 *
 * 使用示例：
 * ```typescript
 * const client = new TtsClient({
 *   serverBase: 'http://localhost:8083',
 *   business: { aue: 'raw', vcn: 'x4_yezi', speed: 50 },
 *   onLevel: (level) => console.log('音量:', level)
 * });
 * await client.speak('你好世界');
 * ```
 */
export class TtsClient extends BaseXfyunClient<TtsClientOptions> {
    private ws: WebSocket | null = null;
    public status: "idle" | "connecting" | "open" | "playing" | "closed" | "error" = "idle";

    // 内置播放（PCM - WebAudio 队列）
    private audioCtx: AudioContext | null = null;
    private pcmQueue: Float32Array[] = [];
    private pcmProcessing = false;
    private pcmPaused = false;
    private pcmCurrentSource: AudioBufferSourceNode | null = null;
    private pcmScheduleAheadSec = 0.08; // 提前调度窗口
    private pcmCursorTime = 0; // 相对于 ctx.currentTime 的累计播放时间
    private pcmPlaybackComplete = false; // 标记PCM播放是否完成

    // 内置播放（MP3 - MediaSource）
    private mse: MediaSource | null = null;
    private mseAudioEl: HTMLAudioElement | null = null;
    private mseSourceBuffer: SourceBuffer | null = null;
    private mseQueue: Uint8Array[] = [];
    private mseAppending = false;

    constructor(options?: TtsClientOptions) {
        super(options);
    }

    /**
     * 发起TTS合成并实时播放
     *
     * @param text 待合成的文本
     * @throws Error 合成失败时抛出异常
     */
    async speak(text: string): Promise<void> {
        this.reset();
        this.status = "connecting";

        try {
            // 在用户手势触发的调用栈内尽早预热 MSE，提升自动播放成功率
            const wantMp3Autoplay = (this.options.autoplay !== false) && ((this.options.mp3Playback ?? "mse") === "mse") && ((this.options.business?.aue || "raw") === "mp3");
            if (wantMp3Autoplay) {
                this.ensureMse();
            }

            const signData = await this.getSignature("tts");
            const { url, appId } = signData;

            const ws = new WebSocket(url);
            this.ws = ws;

            ws.onopen = () => {
                this.status = "open";

                // 构建业务参数 - 动态读取最新的business参数
                const currentBusiness = this.options.business || {};
                const business: any = {
                    aue: currentBusiness.aue || "raw",
                    vcn: currentBusiness.vcn || "x4_yezi",
                    speed: currentBusiness.speed ?? 50,
                    volume: currentBusiness.volume ?? 50,
                    pitch: currentBusiness.pitch ?? 50,
                    tte: currentBusiness.tte || "utf8",
                    auf: currentBusiness.auf || "audio/L16;rate=16000",
                };

                // 添加其他可选参数
                if (this.options.business?.rdn !== undefined) business.rdn = this.options.business.rdn;
                if (this.options.business?.ent !== undefined) business.ent = this.options.business.ent;

                console.log('TTS业务参数:', business);
                console.log('TTS发音人:', business.vcn, '音频格式:', business.aue);

                // 触发日志回调
                this.options.onLog?.('info', {
                    event: 'tts.parameters',
                    message: `TTS参数已设置: 发音人=${business.vcn}, 音频格式=${business.aue}, 语速=${business.speed}, 音量=${business.volume}, 音调=${business.pitch}`,
                    parameters: business
                });
                // 再次确保MP3播放资源就绪
                if ((this.options.autoplay !== false) && ((this.options.mp3Playback ?? "mse") === "mse") && (business.aue === "mp3")) {
                    this.ensureMse();
                }

                // 发送合成请求
                const payload = {
                    common: { app_id: appId },
                    business,
                    data: {
                        status: 2,
                        text: btoa(unescape(encodeURIComponent(text))),
                    },
                };
                ws.send(JSON.stringify(payload));

                // 统一会话追踪日志
                this.options.onError?.('', undefined); // no-op to satisfy optional chain, keep existing behavior
                this.options.onLog?.('info', {
                    event: 'tts.open',
                    sessionId: this.sessionId,
                    appId,
                    timestamp: Date.now(),
                });
            };

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg.code !== 0) {
                        this.processXfyunError(msg.code, msg.message || "TTS失败");
                        ws.close();
                        return;
                    }

                    const audio = msg.data?.audio;
                    if (audio) {
                        this.processAudioData(audio);
                        // 触发音频数据接收日志
                        this.options.onLog?.('info', {
                            event: 'tts.audio_received',
                            message: `收到音频数据: ${audio.length} 字符`,
                            audioLength: audio.length
                        });
                    }
                    // 一旦收到音频，进入 playing 状态
                    if (this.status === "open") {
                        this.status = "playing";
                        this.options.onLog?.('info', {
                            event: 'tts.playing',
                            message: 'TTS开始播放'
                        });
                    }
                } catch (error) {
                    console.error("TTS消息解析错误:", error);
                }
            };

            ws.onerror = () => {
                this.status = "error";
                this.handleError("TTS连接错误");
            };

            ws.onclose = () => {
                this.status = "closed";
                // 触发连接关闭日志
                this.options.onLog?.('info', {
                    event: 'tts.closed',
                    message: 'TTS连接已关闭'
                });
                // 对于PCM格式，需要等待音频播放完成
                this.schedulePlaybackCompleteCheck();
            };
        } catch (error) {
            this.handleError(error instanceof Error ? error.message : "TTS合成失败");
            throw error;
        }
    }

    /**
     * 处理音频数据
     *
     * @param audio Base64编码的音频数据
     */
    private processAudioData(audio: string): void {
        const binary = atob(audio);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        let sum = 0;

        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const aue = this.options.business?.aue || "raw";
        if (aue === "mp3") {
            // MP3 直接透传给上层，由上层 MSE 播放
            this.options.onMp3Chunk?.(bytes);

            // 内置自动播放（无界面）
            if (this.options.autoplay !== false && (this.options.mp3Playback ?? "mse") === "mse") {
                this.enqueueMp3(bytes);
            }
        } else {
            // 计算音量电平（基于 Int16 -> Float32）
            const samples = Math.floor(len / 2);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < samples; i++) {
                const s = view.getInt16(i * 2, true) / 0x8000;
                sum += s * s;
            }

            if (this.options.onLevel) {
                const rms = Math.sqrt(sum / Math.max(1, samples));
                const level = Math.min(100, Math.max(0, Math.round(rms * 140)));
                this.options.onLevel(level);
            }

            // 透传 PCM 由上层播放
            this.onAudio?.(bytes);

            // 内置自动播放（WebAudio）
            if (this.options.autoplay !== false) {
                this.enqueuePcm(bytes);
            }
        }
    }

    /**
     * 停止TTS合成并关闭客户端
     */
    public override close(): void {
        this.ws?.close();
        super.close();
        this.teardownPlayback();
    }

    /**
     * 强制重新创建客户端（用于参数更新）
     */
    public forceRecreate(): void {
        this.close();
        this.reset();
        console.log('TTS客户端已强制重新创建');
    }

    /**
     * 重置客户端状态
     */
    public override reset(): void {
        super.reset();
        this.pcmPlaybackComplete = false; // 重置播放完成标记
    }

    /** 音频数据回调，由上层设置 */
    onAudio?: (pcmBytes: Uint8Array) => void;

    // ============== 内置 PCM(WebAudio) 播放 ==============
    private enqueuePcm(pcmBytes: Uint8Array) {
        try {
            const samples = Math.floor(pcmBytes.byteLength / 2);
            const float32 = new Float32Array(samples);
            const view = new DataView(pcmBytes.buffer);
            for (let i = 0; i < samples; i++) {
                float32[i] = view.getInt16(i * 2, true) / 0x8000;
            }
            this.pcmQueue.push(float32);
            if (!this.pcmProcessing) void this.playPcmQueue();
        } catch {
            // ignore
        }
    }

    private async playPcmQueue() {
        if (this.pcmProcessing) return;
        this.pcmProcessing = true;
        try {
            if (!this.audioCtx) {
                this.audioCtx = getSharedAudioContext(16000);
            }
            const ctx = this.audioCtx;
            if (this.pcmCursorTime < ctx.currentTime) this.pcmCursorTime = ctx.currentTime;

            // 改进：顺序播放音频块，避免重叠和回声
            while (this.pcmQueue.length) {
                if (this.pcmPaused) {
                    await new Promise(r => setTimeout(r, 10));
                    continue;
                }

                const floatData = this.pcmQueue.shift()!;
                const audioBuffer = ctx.createBuffer(1, floatData.length, 16000);
                audioBuffer.getChannelData(0).set(floatData);
                const src = ctx.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx.destination);

                // 计算播放时间，确保连续播放
                const startAt = Math.max(
                    this.pcmCursorTime,
                    ctx.currentTime + 0.01
                );

                try {
                    src.start(startAt);
                } catch {
                    src.start();
                }

                // 更新播放时间
                const duration = audioBuffer.duration;
                this.pcmCursorTime = startAt + duration;

                // 等待当前音频块播放完成再播放下一个
                await new Promise<void>((resolve) => {
                    src.onended = () => resolve();
                });
            }

            // 所有音频块播放完成，检查是否需要触发onComplete
            this.checkPlaybackComplete();
        } finally {
            this.pcmProcessing = false;
            // 处理完成后再次检查，确保没有遗漏
            setTimeout(() => this.checkPlaybackComplete(), 50);
        }
    }

    /**
     * 调度播放完成检查（延迟检查确保音频播放完成）
     */
    private schedulePlaybackCompleteCheck(): void {
        // 立即检查一次
        this.checkPlaybackComplete();

        // 如果还没有完成，设置定时器继续检查
        if (!this.pcmPlaybackComplete) {
            const checkInterval = setInterval(() => {
                this.checkPlaybackComplete();
                if (this.pcmPlaybackComplete || this.status !== "closed") {
                    clearInterval(checkInterval);
                }
            }, 100); // 每100ms检查一次

            // 设置最大等待时间（10秒）
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.pcmPlaybackComplete) {
                    this.options.onLog?.('warn', {
                        event: 'tts.playback_timeout',
                        message: 'TTS播放完成检查超时，强制触发完成回调'
                    });
                    this.checkPlaybackComplete();
                }
            }, 10000);
        }
    }

    /**
     * 检查播放是否完成并触发onComplete回调
     */
    private checkPlaybackComplete(): void {
        // 调试日志
        this.options.onLog?.('info', {
            event: 'tts.playback_check',
            message: '检查播放完成状态',
            details: {
                status: this.status,
                queueLength: this.pcmQueue.length,
                processing: this.pcmProcessing,
                completed: this.pcmPlaybackComplete
            }
        });

        // 只有在连接已关闭且没有更多音频数据时才触发完成回调
        if (this.status === "closed" && this.pcmQueue.length === 0 && !this.pcmProcessing) {
            if (!this.pcmPlaybackComplete) {
                this.pcmPlaybackComplete = true;
                this.options.onLog?.('info', {
                    event: 'tts.playback_complete',
                    message: 'TTS音频播放完成'
                });
                this.options.onComplete?.();
            }
        }
    }

    // ============== 内置 MP3(MediaSource) 播放 ==============
    private ensureMse() {
        if (this.mse && this.mseSourceBuffer && this.mseAudioEl) return;
        if (typeof window === 'undefined' || typeof MediaSource === 'undefined') return;
        this.mse = new MediaSource();
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.controls = false; // 不挂载到DOM，无界面
        this.mseAudioEl = audioEl;
        audioEl.src = URL.createObjectURL(this.mse);
        // 将隐藏播放器挂到DOM以提高自动播放成功率
        try {
            audioEl.style.display = 'none';
            document.body && document.body.appendChild(audioEl);
        } catch {}
        this.mse.addEventListener('sourceopen', () => {
            if (!this.mse) return;
            if (!this.mseSourceBuffer) {
                this.mseSourceBuffer = this.mse.addSourceBuffer('audio/mpeg');
                this.mseSourceBuffer.mode = 'sequence';
                this.mseSourceBuffer.addEventListener('updateend', () => this.flushMseQueue());
                this.flushMseQueue();
            }
        });
        // 添加播放完成监听
        audioEl.addEventListener('ended', () => {
            this.options.onLog?.('info', {
                event: 'tts.mp3_playback_complete',
                message: 'TTS MP3播放完成'
            });
            this.options.onComplete?.();
        });

        // 为MP3播放添加超时保护
        audioEl.addEventListener('loadstart', () => {
            // 设置MP3播放超时（15秒）
            setTimeout(() => {
                if (this.status === "closed" && !this.pcmPlaybackComplete) {
                    this.options.onLog?.('warn', {
                        event: 'tts.mp3_playback_timeout',
                        message: 'TTS MP3播放超时，强制触发完成回调'
                    });
                    this.options.onComplete?.();
                }
            }, 15000);
        });

        // 开始播放
        void audioEl.play().catch(() => {
            // autoplay might be blocked; optionally bind one-time gesture to resume
            if (this.options.autoplayGesture === false) return;
            const resume = () => {
                try { void audioEl.play(); } catch {}
                off();
            };
            const off = () => {
                try { window.removeEventListener('click', resume, true); } catch {}
                try { window.removeEventListener('touchstart', resume, true); } catch {}
                try { window.removeEventListener('keydown', resume, true); } catch {}
            };
            try {
                window.addEventListener('click', resume, true);
                window.addEventListener('touchstart', resume, true);
                window.addEventListener('keydown', resume, true);
            } catch {}
        });
    }

    private enqueueMp3(chunk: Uint8Array) {
        this.ensureMse();
        if (!this.mseSourceBuffer) {
            this.mseQueue.push(chunk);
            return;
        }
        this.mseQueue.push(chunk);
        this.flushMseQueue();
    }

    private flushMseQueue() {
        if (!this.mseSourceBuffer || this.mseSourceBuffer.updating) return;
        const next = this.mseQueue.shift();
        if (!next) return;
        try {
            // 始终复制成新的 ArrayBuffer，避免 SharedArrayBuffer/偏移与类型不兼容
            const copied = new Uint8Array(next); // copy
            const ab: ArrayBuffer = copied.buffer;
            this.mseSourceBuffer.appendBuffer(ab);
        } catch {
            // 如果 append 异常，丢弃本帧并继续
            this.flushMseQueue();
        }
    }

    private teardownPlayback() {
        // PCM
        this.pcmQueue = [];
        this.pcmCursorTime = 0;
        this.pcmPaused = false;
        try { this.pcmCurrentSource?.stop(); } catch {}
        this.pcmCurrentSource = null;
        if (this.audioCtx) {
            try {
                if (this.audioCtx.state !== 'closed') {
                    this.audioCtx.close();
                }
            } catch {}
            this.audioCtx = null;
        }
        this.pcmProcessing = false;

        // MP3 MSE
        this.mseQueue = [];
        if (this.mseAudioEl) {
            try { this.mseAudioEl.pause(); } catch {}
            try { this.mseAudioEl.src = ''; } catch {}
            this.mseAudioEl = null;
        }
        if (this.mseSourceBuffer) {
            try {
                if (this.mseSourceBuffer.updating) {
                    this.mseSourceBuffer.abort();
                }
            } catch {}
            this.mseSourceBuffer = null;
        }
        if (this.mse) {
            try { if (this.mse.readyState === 'open') this.mse.endOfStream(); } catch {}
            this.mse = null;
        }
    }

    /**
     * 主动请求触发一次自动播放（适用于外部在用户手势中调用）
     */
    public requestAutoplay(): void {
        try { this.mseAudioEl && void this.mseAudioEl.play(); } catch {}
    }

    /** 暂停PCM播放（仅影响内置PCM播放） */
    public pause(): void {
        this.pcmPaused = true;
        try { this.pcmCurrentSource?.stop(); } catch {}
        this.pcmCurrentSource = null;
    }

    /** 恢复PCM播放 */
    public resume(): void {
        this.pcmPaused = false;
        if (!this.pcmProcessing) void this.playPcmQueue();
    }

    /** 停止播放并清空队列 */
    public stop(): void {
        this.pcmPaused = false;
        this.pcmQueue = [];
        this.pcmCursorTime = 0;
        try { this.pcmCurrentSource?.stop(); } catch {}
        this.pcmCurrentSource = null;
    }
}


