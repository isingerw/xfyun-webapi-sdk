import { BaseXfyunClient, BaseXfyunClientOptions } from './BaseXfyunClient';
import { getSharedAudioContext, releaseSharedAudioContext } from '../utils/audio';

export type StreamingTtsStatus = "idle" | "connecting" | "open" | "synthesizing" | "playing" | "paused" | "closed" | "error";

/**
 * StreamingTts 客户端配置
 */
export interface StreamingTtsOptions extends BaseXfyunClientOptions {
    /**
     * 业务参数（发送到服务端的合成参数）
     */
    business: {
        /** 音频编码格式，例如 'raw'（PCM）或 'mp3' */
        aue?: string;
        /** 发音人，示例：'x4_yezi' */
        vcn?: string;
        /** 语速，0-100，默认 50 */
        speed?: number;
        /** 音量，0-100，默认 50（服务端合成音量） */
        volume?: number;
        /** 音调，0-100，默认 50 */
        pitch?: number;
        /** 文本编码，通常为 'utf8' */
        tte?: string;
        /** 采样率及格式，示例：'audio/L16;rate=16000' */
        auf?: string;
        /** 随机数（部分场景使用） */
        rdn?: number;
        /** 引擎类型（部分场景使用） */
        ent?: string;
    };
    
    // 回调函数
    /**
     * 文本接收回调
     * @param text 已追加的原始文本片段
     */
    onTextReceived?: (text: string) => void;
    /**
     * 音频接收回调
     * @param audio 原始音频字节（PCM: 16bit 小端，MP3: 二进制分片）
     */
    onAudioReceived?: (audio: Uint8Array) => void;
    /**
     * 播放状态回调
     * @param isPlaying 是否处于播放中
     */
    onPlaying?: (isPlaying: boolean) => void;
    /** 合成与播放整体完成回调（连接关闭且缓冲播放完毕后触发） */
    onComplete?: () => void;
    /**
     * 错误回调
     * @param error 具有人类可读信息的错误字符串
     */
    onError?: (error: string) => void;
    /**
     * 日志回调
     * @param level 日志级别：'info' | 'warn' | 'error'
     * @param payload 任意结构化日志载荷
     */
    onLog?: (level: 'info' | 'warn' | 'error', payload: any) => void;
    /** WebSocket 连接建立回调（readyState=OPEN） */
    onOpen?: () => void;
    /** WebSocket 连接关闭回调（包括正常关闭与异常关闭） */
    onClose?: () => void;
    /**
     * 客户端状态变化回调
     * @param status 当前状态
     */
    onStatusChange?: (status: StreamingTtsStatus) => void;
    
    // 播放/连接控制
    /** 是否自动播放（MP3/MSE 需在可用时尝试自动播放） */
    autoplay?: boolean;
    /** MP3 播放方式：'mse' 优先 MediaSource，'blob' 走 URL.createObjectURL */
    mp3Playback?: 'mse' | 'blob';
    /** 保活间隔毫秒，默认 30000 */
    keepAliveIntervalMs?: number;
    /** 空闲时（无文本/未结束）也发送保活，默认 false */
    keepAliveWhenIdle?: boolean;
    /** PCM 播放前瞻秒数，默认 0.08 */
    audioScheduleAheadSec?: number;
    /** 在最后一次 appendText 之后，若无新输入则在该毫秒后自动 endText */
    autoEndAfterMs?: number;
    /** 最小日志级别过滤，默认 'info' */
    logLevel?: 'info' | 'warn' | 'error';
    /**
     * 启动重试策略
     * - maxRetries: 最大重试次数（默认 0）
     * - initialDelayMs: 初始延迟（默认 500）
     * - factor: 退避乘数（默认 1.8）
     */
    retry?: { maxRetries?: number; initialDelayMs?: number; factor?: number };
}

/**
 * 流式语音合成客户端
 *
 * - 支持流式文本输入与实时音频播放（PCM/MP3）
 * - 单连接复用，提供暂停、恢复、停止控制
 * - 事件与日志回调丰富，便于生产观测
 */
export class StreamingTtsClient extends BaseXfyunClient<StreamingTtsOptions> {
    private ws: WebSocket | null = null;
    public status: StreamingTtsStatus = "idle";
    
    // 文本管理
    private textBuffer: string = '';
    private textEnded: boolean = false;
    public override sessionId: string = '';
    private appId: string = '';
    private keepAliveInterval: NodeJS.Timeout | null = null;
    private closing: boolean = false;
    private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    
    // 音频播放管理
    private audioCtx: AudioContext | null = null;
    private pcmQueue: Float32Array[] = [];
    private pcmProcessing = false;
    private pcmPaused = false;
    private pcmCurrentSource: AudioBufferSourceNode | null = null;
    private pcmScheduleAheadSec = 0.08;
    private pcmCursorTime = 0;
    private pcmPlaybackComplete = false;
    private gainNode: GainNode | null = null;
    
    // MP3播放管理
    private mse: MediaSource | null = null;
    private mseAudioEl: HTMLAudioElement | null = null;
    private mseSourceBuffer: SourceBuffer | null = null;
    private mseQueue: Uint8Array[] = [];
    private mseAppending = false;
    // blob 回退
    private blobAudioEl: HTMLAudioElement | null = null;
    private blobChunks: Uint8Array[] = [];
    
    constructor(options: StreamingTtsOptions) {
        super(options);
        if (typeof options.audioScheduleAheadSec === 'number') {
            this.pcmScheduleAheadSec = Math.max(0, options.audioScheduleAheadSec);
        }
    }
    
    /**
     * 写日志，遵循 logLevel 最小级别过滤
     * @param level 日志级别
     * @param payload 结构化日志内容
     */
    private log(level: 'info' | 'warn' | 'error', payload: any): void {
        const order = { info: 0, warn: 1, error: 2 } as const;
        const min = this.options.logLevel ?? 'info';
        if (order[level] >= order[min]) {
            this.options.onLog?.(level, payload);
        }
    }

    /**
     * 统一更新状态并派发 onStatusChange 回调
     * @param next 下一个状态
     */
    private updateStatus(next: StreamingTtsStatus): void {
        if (this.status === next) return;
        this.status = next;
        this.options.onStatusChange?.(next);
    }

    /**
     * UTF-8 安全的 Base64 编码
     * @param text 原始字符串
     * @returns Base64 字符串
     */
    private encodeBase64Utf8(text: string): string {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * 设置本地播放音量（0.0 - 1.0）
     * @param volume 音量值
     */
    public setLocalVolume(volume: number): void {
        if (!this.audioCtx) {
            this.audioCtx = getSharedAudioContext(16000);
        }
        if (!this.gainNode) {
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.connect(this.audioCtx.destination);
        }
        this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }

    /**
     * 重置自动结束计时器（用于 autoEndAfterMs）
     */
    private resetInactivityTimer(): void {
        if (!this.options.autoEndAfterMs) return;
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        const delay = Math.max(1000, this.options.autoEndAfterMs);
        this.inactivityTimer = setTimeout(() => {
            try {
                if ((this.status === 'open' || this.status === 'synthesizing') && !this.textEnded) {
                    this.endText();
                    this.log('info', { event: 'streaming_tts.auto_end', message: '自动结束文本输入' });
                }
            } catch {}
        }, delay);
    }
    
    /**
     * 开始流式合成，建立 WebSocket 连接并预热播放资源
     * @returns Promise，在连接建立或失败后决议
     */
    async start(): Promise<void> {
        if (this.status !== 'idle') {
            throw new Error('StreamingTtsClient is not in idle state');
        }
        
        this.reset();
        this.updateStatus('connecting');
        this.closing = false;
        
        // 简单的初始连接重试策略
        const maxRetries = this.options.retry?.maxRetries ?? 0;
        const factor = this.options.retry?.factor ?? 1.8;
        let delay = this.options.retry?.initialDelayMs ?? 500;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.openWebSocket();
                return;
            } catch (e) {
                if (attempt === maxRetries) {
                    this.handleError(e instanceof Error ? e.message : '启动连接失败');
                    throw e;
                }
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(10000, Math.floor(delay * factor));
                this.log('warn', { event: 'streaming_tts.retrying', attempt: attempt + 1, nextDelay: delay });
            }
        }
    }

    /**
     * 建立 WebSocket 并绑定事件
     * @returns Promise，在 onopen 时 resolve，若连接未能打开则 reject
     */
    private async openWebSocket(): Promise<void> {
        const signData = await this.getSignature("tts");
        const { url, appId } = signData;
        const ws = new WebSocket(url);
        this.ws = ws;

        return new Promise<void>((resolve, reject) => {
            let opened = false;

            ws.onopen = () => {
                opened = true;
                this.updateStatus('open');
                this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                this.appId = appId;
                
                // 生成业务参数（一次，后续发送时复用构造器）
                const business: any = this.buildBusinessParams();
                
                this.log('info', {
                    event: 'streaming_tts.open',
                    sessionId: this.sessionId,
                    appId,
                    timestamp: Date.now(),
                    message: '流式TTS连接已建立'
                });
                
                // 如果是 MP3 并选择 MSE，预先初始化播放器
                if (this.options.autoplay !== false && 
                    (this.options.mp3Playback ?? "mse") === "mse" && 
                    business.aue === "mp3") {
                    this.ensureMse();
                } else if ((this.options.mp3Playback ?? 'mse') === 'blob' && business.aue === 'mp3') {
                    this.ensureBlobAudio();
                }
                
                // 启动连接保活机制
                this.startKeepAlive();
                
                this.options.onOpen?.();
                resolve();
            };

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    
                    this.log('info', {
                        event: 'streaming_tts.message',
                        message: '收到WebSocket消息',
                        data: msg
                    });
                    
                    if (msg.code !== 0) {
                        this.processXfyunError(msg.code, msg.message || "流式TTS失败");
                        ws.close();
                        return;
                    }
                    
                    const audio = msg.data?.audio;
                    if (audio) {
                        this.processAudioData(audio);
                        this.log('info', {
                            event: 'streaming_tts.audio_received',
                            message: `收到音频数据: ${audio.length} 字符`,
                            audioLength: audio.length
                        });
                        
                        // 首包音频到达时，标记进入合成中
                        if (this.status === 'open') {
                            this.updateStatus('synthesizing');
                        }
                    } else {
                        this.log('info', {
                            event: 'streaming_tts.non_audio_message',
                            message: '收到非音频消息',
                            data: msg.data
                        });
                    }
                } catch (error) {
                    this.handleError(`流式TTS消息解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            };
            
            ws.onclose = (event) => {
                if (this.closing && this.status === 'idle') {
                    // stop/close 已优先将状态置为 idle
                } else {
                    this.updateStatus('closed');
                }
                this.stopKeepAlive();
                this.log('info', {
                    event: 'streaming_tts.closed',
                    message: `流式TTS连接已关闭: ${event.code} ${event.reason || ''}`,
                    code: event.code,
                    reason: event.reason
                });
                this.schedulePlaybackCompleteCheck();
                
                this.options.onClose?.();
                this.closing = false;
                if (!opened) {
                    reject(new Error('WebSocket closed before open'));
                }
            };
            
            ws.onerror = () => {
                this.updateStatus('error');
                this.handleError("流式TTS连接错误");
                if (!opened) {
                    try { ws.close(); } catch {}
                    reject(new Error('WebSocket error'));
                }
            };
        });
    }
    
    /**
     * 追加文本片段（status=1）
     * @param text 文本片段
     */
    appendText(text: string): void {
        if (this.status !== 'open' && this.status !== 'synthesizing' && this.status !== 'playing' && this.status !== 'paused') {
            throw new Error('StreamingTtsClient is not ready for text input');
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket connection is not established');
        }
        
        this.textBuffer += text;
        this.resetInactivityTimer();
        
        const payload = {
            common: { app_id: this.appId },
            business: this.buildBusinessParams(),
            data: {
                status: 1,
                text: this.encodeBase64Utf8(text),
            },
        };
        
        this.ws.send(JSON.stringify(payload));
        
        this.log('info', {
            event: 'streaming_tts.text_sent',
            message: '发送文本数据',
            payload: payload
        });
        
        this.options.onTextReceived?.(text);
        this.log('info', {
            event: 'streaming_tts.text_appended',
            message: `追加文本: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
            textLength: text.length
        });
    }
    
    /**
     * 结束文本输入（status=2）
     */
    endText(): void {
        if (this.status !== 'open' && this.status !== 'synthesizing') {
            throw new Error('StreamingTtsClient is not ready for text input');
        }
        if (!this.ws) {
            throw new Error('WebSocket connection is not established');
        }
        
        this.textEnded = true;
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        
        const payload = {
            common: { app_id: this.appId },
            business: this.buildBusinessParams(),
            data: {
                status: 2,
                text: this.encodeBase64Utf8(''),
            },
        };
        
        this.ws.send(JSON.stringify(payload));
        
        this.log('info', {
            event: 'streaming_tts.text_ended',
            message: '文本输入已结束',
            totalTextLength: this.textBuffer.length
        });
    }
    
    /**
     * 暂停播放（仅在 playing 状态有效）
     */
    pause(): void {
        if (this.status === 'playing') {
            this.pcmPaused = true;
            this.updateStatus('paused');
            
            if (this.pcmCurrentSource) {
                this.pcmCurrentSource.stop();
                this.pcmCurrentSource = null;
            }
            
            this.options.onPlaying?.(false);
            this.log('info', {
                event: 'streaming_tts.paused',
                message: '播放已暂停'
            });
        }
    }
    
    /**
     * 恢复播放（仅在 paused 状态有效）
     */
    resume(): void {
        if (this.status === 'paused') {
            this.pcmPaused = false;
            this.updateStatus('playing');
            
            // 继续处理音频队列
            void this.playPcmQueue();
            
            this.options.onPlaying?.(true);
            this.log('info', {
                event: 'streaming_tts.resumed',
                message: '播放已恢复'
            });
        }
    }
    
    /**
     * 停止合成与播放，复位到 idle
     */
    stop(): void {
        this.stopKeepAlive();
        this.closing = true;
        
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        
        this.pcmPaused = true;
        this.pcmQueue = [];
        this.textBuffer = '';
        this.textEnded = false;
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        
        if (this.pcmCurrentSource) {
            try { this.pcmCurrentSource.stop(); } catch {}
            this.pcmCurrentSource = null;
        }
        
        this.updateStatus('idle');
        this.options.onPlaying?.(false);
        this.log('info', {
            event: 'streaming_tts.stopped',
            message: '流式TTS已停止'
        });
    }
    
    /**
     * 关闭连接并释放音频相关资源
     */
    public override close(): void {
        this.stop();
        // 释放MSE与audio元素资源
        if (this.mseAudioEl) {
            try { this.mseAudioEl.pause(); } catch {}
            try { URL.revokeObjectURL(this.mseAudioEl.src); } catch {}
            try { this.mseAudioEl.remove(); } catch {}
        }
        if (this.mseSourceBuffer) {
            try { this.mseSourceBuffer.abort(); } catch {}
        }
        this.mseQueue = [];
        this.mseAppending = false;
        this.mseSourceBuffer = null;
        this.mse = null;
        this.mseAudioEl = null;
        // 断开GainNode
        if (this.gainNode) {
            try { this.gainNode.disconnect(); } catch {}
            this.gainNode = null;
        }
        // 释放blob音频资源
        if (this.blobAudioEl) {
            try { this.blobAudioEl.pause(); } catch {}
            try { URL.revokeObjectURL(this.blobAudioEl.src); } catch {}
            try { this.blobAudioEl.remove(); } catch {}
            this.blobAudioEl = null;
        }
        this.blobChunks = [];
        
        releaseSharedAudioContext();
    }
    
    /** 获取当前状态 */
    getStatus(): StreamingTtsStatus {
        return this.status;
    }
    
    /** 是否处于连接态（open/synthesizing/playing/paused） */
    isConnected(): boolean {
        return this.status === 'open' || this.status === 'synthesizing' || this.status === 'playing' || this.status === 'paused';
    }
    
    /** 是否处于播放态 */
    isPlaying(): boolean {
        return this.status === 'playing';
    }
    
    /**
     * 启动连接保活机制
     */
    private startKeepAlive(): void {
        this.stopKeepAlive(); // 先停止现有的保活
        const interval = typeof this.options.keepAliveIntervalMs === 'number' ? this.options.keepAliveIntervalMs : 30000;
        const allowWhenIdle = !!this.options.keepAliveWhenIdle;
        
        this.keepAliveInterval = setInterval(() => {
            // 空闲时根据配置决定是否发送心跳
            if (allowWhenIdle || this.textBuffer.length > 0 || this.textEnded) {
                this.sendKeepAliveData();
            }
        }, Math.max(1000, interval));
    }
    
    /** 停止连接保活 */
    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }
    
    /**
     * 发送保活数据（status=0）
     */
    private sendKeepAliveData(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = {
                common: { app_id: this.appId },
                business: this.buildBusinessParams(),
                data: { 
                    status: 0,
                    text: this.encodeBase64Utf8('') // 空文本，但字段必需
                }
            };
            
            this.ws.send(JSON.stringify(payload));
            
            this.log('info', {
                event: 'streaming_tts.keepalive_data',
                message: '发送保活数据'
            });
        }
    }
    
    /**
     * 构建业务参数（含默认值与可选项）
     * @returns 业务参数对象
     */
    private buildBusinessParams(): any {
        const currentBusiness = this.options.business || {};
        return {
            aue: currentBusiness.aue || "raw",
            vcn: currentBusiness.vcn || "x4_yezi",
            speed: currentBusiness.speed ?? 50,
            volume: currentBusiness.volume ?? 50,
            pitch: currentBusiness.pitch ?? 50,
            tte: currentBusiness.tte || "utf8",
            auf: currentBusiness.auf || "audio/L16;rate=16000",
            ...(currentBusiness.rdn !== undefined && { rdn: currentBusiness.rdn }),
            ...(currentBusiness.ent !== undefined && { ent: currentBusiness.ent }),
        };
    }
    
    /** 根据业务配置将音频交给对应处理器 */
    private processAudioData(audio: string): void {
        const currentBusiness = this.options.business || {};
        const aue = currentBusiness.aue || "raw";
        
        if (aue === "raw") {
            this.processPcmAudio(audio);
        } else if (aue === "mp3") {
            this.processMp3Audio(audio);
        }
    }
    
    /**
     * 处理 PCM 音频（16-bit 小端）并推入播放队列
     * @param audio Base64 字符串形式的音频数据
     */
    private processPcmAudio(audio: string): void {
        try {
            const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
            const samples = Math.floor(audioBytes.length / 2);
            const float32 = new Float32Array(samples);
            const view = new DataView(audioBytes.buffer);
            
            for (let i = 0; i < samples; i++) {
                // 16-bit PCM → Float32 [-1, 1]
                float32[i] = view.getInt16(i * 2, true) / 0x8000;
            }
            
            this.pcmQueue.push(float32);
            void this.playPcmQueue();
            
            this.options.onAudioReceived?.(audioBytes);
        } catch (error) {
            this.handleError(`PCM音频处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    
    /**
     * 处理 MP3 音频：优先 MSE，失败则 blob 兜底
     * @param audio Base64 字符串形式的 MP3 数据分片
     */
    private processMp3Audio(audio: string): void {
        try {
            const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
            if ((this.options.mp3Playback ?? 'mse') === 'mse' && typeof MediaSource !== 'undefined') {
                this.mseQueue.push(audioBytes);
                this.flushMseQueue();
            } else {
                // blob 兜底：收集分片，结束后统一播放
                this.blobChunks.push(audioBytes);
            }
            
            this.options.onAudioReceived?.(audioBytes);
        } catch (error) {
            this.handleError(`MP3音频处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    
    /**
     * 批量调度 PCM 队列，提高连贯性并降低卡顿
     */
    private async playPcmQueue(): Promise<void> {
        if (this.pcmProcessing) return;
        this.pcmProcessing = true;
        
        try {
            if (!this.audioCtx) {
                this.audioCtx = getSharedAudioContext(16000);
            }
            if (!this.gainNode) {
                this.gainNode = this.audioCtx.createGain();
                this.gainNode.connect(this.audioCtx.destination);
            }
            
            const ctx = this.audioCtx;
            if (this.pcmCursorTime < ctx.currentTime) {
                this.pcmCursorTime = ctx.currentTime;
            }
            
            const batchSize = 3;
            while (this.pcmQueue.length) {
                if (this.pcmPaused) {
                    await new Promise(r => setTimeout(r, 10));
                    continue;
                }
                
                const batch = this.pcmQueue.splice(0, batchSize);
                const promises = batch.map((floatData, index) => {
                    return new Promise<void>((resolve) => {
                        const audioBuffer = ctx.createBuffer(1, floatData.length, 16000);
                        audioBuffer.getChannelData(0).set(floatData);
                        const src = ctx.createBufferSource();
                        src.buffer = audioBuffer;
                        src.connect(this.gainNode!);
                        
                        // 使用可配置的前瞻时间，降低调度抖动
                        const startAt = Math.max(
                            this.pcmCursorTime + (index * 0.01),
                            ctx.currentTime + (this.pcmScheduleAheadSec || 0.002)
                        );
                        
                        try {
                            src.start(startAt);
                        } catch {
                            src.start();
                        }
                        
                        this.pcmCurrentSource = src;
                        const duration = audioBuffer.duration;
                        this.pcmCursorTime = Math.max(this.pcmCursorTime, startAt + duration);
                        
                        src.onended = () => resolve();
                    });
                });
                
                await Promise.all(promises);
                
                if (this.status === 'synthesizing') {
                    this.updateStatus('playing');
                    this.options.onPlaying?.(true);
                }
            }
            
            this.checkPlaybackComplete();
        } finally {
            this.pcmProcessing = false;
            setTimeout(() => this.checkPlaybackComplete(), 50);
        }
    }
    
    /** 触发播放完成检查的定时流程 */
    private schedulePlaybackCompleteCheck(): void {
        this.checkPlaybackComplete();
        
        if (!this.pcmPlaybackComplete) {
            const checkInterval = setInterval(() => {
                this.checkPlaybackComplete();
                if (this.pcmPlaybackComplete || this.status !== "closed") {
                    clearInterval(checkInterval);
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.pcmPlaybackComplete) {
                    this.log('warn', {
                        event: 'streaming_tts.playback_timeout',
                        message: '流式TTS播放完成检查超时，强制触发完成回调'
                    });
                    this.checkPlaybackComplete();
                }
            }, 10000);
        }
    }
    
    /**
     * 在连接 closed 且缓冲播放完毕时触发完成回调
     */
    private checkPlaybackComplete(): void {
        if (this.status === "closed" && this.pcmQueue.length === 0 && !this.pcmProcessing && this.textEnded) {
            if (!this.pcmPlaybackComplete) {
                this.pcmPlaybackComplete = true;
                // 如果是blob播放，关闭后开始一次性播放
                if (this.blobChunks.length && !this.mseAudioEl) {
                    // 合并所有 Uint8Array 分片为一个连续的 ArrayBuffer，避免 SharedArrayBuffer 类型问题
                    const totalLen = this.blobChunks.reduce((n, u) => n + u.byteLength, 0);
                    const merged = new Uint8Array(totalLen);
                    let offsetPos = 0;
                    for (const u of this.blobChunks) {
                        merged.set(u, offsetPos);
                        offsetPos += u.byteLength;
                    }
                    const all = new Blob([merged.buffer], { type: 'audio/mpeg' });
                    this.ensureBlobAudio();
                    if (this.blobAudioEl) {
                        try { URL.revokeObjectURL(this.blobAudioEl.src); } catch {}
                        this.blobAudioEl.src = URL.createObjectURL(all);
                        void this.blobAudioEl.play().catch(() => {});
                    }
                }
                this.log('info', {
                    event: 'streaming_tts.playback_complete',
                    message: '流式TTS音频播放完成'
                });
                this.options.onComplete?.();
            }
        }
    }
    
    /**
     * 初始化 MSE 播放器，不支持时自动降级为 blob
     */
    private ensureMse(): void {
        if (this.mse && this.mseSourceBuffer && this.mseAudioEl) return;
        if (typeof window === 'undefined' || typeof MediaSource === 'undefined') {
            this.ensureBlobAudio();
            return;
        }
        
        const audioEl = document.createElement('audio');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        
        this.mseAudioEl = audioEl;
        this.mse = new MediaSource();
        audioEl.src = URL.createObjectURL(this.mse);
        
        this.mse.addEventListener('sourceopen', () => {
            if (!this.mse) return;
            if (!this.mseSourceBuffer) {
                this.mseSourceBuffer = this.mse.addSourceBuffer('audio/mpeg');
                this.mseSourceBuffer.mode = 'sequence';
                this.flushMseQueue();
            }
        });
        
        audioEl.addEventListener('ended', () => {
            this.log('info', {
                event: 'streaming_tts.mp3_playback_complete',
                message: '流式TTS MP3播放完成'
            });
            this.options.onComplete?.();
        });
        
        void audioEl.play().catch(() => {
            // autoplay 可能被阻止
        });
    }

    /**
     * 初始化 blob 播放器
     */
    private ensureBlobAudio(): void {
        if (this.blobAudioEl) return;
        const audioEl = document.createElement('audio');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.blobAudioEl = audioEl;
    }
    
    /**
     * 刷新 MSE 队列，采用一次性 updateend 监听避免重复注册
     */
    private flushMseQueue(): void {
        if (!this.mseSourceBuffer || this.mseAppending || this.mseQueue.length === 0) return;
        
        this.mseAppending = true;
        const chunk = this.mseQueue.shift()!;
        this.mseSourceBuffer.appendBuffer(chunk as BufferSource);
        
        this.mseSourceBuffer.addEventListener('updateend', () => {
            this.mseAppending = false;
            this.flushMseQueue();
        }, { once: true });
    }
    
    /**
     * 统一处理讯飞错误
     */
    protected override processXfyunError(code?: number, message?: string, _sid?: string, _extra?: Record<string, any>): string {
        const errorMsg = `讯飞TTS错误 ${code}: ${message}`;
        this.handleError(errorMsg);
        return errorMsg;
    }
    
    /**
     * 设置错误状态并分发错误回调与日志
     * @param message 错误详情
     */
    protected override handleError(message: string): void {
        this.updateStatus('error');
        this.options.onError?.(message);
        this.log('error', {
            event: 'streaming_tts.error',
            message
        });
    }
    
    /**
     * 重置内部状态与资源，供 start 前或 stop/close 使用
     */
    public override reset(): void {
        this.stopKeepAlive();
        this.status = 'idle';
        this.textBuffer = '';
        this.textEnded = false;
        this.pcmQueue = [];
        this.pcmProcessing = false;
        this.pcmPaused = false;
        this.pcmPlaybackComplete = false;
        this.pcmCurrentSource = null;
        this.pcmCursorTime = 0;
        if (this.gainNode) {
            try { this.gainNode.disconnect(); } catch {}
            this.gainNode = null;
        }
        this.mseQueue = [];
        this.mseAppending = false;
        if (this.mseAudioEl) {
            try { this.mseAudioEl.pause(); } catch {}
            try { URL.revokeObjectURL(this.mseAudioEl.src); } catch {}
            try { this.mseAudioEl.remove(); } catch {}
        }
        if (this.mseSourceBuffer) {
            try { this.mseSourceBuffer.abort(); } catch {}
        }
        this.mseSourceBuffer = null;
        this.mse = null;
        this.mseAudioEl = null;
        if (this.blobAudioEl) {
            try { this.blobAudioEl.pause(); } catch {}
            try { URL.revokeObjectURL(this.blobAudioEl.src); } catch {}
            try { this.blobAudioEl.remove(); } catch {}
            this.blobAudioEl = null;
        }
        this.blobChunks = [];
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        this.closing = false;
    }
}
