/**
 * AudioWorklet类型声明
 */

declare class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Map<string, Float32Array>): boolean;
}

// 扩展AudioWorkletProcessor以允许更灵活的参数类型
declare class AudioProcessor extends AudioWorkletProcessor {
    process(inputs: Float32Array[][], outputs?: Float32Array[][], parameters?: Map<string, Float32Array>): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

declare global {
    interface AudioWorkletGlobalScope {
        AudioWorkletProcessor: typeof AudioWorkletProcessor;
        registerProcessor: typeof registerProcessor;
    }
}
