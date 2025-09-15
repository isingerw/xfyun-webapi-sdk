import React, { useRef, useState, useEffect } from "react";
import { Input, Select, Space, Tag, Row } from "antd";
import {
  useRtasr,
  getSharedAudioContext,
  calculateLevel,
  createAudioWorkletProcessor,
  createScriptProcessor,
  useRtasrStream,
  RtasrClient,
} from "xfyun-webapi-sdk";
import { publishLog } from "./shared/logBus";
import { UnifiedPanel } from "./shared/UnifiedPanel";
import {
  FormField,
  FormInput,
  FormSelect,
  FormSwitch,
} from "./shared/FormField";
import { ActionButton, ButtonGroup } from "./shared/ActionButton";
import {
  ContentArea,
  StatusDisplay,
  AudioLevel,
  ResultDisplay,
} from "./shared/ContentArea";

export default function RtasrPanel(props: {
  serverBase: string;
  getAuthCode: () => string;
}) {
  const { serverBase, getAuthCode } = props;

  // 配置参数
  const [language, setLanguage] = useState<string>("zh_cn");
  const [accent, setAccent] = useState<string>("mandarin");
  const [vadEos, setVadEos] = useState<number>(2000);
  const [ptt, setPtt] = useState<0 | 1>(1);
  const [dwa, setDwa] = useState<boolean>(false);
  const [heartbeatMs, setHeartbeatMs] = useState<number>(8000);
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [retryDelay, setRetryDelay] = useState<number>(800);
  const [backoffMultiplier, setBackoffMultiplier] = useState<number>(2);
  const [maxRetryDelay, setMaxRetryDelay] = useState<number>(10000);
  const [testDupEnd, setTestDupEnd] = useState<boolean>(false);

  // 状态管理
  // 调试日志改由统一悬浮窗显示
  const [result, setResult] = useState(""); // 累计的最终结果
  const [realTimeResult, setRealTimeResult] = useState(""); // 当前实时结果
  const [audioLevel, setAudioLevel] = useState(0);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false); // 默认便捷模式
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [noResultTimer, setNoResultTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [sessionResults, setSessionResults] = useState<string[]>([]); // 会话中的所有结果

  const addLog = (m: string) =>
    publishLog({ level: "info", panel: "RTASR", message: m });

  const rtasrOptions: any = {
    serverBase,
    getAuthCode,
    business: {
      language,
      domain: "rtasr",
      accent,
      vad_eos: vadEos,
      ptt,
      ...(dwa ? { dwa: "wpgs" } : {}),
    },
    heartbeatMs,
    maxRetries,
    retryStrategy: { retryDelay, backoffMultiplier, maxRetryDelay },
    onLog: (level: string, payload: Record<string, any>) =>
      publishLog({ level, ...payload, panel: "RTASR" }),
    onResult: (text: string, isFinal: boolean) => {
      if (isFinal) {
        // 最终结果：保存到累计结果中
        setResult((prev) => {
          const newResults = [...prev.split(" "), text.trim()].filter(Boolean);
          return newResults.join(" ");
        });
        addLog(`最终结果: ${text.trim()}`);
      } else {
        // 临时结果：显示当前实时结果
        const currentSessionText = sessionResults.join(" ");
        const displayText = currentSessionText
          ? `${currentSessionText} ${text}`
          : text;
        setRealTimeResult(displayText);
        addLog(`临时结果: ${text}`);
      }
    },
    onMessage: (m: any) => {
      addLog(`消息: ${JSON.stringify(m)}`);
    },
    onOpen: (sid?: string) => {
      addLog(`连接已建立, sid: ${sid || "unknown"}`);
    },
    onClose: (code?: number, reason?: string) => {
      addLog(`连接已关闭: code=${code}, reason=${reason || "unknown"}`);
      setIsRecognizing(false);
    },
    onError: (message: string, sid?: string) => {
      addLog(`错误: ${message} ${sid ? `(sid: ${sid})` : ""}`);
    },
    onHeartbeat: () => {
      addLog("心跳包");
    },
    onRetry: (attempt: number, delay: number) => {
      addLog(`重试 ${attempt} 次，延迟 ${delay}ms`);
    },
    onMaxRetriesExceeded: () => {
      addLog("达到最大重试次数，停止重试");
    },
    onDuplicateEnd: () => {
      addLog("检测到重复结束事件");
    },
    onNoResultTimeout: () => {
      addLog("无结果超时");
    },
    onNoResultTimer: (timer: NodeJS.Timeout | null) => {
      setNoResultTimer(timer);
    },
    testDupEnd,
  };

  const { status, error, open, sendFrame, close, reset } =
    useRtasr(rtasrOptions);

  // 便捷模式：使用高阶 Hook（内置录音+分帧）
  const streamClientRef = useRef<RtasrClient | null>(null);
  const ensureStreamClient = () => {
    if (!streamClientRef.current) {
      streamClientRef.current = new RtasrClient(rtasrOptions as any);
    }
    return streamClientRef.current!;
  };
  const streamHook = useRtasrStream({
    client: ensureStreamClient(),
    frameMs: 40,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(
    null,
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  async function start() {
    // 清空之前的实时结果
    setRealTimeResult("");
    
    if (!advancedMode) {
      // 便捷模式：使用内置录音
      streamHook.start();
      setIsRecognizing(true);
      return;
    }
    try {
      addLog("开始语音识别...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = getSharedAudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      try {
        const processor = await createAudioWorkletProcessor(
          audioCtx,
          (audioData) => {
            const level = calculateLevel(audioData);
            setAudioLevel(level);
            // 将Float32Array转换为ArrayBuffer
            const arrayBuffer = audioData.buffer.slice(
              audioData.byteOffset,
              audioData.byteOffset + audioData.byteLength,
            ) as ArrayBuffer;
            sendFrame(arrayBuffer, false);
          },
          ".audio-processor.js",
        );
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);
        addLog("使用 AudioWorklet 处理器");
      } catch (workletError) {
        addLog(`AudioWorklet 不可用，回退到 ScriptProcessor: ${workletError}`);
        const processor = createScriptProcessor(audioCtx, (audioData) => {
          const level = calculateLevel(audioData);
          setAudioLevel(level);
          // 将Float32Array转换为ArrayBuffer
          const arrayBuffer = audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength,
          ) as ArrayBuffer;
          sendFrame(arrayBuffer, false);
        });
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);
        addLog("使用 ScriptProcessor 处理器");
      }

      await open();
      setIsRecognizing(true);
      addLog("语音识别已开始");
    } catch (err) {
      addLog(`语音识别启动失败: ${err}`);
    }
  }

  async function stop() {
    if (!advancedMode) {
      // 便捷模式：停止内置录音
      streamHook.stop();
      setIsRecognizing(false);
      addLog("语音识别已停止");
      return;
    }
    try {
      addLog("停止语音识别...");

      // 如果有当前实时结果，将其作为最终结果保存
      if (realTimeResult.trim()) {
        const currentText = realTimeResult.trim();
        setSessionResults((prev) => [...prev, currentText]);
        setResult((prev) => {
          const newResults = [...prev.split(" "), currentText].filter(Boolean);
          return newResults.join(" ");
        });
        addLog(`保存当前识别结果: ${currentText}`);
      }

      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      await close();
      setIsRecognizing(false);
      addLog("语音识别已停止");
    } catch (err) {
      addLog(`停止语音识别失败: ${err}`);
    }
  }

  const clearResults = () => {
    setResult("");
    setRealTimeResult("");
    setSessionResults([]);
    addLog("结果已清空");
  };

  // 便捷模式：监听录音器状态
  useEffect(() => {
    if (!advancedMode && streamHook.streaming) {
      setIsRecognizing(true);
    } else if (!advancedMode && !streamHook.streaming) {
      setIsRecognizing(false);
    }
  }, [streamHook.streaming, advancedMode]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (isRecognizing) {
        stop();
      }
    };
  }, []);

  // 参数配置内容
  const leftContent = (
    <Row gutter={[16, 16]}>
      <FormField label="语言" tooltip="选择识别的语言类型" span={12}>
        <FormSelect
          value={language}
          onChange={setLanguage}
          options={[
            { value: "zh_cn", label: "中文普通话" },
            { value: "en_us", label: "美式英语" },
          ]}
        />
      </FormField>

      <FormField
        label="口音"
        tooltip="选择对应的口音类型，提高识别准确率"
        span={12}
      >
        <FormSelect
          value={accent}
          onChange={setAccent}
          options={[
            { value: "mandarin", label: "普通话" },
            { value: "cantonese", label: "粤语" },
          ]}
        />
      </FormField>

      <FormField
        label="静音断句"
        tooltip="语音活动检测断句时间，单位毫秒，建议2000-5000ms"
        span={12}
      >
        <Input
          type="number"
          value={vadEos}
          onChange={(e) => setVadEos(Number(e.target.value))}
          suffix="ms"
          min={0}
          max={10000}
          className="form-input"
        />
      </FormField>

      <FormField
        label="标点符号"
        tooltip="是否在识别结果中添加标点符号"
        span={12}
      >
        <FormSelect
          value={ptt}
          onChange={setPtt}
          options={[
            { value: 1, label: "开启标点" },
            { value: 0, label: "关闭标点" },
          ]}
        />
      </FormField>

      <FormField
        label="数字转换"
        tooltip="是否将数字转换为阿拉伯数字"
        span={12}
      >
        <FormSwitch
          checked={dwa}
          onChange={setDwa}
          checkedChildren="开启"
          unCheckedChildren="关闭"
        />
      </FormField>

      <FormField
        label="心跳间隔"
        tooltip="WebSocket心跳间隔，单位毫秒"
        span={12}
      >
        <Input
          type="number"
          value={heartbeatMs}
          onChange={(e) => setHeartbeatMs(Number(e.target.value))}
          suffix="ms"
          min={1000}
          max={30000}
          className="form-input"
        />
      </FormField>

      <FormField label="模式切换" tooltip="便捷模式隐藏高级参数" span={24}>
        <FormSwitch
          checked={advancedMode}
          onChange={setAdvancedMode}
          checkedChildren="高级"
          unCheckedChildren="便捷"
        />
      </FormField>

      {advancedMode && (
        <>
          <FormField
            label="最大重试次数"
            tooltip="连接失败时的最大重试次数"
            span={12}
          >
            <FormInput
              value={maxRetries}
              onChange={(v) => setMaxRetries(Number(v))}
              type="number"
            />
          </FormField>

          <FormField label="重试延迟" tooltip="重试间隔时间（毫秒）" span={12}>
            <FormInput
              value={retryDelay}
              onChange={(v) => setRetryDelay(Number(v))}
              type="number"
            />
          </FormField>

          <FormField label="退避乘数" tooltip="重试延迟的乘数因子" span={12}>
            <FormInput
              value={backoffMultiplier}
              onChange={(v) => setBackoffMultiplier(Number(v))}
              type="number"
            />
          </FormField>

          <FormField
            label="最大重试延迟"
            tooltip="重试延迟的最大值（毫秒）"
            span={12}
          >
            <FormInput
              value={maxRetryDelay}
              onChange={(v) => setMaxRetryDelay(Number(v))}
              type="number"
            />
          </FormField>

          <FormField
            label="测试重复结束"
            tooltip="是否测试重复结束事件"
            span={12}
          >
            <FormSwitch
              checked={testDupEnd}
              onChange={setTestDupEnd}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </FormField>
        </>
      )}
    </Row>
  );

  // 操作和内容区域
  const rightContent = (
    <div>
      <ContentArea title="识别控制">
        <ButtonGroup>
          <ActionButton
            type="primary"
            loading={isRecognizing}
            onClick={() => start()}
            disabled={advancedMode && status !== "open"}
          >
            {isRecognizing ? "识别中..." : "开始识别"}
          </ActionButton>

          <ActionButton onClick={() => stop()} disabled={!isRecognizing}>
            停止识别
          </ActionButton>

          <ActionButton onClick={clearResults}>清空结果</ActionButton>
        </ButtonGroup>

        <AudioLevel level={audioLevel} className="mt-4" />
      </ContentArea>

      <ContentArea title="识别结果">
        <ResultDisplay
          title="实时结果"
          content={realTimeResult || (isRecognizing ? "正在识别中..." : "暂无识别结果")}
          loading={false}
        />

        <ResultDisplay title="最终结果" content={result} loading={false} />
      </ContentArea>

      <ContentArea title="会话历史">
        <ResultDisplay
          title="会话记录"
          content={sessionResults.join("\n")}
          loading={false}
        />
      </ContentArea>

      <ContentArea title="状态信息">
        <StatusDisplay
          status={status}
          extraInfo={
            <Space>
              <Tag color="blue">模式: {advancedMode ? "高级" : "便捷"}</Tag>
              {(isRecognizing || streamHook.streaming) && (
                <Tag color="red">识别中</Tag>
              )}
            </Space>
          }
        />
      </ContentArea>
    </div>
  );

  return (
    <UnifiedPanel
      title="实时语音转写 (RTASR)"
      status={status}
      extraTags={[
        (isRecognizing || streamHook.streaming) && (
          <Tag key="recognizing" color="red">
            识别中
          </Tag>
        ),
      ]}
      error={error}
      extraInfo={
        <Space>
          <span style={{ color: "#fff", fontSize: "12px" }}>模式：</span>
          <FormSwitch
            checked={advancedMode}
            onChange={setAdvancedMode}
            checkedChildren="高级"
            unCheckedChildren="便捷"
          />
        </Space>
      }
      leftContent={leftContent}
      rightContent={rightContent}
      className="react-panel"
    />
  );
}
