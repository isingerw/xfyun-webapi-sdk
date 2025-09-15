# 最佳实践指南

本文档提供了使用科大讯飞WebAPI SDK的最佳实践，帮助您构建高质量、高性能的语音应用。

## 1. 项目结构最佳实践

### 1.1 模块化组织
```typescript
// 推荐的项目结构
src/
├── components/
│   ├── voice/
│   │   ├── VoiceRecorder.tsx
│   │   ├── VoicePlayer.tsx
│   │   └── VoiceSettings.tsx
│   └── ui/
├── hooks/
│   ├── useVoiceRecognition.ts
│   ├── useVoiceSynthesis.ts
│   └── useVoiceSettings.ts
├── services/
│   ├── voiceService.ts
│   └── authService.ts
├── utils/
│   ├── audioUtils.ts
│   └── errorUtils.ts
└── types/
    └── voice.ts
```

### 1.2 类型定义
```typescript
// types/voice.ts
export interface VoiceConfig {
  serverBase: string;
  getAuthCode: () => string;
  business: {
    language: string;
    vad_eos: number;
    ptt: 0 | 1;
  };
}

export interface VoiceRecognitionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
}

export interface VoiceSynthesisOptions {
  text: string;
  voice: string;
  speed: number;
  volume: number;
}
```

## 2. 错误处理最佳实践

### 2.1 统一错误处理
```typescript
// utils/errorUtils.ts
import { mapXfyunError, ErrorSeverity } from 'xfyun-webapi-sdk';

export class VoiceError extends Error {
  constructor(
    message: string,
    public code?: number,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

export function handleVoiceError(error: any): VoiceError {
  if (error instanceof VoiceError) {
    return error;
  }
  
  const mappedError = mapXfyunError(error.code, error.message);
  return new VoiceError(mappedError, error.code);
}
```

### 2.2 错误边界组件
```tsx
// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class VoiceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Voice Error:', error, errorInfo);
    // 发送错误到监控服务
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>语音功能暂时不可用</h2>
          <p>请刷新页面重试</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 2.3 重试机制
```typescript
// hooks/useVoiceRecognition.ts
import { useIat } from 'xfyun-webapi-sdk';
import { useCallback, useRef } from 'react';

export function useVoiceRecognition(config: VoiceConfig) {
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const { status, error, open, sendFrame, close, reset } = useIat({
    ...config,
    maxRetries,
    retryStrategy: {
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 10000,
    },
    onError: (error) => {
      console.error('Voice recognition error:', error);
      // 自定义错误处理
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => {
          reset();
        }, 1000 * retryCountRef.current);
      }
    },
    onOpen: () => {
      retryCountRef.current = 0; // 重置重试计数
    }
  });

  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    reset();
  }, [reset]);

  return {
    status,
    error,
    open,
    sendFrame,
    close,
    retry: handleRetry
  };
}
```

## 3. 性能优化最佳实践

### 3.1 音频处理优化
```typescript
// utils/audioUtils.ts
import { 
  getSharedAudioContext, 
  calculateLevel, 
  createAudioWorkletProcessor 
} from 'xfyun-webapi-sdk';

export class AudioProcessor {
  private audioContext: AudioContext;
  private processor: AudioWorkletNode | null = null;
  private isProcessing = false;

  constructor() {
    this.audioContext = getSharedAudioContext();
  }

  async startProcessing(
    stream: MediaStream,
    onAudioData: (data: Float32Array) => void,
    onLevel: (level: number) => void
  ) {
    if (this.isProcessing) return;

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // 优先使用AudioWorklet
      this.processor = await createAudioWorkletProcessor(
        this.audioContext,
        (audioData) => {
          const level = calculateLevel(audioData);
          onLevel(level);
          onAudioData(audioData);
        }
      );

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isProcessing = true;
    } catch (error) {
      console.warn('AudioWorklet not supported, falling back to ScriptProcessor');
      // 降级到ScriptProcessor
      this.createScriptProcessor(stream, onAudioData, onLevel);
    }
  }

  stopProcessing() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    this.isProcessing = false;
  }

  private createScriptProcessor(
    stream: MediaStream,
    onAudioData: (data: Float32Array) => void,
    onLevel: (level: number) => void
  ) {
    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (event) => {
      const audioData = event.inputBuffer.getChannelData(0);
      const level = calculateLevel(audioData);
      onLevel(level);
      onAudioData(audioData);
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
    this.processor = processor as any;
  }
}
```

### 3.2 内存管理
```typescript
// hooks/useVoiceRecognition.ts
import { useEffect, useRef, useCallback } from 'react';

export function useVoiceRecognition(config: VoiceConfig) {
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stopProcessing();
      audioProcessorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup; // 组件卸载时清理资源
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      if (!audioProcessorRef.current) {
        audioProcessorRef.current = new AudioProcessor();
      }
      
      await audioProcessorRef.current.startProcessing(
        stream,
        (audioData) => {
          // 发送音频数据
          sendFrame(audioData.buffer, false);
        },
        (level) => {
          // 更新音量显示
          setAudioLevel(level);
        }
      );
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [sendFrame]);

  return {
    startRecording,
    stopRecording: cleanup,
    // ... 其他返回值
  };
}
```

### 3.3 连接池管理
```typescript
// services/voiceService.ts
import { RtasrConnectionPool } from 'xfyun-webapi-sdk';

export class VoiceService {
  private connectionPool: RtasrConnectionPool;
  private static instance: VoiceService;

  private constructor() {
    this.connectionPool = new RtasrConnectionPool({
      maxConnections: 5,
      idleTimeout: 30000,
      heartbeatInterval: 10000,
      retryAttempts: 3
    });
  }

  static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  async getConnection() {
    return await this.connectionPool.getConnection();
  }

  releaseConnection(connection: any) {
    this.connectionPool.releaseConnection(connection);
  }
}
```

## 4. 用户体验最佳实践

### 4.1 状态管理
```typescript
// hooks/useVoiceState.ts
import { useState, useCallback } from 'react';

export type VoiceStatus = 'idle' | 'connecting' | 'recording' | 'processing' | 'error';

export function useVoiceState() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
    if (newStatus === 'error') {
      setError('语音功能出现错误');
    } else {
      setError(null);
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    error,
    isEnabled,
    updateStatus,
    reset,
    setIsEnabled
  };
}
```

### 4.2 用户反馈
```tsx
// components/VoiceStatus.tsx
import React from 'react';

interface VoiceStatusProps {
  status: VoiceStatus;
  error?: string | null;
  audioLevel?: number;
}

export function VoiceStatus({ status, error, audioLevel }: VoiceStatusProps) {
  const getStatusText = () => {
    switch (status) {
      case 'idle': return '准备就绪';
      case 'connecting': return '连接中...';
      case 'recording': return '录音中...';
      case 'processing': return '处理中...';
      case 'error': return '错误';
      default: return '未知状态';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return '#52c41a';
      case 'connecting': return '#1890ff';
      case 'recording': return '#ff4d4f';
      case 'processing': return '#faad14';
      case 'error': return '#ff4d4f';
      default: return '#d9d9d9';
    }
  };

  return (
    <div className="voice-status">
      <div 
        className="status-indicator"
        style={{ backgroundColor: getStatusColor() }}
      />
      <span className="status-text">{getStatusText()}</span>
      {audioLevel !== undefined && (
        <div className="audio-level">
          <div 
            className="level-bar"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
      )}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 4.3 权限处理
```typescript
// utils/permissionUtils.ts
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

export function showPermissionDialog() {
  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'permission-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>需要麦克风权限</h3>
        <p>请允许访问麦克风以使用语音功能</p>
        <div class="dialog-actions">
          <button class="btn-cancel">取消</button>
          <button class="btn-allow">允许</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.btn-cancel')?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(false);
    });
    
    dialog.querySelector('.btn-allow')?.addEventListener('click', async () => {
      const granted = await requestMicrophonePermission();
      document.body.removeChild(dialog);
      resolve(granted);
    });
  });
}
```

## 5. 安全最佳实践

### 5.1 认证管理
```typescript
// services/authService.ts
export class AuthService {
  private static readonly TOKEN_KEY = 'voice_auth_token';
  private static readonly TOKEN_EXPIRY_KEY = 'voice_auth_token_expiry';

  static setToken(token: string, expiryTime: number) {
    localStorage.setItem(AuthService.TOKEN_KEY, token);
    localStorage.setItem(AuthService.TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  static getToken(): string | null {
    const token = localStorage.getItem(AuthService.TOKEN_KEY);
    const expiry = localStorage.getItem(AuthService.TOKEN_EXPIRY_KEY);
    
    if (!token || !expiry) return null;
    
    if (Date.now() > parseInt(expiry)) {
      AuthService.clearToken();
      return null;
    }
    
    return token;
  }

  static clearToken() {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.TOKEN_EXPIRY_KEY);
  }

  static isTokenValid(): boolean {
    return AuthService.getToken() !== null;
  }
}
```

### 5.2 数据验证
```typescript
// utils/validationUtils.ts
export function validateAudioData(data: ArrayBuffer): boolean {
  if (!data || data.byteLength === 0) {
    return false;
  }
  
  // 检查音频数据长度
  if (data.byteLength < 1000) {
    console.warn('Audio data too short');
    return false;
  }
  
  // 检查音频数据格式
  if (data.byteLength % 2 !== 0) {
    console.warn('Invalid audio data format');
    return false;
  }
  
  return true;
}

export function validateTextInput(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // 检查文本长度
  if (text.length > 10000) {
    console.warn('Text too long');
    return false;
  }
  
  // 检查特殊字符
  const dangerousChars = /<script|javascript:|on\w+\s*=/i;
  if (dangerousChars.test(text)) {
    console.warn('Potentially dangerous text detected');
    return false;
  }
  
  return true;
}
```

## 6. 测试最佳实践

### 6.1 单元测试
```typescript
// __tests__/voiceService.test.ts
import { renderHook, act } from '@testing-library/react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';

describe('useVoiceRecognition', () => {
  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useVoiceRecognition({
      serverBase: 'http://localhost:8080',
      getAuthCode: () => 'test-token',
      business: { language: 'zh_cn' }
    }));

    expect(result.current.status).toBe('idle');
  });

  it('should handle recording start', async () => {
    const { result } = renderHook(() => useVoiceRecognition({
      serverBase: 'http://localhost:8080',
      getAuthCode: () => 'test-token',
      business: { language: 'zh_cn' }
    }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('recording');
  });
});
```

### 6.2 集成测试
```typescript
// __tests__/integration/voiceIntegration.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceRecorder } from '../components/VoiceRecorder';

describe('Voice Integration', () => {
  it('should complete full voice recognition flow', async () => {
    render(<VoiceRecorder />);
    
    const startButton = screen.getByText('开始录音');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('录音中...')).toBeInTheDocument();
    });
    
    // 模拟音频数据
    // ... 测试逻辑
    
    const stopButton = screen.getByText('停止录音');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(screen.getByText('准备就绪')).toBeInTheDocument();
    });
  });
});
```

## 7. 部署最佳实践

### 7.1 环境配置
```typescript
// config/environment.ts
export const config = {
  development: {
    serverBase: 'http://localhost:8080',
    logLevel: 'debug',
    enableDevTools: true
  },
  production: {
    serverBase: process.env.REACT_APP_SERVER_BASE || 'https://api.example.com',
    logLevel: 'error',
    enableDevTools: false
  }
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env as keyof typeof config];
};
```

### 7.2 构建优化
```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        xfyun: {
          test: /[\\/]node_modules[\\/]xfyun-webapi-sdk[\\/]/,
          name: 'xfyun-sdk',
          chunks: 'all',
        }
      }
    }
  }
};
```

## 8. 监控和日志最佳实践

### 8.1 性能监控
```typescript
// utils/performanceMonitor.ts
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getAverageMetric(name: string): number {
    const values = this.metrics.get(name) || [];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  reportMetrics() {
    const report = {};
    for (const [name, values] of this.metrics) {
      report[name] = {
        average: this.getAverageMetric(name),
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
    console.log('Performance Metrics:', report);
    return report;
  }
}
```

### 8.2 错误监控
```typescript
// utils/errorMonitor.ts
export class ErrorMonitor {
  private static instance: ErrorMonitor;

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  reportError(error: Error, context?: any) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      context
    };

    // 发送到错误监控服务
    this.sendToMonitoringService(errorReport);
  }

  private sendToMonitoringService(report: any) {
    // 实现错误上报逻辑
    console.error('Error Report:', report);
  }
}
```

## 9. 总结

遵循这些最佳实践将帮助您：

1. **提高代码质量**: 通过模块化设计和类型安全
2. **提升用户体验**: 通过错误处理和状态管理
3. **优化性能**: 通过内存管理和连接池
4. **增强安全性**: 通过认证和数据验证
5. **简化维护**: 通过测试和监控

记住，最佳实践是指导原则，不是硬性规则。根据您的具体需求和项目特点，适当调整这些实践。

---

如有疑问或建议，请通过 [Issue](https://github.com/isingerw/xfyun-webapi-sdk/issues) 或邮件联系我们。
