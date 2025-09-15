# 快速开始指南

本指南将帮助您在5分钟内快速集成科大讯飞WebAPI SDK，实现语音识别和语音合成功能。

## 前置条件

- Node.js 16+ 或 pnpm
- 现代浏览器（Chrome 60+, Firefox 55+, Safari 11+, Edge 79+）
- 科大讯飞开发者账号和API密钥
- 后端签名服务（xfyun-webapi）

## 1. 安装SDK

### 使用 npm
```bash
npm install xfyun-webapi-sdk
```

### 使用 pnpm
```bash
pnpm add xfyun-webapi-sdk
```

### 使用 yarn
```bash
yarn add xfyun-webapi-sdk
```

## 2. 启动后端服务

### 克隆后端项目
```bash
git clone https://github.com/isingerw/xfyun-webapi.git
cd xfyun-webapi
```

### 配置API密钥
编辑 `src/main/resources/application-dev.yml`：

```yaml
xfyun:
  iat:
    app-id: your-iat-app-id
    api-key: your-iat-api-key
    api-secret: your-iat-api-secret
  tts:
    app-id: your-tts-app-id
    api-key: your-tts-api-key
    api-secret: your-tts-api-secret
```

### 启动服务
```bash
mvn spring-boot:run
```

服务将在 http://localhost:8080 启动

## 3. React 快速开始

### 创建React项目
```bash
npx create-react-app my-voice-app --template typescript
cd my-voice-app
npm install xfyun-webapi-sdk
```

### 语音识别示例
```tsx
import React, { useState } from 'react';
import { useIat } from 'xfyun-webapi-sdk';

function VoiceApp() {
  const [text, setText] = useState('');
  
  const { status, error, open, sendFrame, close } = useIat({
    serverBase: 'http://localhost:8080',
    getAuthCode: () => 'your-auth-token', // 可选
    business: {
      language: 'zh_cn',
      vad_eos: 2000,
      ptt: 1
    },
    onResult: (result, isFinal) => {
      if (isFinal) {
        setText(result);
      }
    },
    onError: (error) => {
      console.error('识别错误:', error);
    }
  });

  const handleStart = async () => {
    try {
      await open();
      // 这里需要集成录音功能
      console.log('开始录音...');
    } catch (error) {
      console.error('启动失败:', error);
    }
  };

  return (
    <div>
      <h1>语音识别示例</h1>
      <p>状态: {status}</p>
      {error && <p>错误: {error}</p>}
      <button onClick={handleStart}>开始识别</button>
      <button onClick={close}>停止识别</button>
      <p>识别结果: {text}</p>
    </div>
  );
}

export default VoiceApp;
```

### 语音合成示例
```tsx
import React, { useState } from 'react';
import { useTts } from 'xfyun-webapi-sdk';

function TtsApp() {
  const [inputText, setInputText] = useState('你好，世界！');
  
  const { status, error, speak, stop } = useTts({
    serverBase: 'http://localhost:8080',
    getAuthCode: () => 'your-auth-token', // 可选
    business: {
      aue: 'raw',
      vcn: 'x4_mingge',
      speed: 50,
      volume: 50
    },
    onComplete: () => {
      console.log('合成完成');
    },
    onError: (error) => {
      console.error('合成错误:', error);
    }
  });

  const handleSpeak = () => {
    if (inputText.trim()) {
      speak(inputText);
    }
  };

  return (
    <div>
      <h1>语音合成示例</h1>
      <p>状态: {status}</p>
      {error && <p>错误: {error}</p>}
      <textarea 
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="输入要合成的文本"
      />
      <br />
      <button onClick={handleSpeak}>开始合成</button>
      <button onClick={stop}>停止合成</button>
    </div>
  );
}

export default TtsApp;
```

## 4. Vue 3 快速开始

### 创建Vue项目
```bash
npm create vue@latest my-voice-app
cd my-voice-app
npm install
npm install xfyun-webapi-sdk
```

### 语音识别示例
```vue
<template>
  <div>
    <h1>语音识别示例</h1>
    <p>状态: {{ status }}</p>
    <p v-if="error">错误: {{ error }}</p>
    <button @click="handleStart" :disabled="status === 'connecting'">
      开始识别
    </button>
    <button @click="handleStop" :disabled="status !== 'open'">
      停止识别
    </button>
    <p>识别结果: {{ text }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useIat } from 'xfyun-webapi-sdk/vue';

const text = ref('');

const { status, error, open, sendFrame, close } = useIat({
  serverBase: 'http://localhost:8080',
  getAuthCode: () => 'your-auth-token', // 可选
  business: {
    language: 'zh_cn',
    vad_eos: 2000,
    ptt: 1
  },
  onResult: (result, isFinal) => {
    if (isFinal) {
      text.value = result;
    }
  },
  onError: (error) => {
    console.error('识别错误:', error);
  }
});

const handleStart = async () => {
  try {
    await open();
    console.log('开始录音...');
  } catch (error) {
    console.error('启动失败:', error);
  }
};

const handleStop = () => {
  close();
};
</script>
```

## 5. 原生JavaScript快速开始

### HTML页面
```html
<!DOCTYPE html>
<html>
<head>
    <title>语音识别示例</title>
    <script src="https://unpkg.com/xfyun-webapi-sdk@1.2.5/dist/index.js"></script>
</head>
<body>
    <h1>语音识别示例</h1>
    <button id="startBtn">开始识别</button>
    <button id="stopBtn">停止识别</button>
    <p id="result">识别结果将显示在这里</p>

    <script>
        const { IatClient } = window.XfyunWebapiSdk;
        
        const client = new IatClient({
            serverBase: 'http://localhost:8080',
            getAuthCode: () => 'your-auth-token', // 可选
            business: {
                language: 'zh_cn',
                vad_eos: 2000,
                ptt: 1
            },
            onResult: (text, isFinal) => {
                if (isFinal) {
                    document.getElementById('result').textContent = text;
                }
            },
            onError: (error) => {
                console.error('识别错误:', error);
            }
        });

        document.getElementById('startBtn').onclick = async () => {
            try {
                await client.open();
                console.log('开始录音...');
            } catch (error) {
                console.error('启动失败:', error);
            }
        };

        document.getElementById('stopBtn').onclick = () => {
            client.close();
        };
    </script>
</body>
</html>
```

## 6. 完整录音示例

### React录音示例
```tsx
import React, { useRef, useState } from 'react';
import { useIat, useIatRecorder, IatClient } from 'xfyun-webapi-sdk';

function VoiceRecorder() {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  
  // 创建客户端实例
  const clientRef = useRef(new IatClient({
    serverBase: 'http://localhost:8080',
    getAuthCode: () => 'your-auth-token',
    business: {
      language: 'zh_cn',
      vad_eos: 2000,
      ptt: 1
    },
    onResult: (result, isFinal) => {
      if (isFinal) {
        setText(result);
      }
    },
    onError: (error) => {
      console.error('识别错误:', error);
    }
  }));

  // 使用录音器
  const recorder = useIatRecorder({
    client: clientRef.current,
    frameMs: 40,
    onStart: () => {
      setRecording(true);
      console.log('开始录音');
    },
    onStop: () => {
      setRecording(false);
      console.log('停止录音');
    }
  });

  const handleStart = async () => {
    try {
      await recorder.start();
    } catch (error) {
      console.error('录音启动失败:', error);
    }
  };

  const handleStop = () => {
    recorder.stop();
  };

  return (
    <div>
      <h1>语音录音识别</h1>
      <button onClick={handleStart} disabled={recording}>
        {recording ? '录音中...' : '开始录音'}
      </button>
      <button onClick={handleStop} disabled={!recording}>
        停止录音
      </button>
      <p>识别结果: {text}</p>
    </div>
  );
}

export default VoiceRecorder;
```

## 7. 常见问题

### Q: 如何获取科大讯飞API密钥？
A: 访问 [科大讯飞开放平台](https://www.xfyun.cn/)，注册账号并创建应用获取API密钥。

### Q: 后端服务启动失败？
A: 检查Java版本（需要Java 8+）和Maven配置，确保API密钥配置正确。

### Q: 前端无法连接后端？
A: 检查后端服务是否正常启动，确认serverBase地址正确，检查CORS配置。

### Q: 录音权限被拒绝？
A: 确保在HTTPS环境下使用，或在localhost环境下测试。

### Q: 识别结果不准确？
A: 检查音频格式（16kHz单声道），调整VAD参数，确保环境安静。

## 8. 下一步

- 查看 [完整文档](README.md)
- 了解 [项目架构](ARCHITECTURE.md)
- 学习 [最佳实践](BEST_PRACTICES.md)
- 参与 [项目贡献](CONTRIBUTING.md)

## 9. 获取帮助

- 查看 [常见问题](README.md#常见问题)
- 提交 [Issue](https://github.com/isingerw/xfyun-webapi-sdk/issues)
- 发送邮件: zhangsingerw@gmail.com

---

恭喜！您已经成功集成了科大讯飞WebAPI SDK。现在可以开始构建您的语音应用了！
