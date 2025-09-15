/**
 * 音频帧数据类型
 */
export type AudioFramePayload = ArrayBuffer | Uint8Array | Int16Array;

/**
 * 音频配置常量
 */
export const AUDIO_CONFIG = {
    /** 默认采样率 */
    DEFAULT_SAMPLE_RATE: 16000,
    /** 默认声道数 */
    DEFAULT_CHANNELS: 1,
    /** 默认位深度 */
    DEFAULT_BIT_DEPTH: 16,
    /** 推荐帧大小（40ms） */
    RECOMMENDED_FRAME_SIZE: 1280,
    /** 缓冲区大小 */
    BUFFER_SIZE: 512,
    /** 重采样阈值 */
    RESAMPLE_THRESHOLD: 0.1,
} as const;

/**
 * 音频处理性能优化配置
 */
export const AUDIO_PERFORMANCE = {
    /** 是否启用Web Workers */
    ENABLE_WORKER: typeof Worker !== 'undefined',
    /** 批处理大小 */
    BATCH_SIZE: 10,
    /** 缓存大小 */
    CACHE_SIZE: 100,
    /** 是否启用音频压缩 */
    ENABLE_COMPRESSION: true,
} as const;

/**
 * 校验音频规格是否符合 16kHz/单声道/16bit
 */
export function validateAudioSpec(params: {
    sampleRate: number;
    channels?: number;
    bitDepth?: number;
}): boolean {
    const srOk = Math.abs(params.sampleRate - AUDIO_CONFIG.DEFAULT_SAMPLE_RATE) < 1e-6;
    const chOk = (params.channels ?? AUDIO_CONFIG.DEFAULT_CHANNELS) === AUDIO_CONFIG.DEFAULT_CHANNELS;
    const bdOk = (params.bitDepth ?? AUDIO_CONFIG.DEFAULT_BIT_DEPTH) === AUDIO_CONFIG.DEFAULT_BIT_DEPTH;
    return srOk && chOk && bdOk;
}

/**
 * 将任意采样率/声道的 Float32 PCM 重采样到 16k 单声道，并返回 Int16 PCM
 * - 优先通过 OfflineAudioContext 高质量重采样
 * - 回退到简易线性插值重采样
 */
export async function resampleTo16kMono(
    float32Input: Float32Array,
    inputSampleRate: number,
    channels: number = 1
): Promise<Int16Array> {
    try {
        if (typeof OfflineAudioContext !== 'undefined') {
            const targetSampleRate = AUDIO_CONFIG.DEFAULT_SAMPLE_RATE;
            // 组装多声道为单声道（平均）
            let mono: Float32Array;
            if (channels === 1) {
                mono = float32Input;
            } else {
                const frames = Math.floor(float32Input.length / channels);
                mono = new Float32Array(frames);
                for (let i = 0; i < frames; i++) {
                    let sum = 0;
                    for (let ch = 0; ch < channels; ch++) sum += float32Input[i * channels + ch] || 0;
                    mono[i] = sum / channels;
                }
            }

            const durationSeconds = mono.length / inputSampleRate;
            const offline = new OfflineAudioContext(1, Math.ceil(durationSeconds * targetSampleRate), targetSampleRate);
            const buffer = offline.createBuffer(1, mono.length, inputSampleRate);
            // 避免某些环境下 Float32Array<ArrayBufferLike> 与 Float32Array<ArrayBuffer> 的类型不兼容
            // 使用 getChannelData().set(...) 代替 copyToChannel
            buffer.getChannelData(0).set(mono, 0);
            const src = offline.createBufferSource();
            src.buffer = buffer;
            src.connect(offline.destination);
            src.start(0);
            const rendered = await offline.startRendering();
            const renderedData = rendered.getChannelData(0);
            return float32ToInt16(renderedData);
        }
    } catch {
        // fallthrough to linear
    }

    // 线性插值回退
    const targetSampleRate = AUDIO_CONFIG.DEFAULT_SAMPLE_RATE;
    // 合并到单声道
    let mono: Float32Array;
    if (channels === 1) {
        mono = float32Input;
    } else {
        const frames = Math.floor(float32Input.length / channels);
        mono = new Float32Array(frames);
        for (let i = 0; i < frames; i++) {
            let sum = 0;
            for (let ch = 0; ch < channels; ch++) sum += float32Input[i * channels + ch] || 0;
            mono[i] = sum / channels;
        }
    }

    const ratio = targetSampleRate / inputSampleRate;
    const outLen = Math.floor(mono.length * ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const pos = i / ratio;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const s0 = mono[idx] || 0;
        const s1 = mono[idx + 1] || 0;
        out[i] = s0 + (s1 - s0) * frac;
    }
    return float32ToInt16(out);
}

/**
 * 音频处理缓存
 */
class AudioCache {
    private cache = new Map<string, Float32Array>();
    private maxSize = AUDIO_PERFORMANCE.CACHE_SIZE;

    set(key: string, value: Float32Array): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    get(key: string): Float32Array | undefined {
        return this.cache.get(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

const audioCache = new AudioCache();

/**
 * 音频批处理器
 */
class AudioBatchProcessor {
    private batch: Float32Array[] = [];
    private batchSize = AUDIO_PERFORMANCE.BATCH_SIZE;
    private callback: (data: Float32Array[]) => void;

    constructor(callback: (data: Float32Array[]) => void) {
        this.callback = callback;
    }

    add(data: Float32Array): void {
        this.batch.push(data);
        if (this.batch.length >= this.batchSize) {
            this.flush();
        }
    }

    flush(): void {
        if (this.batch.length > 0) {
            this.callback([...this.batch]);
            this.batch = [];
        }
    }
}

/**
 * 获取音频缓存实例
 */
export function getAudioCache(): AudioCache {
    return audioCache;
}

/**
 * 创建音频批处理器
 */
export function createAudioBatchProcessor(callback: (data: Float32Array[]) => void): AudioBatchProcessor {
    return new AudioBatchProcessor(callback);
}

/**
 * 将音频帧转换为Base64编码
 *
 * @param buffer 音频帧数据
 * @returns Base64编码的字符串
 */
export function toBase64(buffer: AudioFramePayload): string {
    let u8: Uint8Array;

    if (buffer instanceof ArrayBuffer) {
        u8 = new Uint8Array(buffer);
    } else if (buffer instanceof Int16Array) {
        u8 = new Uint8Array(buffer.buffer);
    } else {
        u8 = buffer;
    }

    let binary = "";
    for (let i = 0; i < u8.byteLength; i++) {
        binary += String.fromCharCode(u8[i]);
    }

    return btoa(binary);
}

/**
 * 将Int16数组转换为Float32数组
 *
 * @param int16 Int16数组
 * @returns Float32数组
 */
export function int16ToFloat32(int16: Int16Array): Float32Array {
    const out = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        out[i] = int16[i] / 0x8000;
    }
    return out;
}

/**
 * 将字节数组转换为Int16数组
 *
 * @param bytes 字节数组
 * @returns Int16数组
 */
export function bytesToInt16(bytes: Uint8Array): Int16Array {
    return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

/**
 * 将Float32数组转换为Int16数组
 *
 * @param float32 Float32数组
 * @returns Int16数组
 */
export function float32ToInt16(float32: ArrayLike<number>): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const sample = Math.max(-1, Math.min(1, float32[i] as number));
        int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return int16;
}

/**
 * 计算音频RMS（均方根）值（优化版本）
 *
 * @param samples 音频样本数组
 * @returns RMS值
 */
export function calculateRMS(samples: ArrayLike<number>): number {
    if (samples.length === 0) return 0;

    let sum = 0;
    const len = samples.length;

    // 使用循环展开优化
    for (let i = 0; i < len; i += 4) {
        const s0 = (samples[i] as number) || 0;
        const s1 = (samples[i + 1] as number) || 0;
        const s2 = (samples[i + 2] as number) || 0;
        const s3 = (samples[i + 3] as number) || 0;

        sum += s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3;
    }

    return Math.sqrt(sum / len);
}

/**
 * 计算音频电平（0-100）
 *
 * @param samples 音频样本数组
 * @returns 电平值（0-100）
 */
export function calculateLevel(samples: ArrayLike<number>): number {
    const rms = calculateRMS(samples);
    // 对于16位音频，使用更大的系数来获得更准确的电平
    return Math.min(100, Math.max(0, Math.round(rms * 1000)));
}

// 共享AudioContext实例
let sharedAudioCtx: AudioContext | null = null;
// AudioContext引用计数
let audioContextRefCount = 0;

/**
 * 获取共享的AudioContext实例
 *
 * @param sampleRate 采样率，默认16000
 * @returns AudioContext实例
 */
export function getSharedAudioContext(sampleRate: number = AUDIO_CONFIG.DEFAULT_SAMPLE_RATE): AudioContext {
    if (sharedAudioCtx && sharedAudioCtx.sampleRate === sampleRate) {
        audioContextRefCount++;
        return sharedAudioCtx;
    }

    // 如果存在不同采样率的AudioContext，先释放
    if (sharedAudioCtx) {
        releaseSharedAudioContext();
    }

    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate
    });
    audioContextRefCount = 1;

    return sharedAudioCtx;
}

/**
 * 释放共享的AudioContext实例
 */
export function releaseSharedAudioContext(): void {
    audioContextRefCount--;
    
    if (audioContextRefCount <= 0 && sharedAudioCtx) {
        try {
            // 更严格的状态检查
            if (sharedAudioCtx.state === 'running' || sharedAudioCtx.state === 'suspended') {
                sharedAudioCtx.close();
            }
        } catch (e) {
            console.warn('AudioContext关闭时出错:', e);
        } finally {
            sharedAudioCtx = null;
            audioContextRefCount = 0;
        }
    }
}

/**
 * 获取AudioContext引用计数
 */
export function getAudioContextRefCount(): number {
    return audioContextRefCount;
}

/**
 * 暂停共享的AudioContext
 */
export async function suspendSharedAudioContext(): Promise<void> {
    if (sharedAudioCtx && sharedAudioCtx.state !== 'suspended') {
        try { await sharedAudioCtx.suspend(); } catch {}
    }
}

/**
 * 恢复共享的AudioContext
 */
export async function resumeSharedAudioContext(): Promise<void> {
    if (sharedAudioCtx && sharedAudioCtx.state !== 'running') {
        try { await sharedAudioCtx.resume(); } catch {}
    }
}

/**
 * 创建AudioWorkletNode处理器
 *
 * @param audioCtx AudioContext实例
 * @param onAudioData 音频数据回调函数
 * @returns Promise<AudioWorkletNode>
 */
export async function createAudioWorkletProcessor(
    audioCtx: AudioContext, 
    onAudioData: (data: Float32Array) => void,
    workletBaseUrl?: string
): Promise<AudioWorkletNode> {
    try {
        // 检查AudioWorklet支持
        if (!audioCtx.audioWorklet) {
            throw new Error('AudioWorklet not supported');
        }

        // 加载AudioWorklet模块（支持自定义基址，默认 ./worklet 与 ../worklet）
        const candidates = workletBaseUrl
            ? [`${workletBaseUrl.replace(/\/$/, '')}/audio-processor.js`]
            : ['./worklet/audio-processor.js', '../worklet/audio-processor.js'];
        let loaded = false
        for (const rel of candidates) {
            try {
                const workletUrl = workletBaseUrl ? rel : new URL(rel, import.meta.url).toString();
                await audioCtx.audioWorklet.addModule(workletUrl as any)
                loaded = true
                break
            } catch (_) {
                // try next
            }
        }
        if (!loaded) {
            throw new Error('Failed to load audio-processor worklet from candidates')
        }

        // 创建AudioWorkletNode
        const processor = new AudioWorkletNode(audioCtx, 'audio-processor');

        // 监听音频数据
        processor.port.onmessage = (event: MessageEvent) => {
            if (!event.data) return;
            // 兼容两种消息格式：
            // 1) { type: 'audioData', data: Float32Array }
            // 2) { type: 'audio', samples: Float32Array, rms?: number }
            if (event.data.type === 'audioData' && event.data.data) {
                onAudioData(event.data.data);
            } else if (event.data.type === 'audio' && event.data.samples) {
                onAudioData(event.data.samples);
            }
        };

        return processor;
    } catch (error) {
        console.warn('AudioWorklet不可用，回退到ScriptProcessor:', error);
        throw error;
    }
}

/**
 * 创建ScriptProcessorNode处理器（兼容性回退）
 *
 * @param audioCtx AudioContext实例
 * @param onAudioData 音频数据回调函数
 * @returns ScriptProcessorNode
 */
export function createScriptProcessor(
    audioCtx: AudioContext,
    onAudioData: (data: Float32Array) => void
): ScriptProcessorNode {
    // 根据RTASR API要求：每40ms发送1280字节
    // 16kHz采样率，40ms = 640个样本，但ScriptProcessor需要2的幂次方
    // 使用512作为缓冲区大小，然后进行重采样
    const processor = audioCtx.createScriptProcessor(512, 1, 1);

    processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        onAudioData(new Float32Array(input));
    };

    return processor;
}


