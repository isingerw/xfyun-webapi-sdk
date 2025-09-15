/**
 * 科大讯飞语音识别和合成SDK
 * 支持Vue2/3和React，提供完整的语音处理功能
 *
 * @version 1.0.0
 * @author Singerw Team
 * @license MIT
 */

// 工具函数导出
export {
  toBase64,
  int16ToFloat32,
  bytesToInt16,
  getSharedAudioContext,
  releaseSharedAudioContext,
  calculateRMS,
  calculateLevel,
  createAudioWorkletProcessor,
  createScriptProcessor,
  AUDIO_CONFIG,
  AUDIO_PERFORMANCE
} from "./utils/audio";
export type { AudioFramePayload } from "./utils/audio";

// 错误处理导出
export {
  mapXfyunError,
  isRetryableError,
  getErrorSeverity,
  getErrorType,
  createXfyunError,
  calculateRetryDelay,
  DEFAULT_RECOVERY_STRATEGY
} from "./utils/errorMap";
export type { XfyunError, ErrorRecoveryStrategy } from "./utils/errorMap";
export { ErrorSeverity, ErrorType } from "./utils/errorMap";

// React Hooks 导出
export * from './react/useIat';
export * from './react/useTts';
export * from './react/useRtasr';
export * from './react/useDts';
export * from './react/useBaseXfyun';
export * from './react/useIatRecorder';
export * from './react/useRtasrStream';
export * from './react/useTtsPlayer';
export * from './react/useStreamingTts';

// 核心客户端导出
export * from "./core/IatClient";
export * from "./core/TtsClient";
export * from "./core/StreamingTtsClient";
export * from "./core/RtasrClient";
export * from "./core/DtsClient";
export * from "./core/BaseXfyunClient";
export * from "./core/RtasrConnectionPool";

// 导出工具函数
export * from './utils/audio';
export * from './utils/errorMap';
