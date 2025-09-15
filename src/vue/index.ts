/**
 * Vue Composables 入口
 *
 * 提供与 React Hooks 等价的 Vue 组合式 API，
 * 覆盖 IAT/TTS/RTASR/DTS 四种能力的最小使用集。
 *
 * 适配：
 * - Vue3：直接使用
 * - Vue2：需搭配 @vue/composition-api
 */
export * from './useBaseXfyun';
export * from './useIat';
export type { IatOptions, UseIatResult } from './useIat';
export * from './useTts';
export type { TtsOptions, UseTtsResult } from './useTts';
export * from './useRtasr';
export type { RtasrOptions, UseRtasrResult } from './useRtasr';
export * from './useDts';
export type { DtsOptions, UseDtsResult } from './useDts';
export * from './useStreamingTts';
export type { UseStreamingTtsOptions, UseStreamingTtsResult } from './useStreamingTts';

// 同步导出核心与工具，方便按需引入（与根入口保持一致）
export * from '../core/BaseXfyunClient';
export * from '../core/IatClient';
export * from '../core/TtsClient';
export * from '../core/StreamingTtsClient';
export * from '../core/RtasrClient';
export * from '../core/DtsClient';
export * from '../utils/audio';
export * from '../utils/errorMap';

// 高阶组合式 API（与 React 版等价）
export * from './useIatRecorder';
export type { UseIatRecorderOptions, UseIatRecorderResult } from './useIatRecorder';
export * from './useRtasrStream';
export type { UseRtasrStreamOptions, UseRtasrStreamResult } from './useRtasrStream';
export * from './useTtsPlayer';
export type { UseTtsPlayerOptions, UseTtsPlayerResult } from './useTtsPlayer';

