/**
 * React 支持
 * 提供React专用的语音识别和合成功能
 */

// 导出React Hooks
export * from './useIat';
export * from './useTts';
export * from './useRtasr';
export * from './useDts';
export * from './useBaseXfyun';
export * from './useIatRecorder';
export * from './useRtasrStream';
export * from './useTtsPlayer';

// 导出核心功能
export * from '../core/BaseXfyunClient';
export * from '../core/IatClient';
export * from '../core/TtsClient';
export * from '../core/RtasrClient';
export * from '../core/DtsClient';

// 导出工具函数
export * from '../utils/audio';
export * from '../utils/errorMap';

// React 特定的类型定义
export interface ReactXfyunProviderProps {
    children: React.ReactNode;
    serverBase: string;
    getAuthCode: () => string;
}

// React Context
import React, { createContext, useContext, useMemo } from 'react';

const XfyunContext = createContext<{
    serverBase: string;
    getAuthCode: () => string;
} | null>(null);

/**
 * React Provider 组件
 */
export function XfyunProvider({ children, serverBase, getAuthCode }: ReactXfyunProviderProps) {
    const value = useMemo(() => ({
        serverBase,
        getAuthCode,
    }), [serverBase, getAuthCode]);

    return React.createElement(
        XfyunContext.Provider,
        { value },
        children
    );
}

/**
 * 使用Xfyun Context的Hook
 */
export function useXfyunContext() {
    const context = useContext(XfyunContext);
    if (!context) {
        throw new Error('useXfyunContext must be used within XfyunProvider');
    }
    return context;
}
