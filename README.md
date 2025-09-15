# 科大讯飞语音识别和合成 SDK

<div align="center">

[![npm version](https://img.shields.io/npm/v/xfyun-webapi-sdk.svg)](https://www.npmjs.com/package/xfyun-webapi-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/isingerw/xfyun-webapi-sdk)
[![Downloads](https://img.shields.io/npm/dm/xfyun-webapi-sdk.svg)](https://www.npmjs.com/package/xfyun-webapi-sdk)

一个功能完整的科大讯飞语音识别和语音合成 SDK，支持 Vue 2/3 和 React，提供现代化的 TypeScript 支持和优秀的开发体验。

[快速开始](#快速开始) • [文档](#文档) • [示例](#示例) • [贡献](#贡献) • [许可证](#许可证)

</div>

## ✨ 特性

- 🚀 **多框架支持** - 同时支持 Vue 2/3 和 React
- 🎯 **完整功能** - 支持语音识别(IAT)、语音合成(TTS)、实时语音识别(RTASR)、长文本合成(DTS)
- 💻 **TypeScript** - 完整的类型定义和智能提示
- 🛠️ **易于使用** - 简洁的 API 设计和丰富的配置选项
- 🎵 **音频处理** - 内置音频处理工具和性能优化
- 🔄 **错误处理** - 完善的错误处理和重试机制
- 🌐 **现代浏览器** - 支持 WebSocket、Web Audio API、MediaRecorder 等现代特性

## 📚 文档

- [📖 完整文档](README.md) - 详细的使用说明和API文档
- [🏗️ 项目架构](ARCHITECTURE.md) - 项目架构和设计原则
- [🚀 快速开始](QUICK_START.md) - 5分钟快速上手指南
- [💡 最佳实践](BEST_PRACTICES.md) - 开发和使用的最佳实践
- [📋 发布说明](RELEASE_NOTES.md) - 版本更新和发布说明
- [📊 项目总结](PROJECT_SUMMARY.md) - 项目特性和技术栈介绍
- [🤝 贡献指南](CONTRIBUTING.md) - 如何参与项目贡献

## 特性

- **多框架支持** - 同时支持 Vue 2/3 和 React
- **完整功能** - 支持语音识别(IAT)、语音合成(TTS)、实时语音识别(RTASR)、长文本合成(DTS)
- **TypeScript** - 完整的类型定义和智能提示
- **易于使用** - 简洁的 API 设计和丰富的配置选项
- **音频处理** - 内置音频处理工具和性能优化
- **错误处理** - 完善的错误处理和重试机制
- **现代浏览器** - 支持 WebSocket、Web Audio API、MediaRecorder 等现代特性

## 开源地址

- **前端 SDK + React/Vue Demo**: [https://github.com/isingerw/xfyun-webapi-sdk](https://github.com/isingerw/xfyun-webapi-sdk)
- **后端签名服务**: [https://github.com/isingerw/xfyun-webapi](https://github.com/isingerw/xfyun-webapi)

## 安装

```bash
# npm
npm install xfyun-webapi-sdk

# yarn
yarn add xfyun-webapi-sdk

# pnpm
pnpm add xfyun-webapi-sdk
```

## 快速开始

### React 使用示例

```tsx
import React, { useState } from 'react';
import { useIat, useTts } from 'xfyun-webapi-sdk';

function VoiceApp() {
  const [text, setText] = useState('');
  
  // 语音识别
  const { status: iatStatus, open: openIat, sendFrame, close: closeIat } = useIat({
    serverBase: 'http://localhost:8083',
    getAuthCode: () => 'your-auth-token',
    onResult: (result, isFinal) => {
      if (isFinal) {
        setText(result);
      }
    }
  });

  // 语音合成
  const { status: ttsStatus, speak, stop: stopTts } = useTts({
    serverBase: 'http://localhost:8083',
    getAuthCode: () => 'your-auth-token',
    business: {
      vcn: 'x4_mingge',
      speed: 50,
      volume: 50
    }
  });

  const handleSpeak = () => {
    if (text) {
      speak(text);
    }
  };

  return (
    <div>
      <button onClick={openIat}>开始识别</button>
      <button onClick={closeIat}>停止识别</button>
      <p>识别结果: {text}</p>
      
      <button onClick={handleSpeak}>播放语音</button>
      <button onClick={stopTts}>停止播放</button>
    </div>
  );
}
```

### Vue 3 使用示例

```vue
<template>
  <div>
    <button @click="startRecording" :disabled="recording">开始录音</button>
    <button @click="stopRecording" :disabled="!recording">停止录音</button>
    <p>识别结果: {{ recognizedText }}</p>
    
    <button @click="speakText" :disabled="!recognizedText">播放语音</button>
    <button @click="stopSpeaking">停止播放</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useIat, useTts } from 'xfyun-webapi-sdk';

const recognizedText = ref('');
const recording = ref(false);

// 语音识别
const { open: openIat, sendFrame, close: closeIat } = useIat({
  serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
  onResult: (result, isFinal) => {
    if (isFinal) {
      recognizedText.value = result;
    }
  }
});

// 语音合成
const { speak, stop: stopTts } = useTts({
  serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
  business: {
    vcn: 'x4_mingge',
    speed: 50,
    volume: 50
  }
});

const startRecording = async () => {
  await openIat();
  recording.value = true;
  // 这里需要集成录音功能
};

const stopRecording = () => {
  closeIat();
  recording.value = false;
};

const speakText = () => {
  if (recognizedText.value) {
    speak(recognizedText.value);
  }
};

const stopSpeaking = () => {
  stopTts();
};
</script>
```

## 核心功能

### 1. 语音识别 (IAT)

在线语音听写，支持实时语音转文字。

```typescript
import { useIat } from 'xfyun-webapi-sdk';

const { status, error, open, sendFrame, close, reset } = useIat({
  serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
  business: {
    language: 'zh_cn',        // 语种
    domain: 'iat',            // 业务领域
    accent: 'mandarin',       // 方言/口音
    vad_eos: 2000,           // 静音断句阈值(ms)
    dwa: 'wpgs',             // 动态修正开关
    ptt: 1,                  // 返回标点
    vinfo: 1,                // 返回字级别信息
    rst: 'json',             // 返回结果格式
    rlang: 'zh_cn',          // 返回结果语言
    nbest: 1,                // 候选结果数量
    wbest: 3                 // 候选词数量
  },
  onResult: (text, isFinal) => {
    console.log('识别结果:', text, '是否最终结果:', isFinal);
  },
  onError: (error) => {
    console.error('识别错误:', error);
  },
  maxRetries: 3,             // 最大重试次数
  heartbeatMs: 30000         // 心跳间隔
});
```

### 2. 语音合成 (TTS)

文本转语音，支持多种发音人和参数配置。

```typescript
import { useTts } from 'xfyun-webapi-sdk';

const { status, error, speak, stop, level, reset } = useTts({
  serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
  business: {
    aue: 'raw',              // 音频编码 (raw/mp3/speex/opus)
    vcn: 'x4_mingge',        // 发音人
    speed: 50,               // 语速 (0-100)
    volume: 50,              // 音量 (0-100)
    pitch: 50,               // 音调 (0-100)
    rdn: 0,                  // 数字发音风格
    tte: 'utf8',             // 文本编码
    auf: 'audio/L16;rate=16000', // 音频封装格式
    ent: 'general'           // 音库领域
  },
  onLevel: (level) => {
    console.log('音量电平:', level);
  },
  onComplete: () => {
    console.log('合成完成');
  },
  autoplay: true,            // 自动播放
  mp3Playback: 'mse',        // MP3播放策略
  autoplayGesture: true      // 自动播放手势恢复
});
```

### 3. 实时语音识别 (RTASR)

实时语音识别，支持流式识别和连接池管理。

```typescript
import { useRtasr } from 'xfyun-webapi-sdk';

const { status, error, open, sendFrame, close, resetSession, retryConnection } = useRtasr({
    serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
    business: { 
    language: 'zh_cn',       // 语种
    domain: 'rtasr',         // 业务领域
    accent: 'mandarin',      // 方言/口音
    vad_eos: 2000,          // 静音断句阈值
    dwa: 'wpgs',            // 动态修正
    ptt: 1,                 // 返回标点
    vinfo: 1,               // 字级别信息
    rst: 'json',            // 结果格式
    rlang: 'zh_cn',         // 结果语言
    nbest: 1,               // 候选结果数
    wbest: 3                // 候选词数
  },
  onResult: (text, isFinal) => {
    console.log('实时识别结果:', text, '是否最终:', isFinal);
  },
  onError: (error) => {
    console.error('识别错误:', error);
  },
  maxRetries: 3,            // 最大重试次数
  heartbeatMs: 30000        // 心跳间隔
});
```

### 4. 长文本语音合成 (DTS)

支持超长文本的语音合成，适合电子书、新闻等场景。

```typescript
import { useDts } from 'xfyun-webapi-sdk';

const { status, error, taskId, result, createTask, queryTask, waitForTask, downloadResult, reset } = useDts({
  serverBase: 'http://localhost:8083',
  getAuthCode: () => 'your-auth-token',
  business: {
    aue: 'raw',              // 音频编码
    vcn: 'x4_mingge',        // 发音人
    speed: 50,               // 语速 (0-100)
    volume: 50,              // 音量 (0-100)
    pitch: 50,               // 音调 (0-100)
    bgs: 0,                  // 背景音 (0-100)
    ttp: 0                   // 文本预处理
  },
  onTaskCreated: (taskId) => {
    console.log('任务创建成功:', taskId);
  },
  onTaskCompleted: (result) => {
    console.log('任务完成:', result);
  },
  onError: (error) => {
    console.error('任务错误:', error);
  }
});

// 创建任务
const taskId = await createTask('很长的文本内容...');

// 查询任务状态
const status = await queryTask(taskId);

// 等待任务完成
const result = await waitForTask(taskId, 2000);

// 下载结果
const blob = await downloadResult(taskId, 'mp3');
```

## 音频处理工具

SDK 提供了丰富的音频处理工具函数：

```typescript
import { 
  toBase64, 
  int16ToFloat32, 
  bytesToInt16,
  getSharedAudioContext,
  calculateLevel,
  createAudioWorkletProcessor,
  createScriptProcessor,
  AUDIO_CONFIG,
  AUDIO_PERFORMANCE
} from 'xfyun-webapi-sdk';

// 音频格式转换
const base64 = toBase64(audioBuffer);
const float32Array = int16ToFloat32(int16Array);
const int16Array = bytesToInt16(uint8Array);

// 音频上下文管理
const audioContext = getSharedAudioContext();
const level = calculateLevel(audioBuffer);

// 音频处理器
const processor = createAudioWorkletProcessor(audioContext);
const scriptProcessor = createScriptProcessor(audioContext);
```

## 错误处理

SDK 提供了完善的错误处理机制：

```typescript
import { 
  mapXfyunError, 
  isRetryableError, 
  getErrorSeverity,
  getErrorType,
  createXfyunError,
  calculateRetryDelay,
  ErrorSeverity,
  ErrorType
} from 'xfyun-webapi-sdk';

// 错误映射
const error = mapXfyunError(10105); // 参数错误或鉴权失败

// 错误类型判断
if (isRetryableError(error)) {
  const delay = calculateRetryDelay(error, attemptCount);
  setTimeout(() => retry(), delay);
}

// 错误严重程度
const severity = getErrorSeverity(error);
if (severity === ErrorSeverity.CRITICAL) {
  // 处理严重错误
}
```

## 发音人配置

### DTS 发音人列表

| 发音人ID | 名称 | 性别 | 语言 | 风格 |
|---------|------|------|------|------|
| x4_yeting | 希涵 | 女 | 中文/普通话 | 游戏影视解说 |
| x4_mingge | 明哥 | 男 | 中文/普通话 | 阅读听书 |
| x4_pengfei | 小鹏 | 男 | 中文/普通话 | 新闻播报 |
| x4_qianxue | 千雪 | 女 | 中文/普通话 | 阅读听书 |
| x4_lingbosong | 聆伯松 | 男 | 中文/普通话 | 阅读听书(老年) |
| x4_xiuying | 秀英 | 女 | 中文/普通话 | 阅读听书(老年) |
| x4_doudou | 豆豆 | 男 | 中文/普通话 | 阅读听书(男童) |
| x4_lingxiaoshan_profnews | 聆小珊 | 女 | 中文/普通话 | 新闻播报 |
| x4_xiaoguo | 小果 | 女 | 中文/普通话 | 新闻播报 |
| x4_xiaozhong | 小忠 | 男 | 中文/普通话 | 新闻播报 |
| x4_yezi | 小露 | 女 | 中文/普通话 | 通用场景 |
| x4_chaoge | 超哥 | 男 | 中文/普通话 | 新闻播报 |
| x4_feidie | 飞碟哥 | 男 | 中文/普通话 | 游戏影视解说 |
| x4_lingfeihao_upbeatads | 聆飞皓 | 男 | 中文/普通话 | 直播广告 |
| x4_wangqianqian | 嘉欣 | 女 | 中文/普通话 | 直播广告 |
| x4_lingxiaozhen_eclives | 聆小臻 | 女 | 中文/普通话 | 直播广告 |
| x4_guanyijie | 关山-专题 | 男 | 中文/普通话 | 专题片纪录片 |
| x4_EnUs_Catherine_profnews | Catherine | 女 | 英语 | 专业新闻 |

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 开发

```bash
# 克隆项目
git clone https://github.com/isingerw/xfyun-webapi-sdk.git

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行示例
npm run demo
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

我们欢迎任何形式的贡献，包括但不限于：

- 报告 Bug
- 提出新功能建议
- 提交代码修复
- 改进文档
- 分享使用经验

### 开发说明

**重要提示**: 本项目作者是后端开发人员，前端技术能力有限。如果您在以下方面有专长，我们特别需要您的帮助：

- React/Vue 框架优化
- TypeScript 类型定义完善
- 前端性能优化
- UI/UX 设计改进
- 浏览器兼容性处理
- 前端构建工具配置

### 如何贡献

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 添加适当的注释和文档
- 确保所有测试通过

## 高级配置

### 音频配置

```typescript
import { AUDIO_CONFIG, AUDIO_PERFORMANCE } from 'xfyun-webapi-sdk';

// 音频配置常量
console.log(AUDIO_CONFIG.DEFAULT_SAMPLE_RATE);  // 16000
console.log(AUDIO_CONFIG.DEFAULT_CHANNELS);     // 1
console.log(AUDIO_CONFIG.DEFAULT_BIT_DEPTH);    // 16

// 性能优化配置
console.log(AUDIO_PERFORMANCE.ENABLE_WORKER);   // true
console.log(AUDIO_PERFORMANCE.BATCH_SIZE);      // 10
```

### 连接池配置 (RTASR)

```typescript
import { RtasrConnectionPool } from 'xfyun-webapi-sdk';

const pool = new RtasrConnectionPool({
  maxConnections: 5,        // 最大连接数
  idleTimeout: 30000,       // 空闲超时
  heartbeatInterval: 10000, // 心跳间隔
  retryAttempts: 3          // 重试次数
});
```

### 错误恢复策略

```typescript
import { ErrorRecoveryStrategy, DEFAULT_RECOVERY_STRATEGY } from 'xfyun-webapi-sdk';

const customStrategy: ErrorRecoveryStrategy = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
};

// 使用自定义策略
const { open, sendFrame, close } = useIat({
  // ... 其他配置
  retryStrategy: customStrategy
});
```

## 故障排除

### 常见问题

#### 1. 音频格式问题

**问题**: 音频识别效果差或无法识别

**解决方案**:
```typescript
import { validateAudioSpec } from 'xfyun-webapi-sdk';

// 检查音频格式
const isValid = validateAudioSpec({
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
});

if (!isValid) {
  console.error('音频格式不正确，需要 16kHz/单声道/16bit');
}
```

#### 2. 网络连接问题

**问题**: WebSocket 连接失败

**解决方案**:
```typescript
const { status, error, open, retryConnection } = useIat({
  // ... 配置
  onError: (error) => {
    if (error.includes('WebSocket')) {
      // 自动重连
      setTimeout(() => retryConnection(), 2000);
    }
  }
});
```

#### 3. 认证问题

**问题**: 签名获取失败

**解决方案**:
```typescript
// 检查服务地址和认证令牌
const { open } = useIat({
  serverBase: 'http://localhost:8083', // 确保地址正确
  getAuthCode: () => {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      throw new Error('认证令牌未找到');
    }
    return token;
  }
});
```

#### 4. 浏览器兼容性问题

**问题**: 在某些浏览器中无法工作

**解决方案**:
```typescript
// 检查浏览器支持
if (!window.WebSocket) {
  console.error('浏览器不支持 WebSocket');
}

if (!window.AudioContext && !window.webkitAudioContext) {
  console.error('浏览器不支持 Web Audio API');
}

// 使用 polyfill 或降级方案
```

### 调试技巧

#### 1. 启用详细日志

```typescript
const { open, sendFrame, close } = useIat({
  // ... 配置
  onLog: (level, payload) => {
    console.log(`[${level}]`, payload);
  },
  onMessage: (msg) => {
    console.log('原始消息:', msg);
  }
});
```

#### 2. 监控连接状态

```typescript
const { status, error } = useIat({
  // ... 配置
  onOpen: (sid) => {
    console.log('连接已打开，会话ID:', sid);
  },
  onClose: (code, reason) => {
    console.log('连接已关闭，代码:', code, '原因:', reason);
  }
});

// 监听状态变化
useEffect(() => {
  console.log('当前状态:', status);
}, [status]);
```

#### 3. 性能监控

```typescript
import { calculateLevel, AUDIO_PERFORMANCE } from 'xfyun-webapi-sdk';

// 监控音频电平
const level = calculateLevel(audioBuffer);
console.log('音频电平:', level);

// 检查性能配置
console.log('Web Worker 支持:', AUDIO_PERFORMANCE.ENABLE_WORKER);
```

## 性能优化

### 1. 音频处理优化

```typescript
// 使用 Web Worker 处理音频
import { createAudioWorkletProcessor } from 'xfyun-webapi-sdk';

const processor = createAudioWorkletProcessor(audioContext, {
  onProcess: (inputBuffer) => {
    // 在 Worker 中处理音频
    return processAudio(inputBuffer);
  }
});
```

### 2. 内存管理

```typescript
// 及时释放资源
const { reset } = useIat({
  // ... 配置
});

// 组件卸载时清理
useEffect(() => {
  return () => {
    reset(); // 清理资源
  };
}, []);
```

### 3. 网络优化

```typescript
// 使用连接池
const pool = new RtasrConnectionPool({
  maxConnections: 3,  // 限制连接数
  idleTimeout: 10000  // 快速回收空闲连接
});
```

## 安全注意事项

### 1. 认证令牌安全

```typescript
// 不要在客户端硬编码令牌
const getAuthCode = () => 'hardcoded-token';

// 从安全的地方获取令牌
const getAuthCode = () => {
  return localStorage.getItem('auth-token') || '';
};
```

### 2. 服务端验证

```typescript
// 在服务端验证音频数据
const validateAudioData = (audioData: ArrayBuffer) => {
  // 检查音频长度、格式等
  if (audioData.byteLength < 1000) {
    throw new Error('音频数据太短');
  }
  return true;
};
```

## 监控和分析

### 1. 错误监控

```typescript
import { getErrorSeverity, getErrorType } from 'xfyun-webapi-sdk';

const { onError } = useIat({
  // ... 配置
  onError: (error) => {
    const severity = getErrorSeverity(error);
    const type = getErrorType(error);
    
    // 发送到监控服务
    analytics.track('voice_error', {
      error,
      severity,
      type,
      timestamp: Date.now()
    });
  }
});
```

### 2. 性能分析

```typescript
// 监控识别延迟
const startTime = Date.now();
const { onResult } = useIat({
  // ... 配置
  onResult: (text, isFinal) => {
    if (isFinal) {
      const latency = Date.now() - startTime;
      analytics.track('recognition_latency', { latency });
    }
  }
});
```

## 支持

如有问题，请通过以下方式联系：

- GitHub Issues: [https://github.com/isingerw/xfyun-webapi-sdk/issues](https://github.com/isingerw/xfyun-webapi-sdk/issues)
- Email: zhangsingerw@gmail.com

## 更新日志
### 1.2.6
- 构建流程优化 - 优化构建和发布流程
- 文档生成自动化 - 支持文档自动生成和更新
- 版本发布自动化 - 支持自动化版本发布

### v1.2.5
- 修复 DtsPanel.tsx 中的 TypeScript 类型错误
- 优化发音人类型定义
- 改进错误处理机制

### v1.2.4
- 添加长文本语音合成 (DTS) 支持
- 优化音频处理性能
- 改进 Vue 3 兼容性

### v1.2.3
- 添加实时语音识别 (RTASR) 支持
- 优化 WebSocket 连接管理
- 改进错误恢复策略

---

**注意**: 使用本 SDK 需要有效的科大讯飞开发者账号和相应的 API 权限。
