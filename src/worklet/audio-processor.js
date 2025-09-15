/**
 * AudioWorklet处理器 - 用于实时音频处理
 * 替代已废弃的ScriptProcessorNode
 */

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // 根据RTASR API要求：每40ms发送1280字节
        // 16kHz采样率，16bit = 2字节，所以1280字节 = 640个样本
        // 使用512作为缓冲区大小，然后进行重采样到640
        this.bufferSize = 512; // 使用2的幂次方
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        // 使用所有必需的参数以符合AudioWorklet规范
        const input = inputs[0];
        if (input && input.length > 0) {
            const inputChannel = input[0];
            
            // 将输入数据添加到缓冲区
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex++;
                
                // 当缓冲区满时，发送数据到主线程
                if (this.bufferIndex >= this.bufferSize) {
                    // 计算RMS值用于音量显示
                    let sum = 0;
                    for (let i = 0; i < this.buffer.length; i++) {
                        sum += this.buffer[i] * this.buffer[i];
                    }
                    const rms = Math.sqrt(sum / this.buffer.length);
                    
                    this.port.postMessage({
                        type: 'audio',
                        samples: new Float32Array(this.buffer),
                        rms: rms
                    });
                    this.bufferIndex = 0;
                }
            }
        }
        
        // 保持处理器运行
        return true;
    }
}

// 注册AudioWorklet处理器
if (typeof registerProcessor !== 'undefined') {
    registerProcessor('audio-processor', AudioProcessor);
}
