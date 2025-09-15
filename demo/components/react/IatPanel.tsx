import React, { useRef, useState, useEffect } from "react";
import { Input, Select, Space, Switch, Tag, Row } from "antd";
import {
  useIat,
  getSharedAudioContext,
  calculateLevel,
  createAudioWorkletProcessor,
  createScriptProcessor,
  useIatRecorder,
  IatClient,
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

export default function IatPanel(props: {
  serverBase: string;
  getAuthCode: () => string;
}) {
  const { serverBase, getAuthCode } = props;
  const [language, setLanguage] = useState<string>("zh_cn");
  const [accent, setAccent] = useState<string>("mandarin");
  const [vadEos, setVadEos] = useState<number>(2000);
  const [ptt, setPtt] = useState<0 | 1>(1);
  const [dwa, setDwa] = useState<boolean>(false);
  // 调试日志改由统一悬浮窗显示
  const [vinfo, setVinfo] = useState<0 | 1 | undefined>(undefined);
  const [rst, setRst] = useState<string | undefined>(undefined);
  const [rlang, setRlang] = useState<string | undefined>(undefined);
  const [pd, setPd] = useState<string | undefined>(undefined);
  const [pdEngine, setPdEngine] = useState<string | undefined>(undefined);
  const [nbest, setNbest] = useState<number | undefined>(undefined);
  const [wbest, setWbest] = useState<number | undefined>(undefined);
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [retryDelay, setRetryDelay] = useState<number>(800);
  const [backoffMultiplier, setBackoffMultiplier] = useState<number>(2);
  const [maxRetryDelay, setMaxRetryDelay] = useState<number>(10000);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false); // 默认便捷模式

  const addLog = (m: string) =>
    publishLog({ level: "info", panel: "IAT", message: m });

  const iatOptions: any = {
    serverBase,
    getAuthCode,
    business: {
      language,
      domain: "iat",
      accent,
      vad_eos: vadEos,
      ptt,
      ...(dwa ? { dwa: "wpgs" } : {}),
      ...(vinfo !== undefined ? { vinfo } : {}),
      ...(rst ? { rst } : {}),
      ...(rlang ? { rlang } : {}),
      ...(pd ? { pd } : {}),
      ...(pdEngine ? { pd_engine: pdEngine } : {}),
      ...(nbest !== undefined ? { nbest } : {}),
      ...(wbest !== undefined ? { wbest } : {}),
    },
    maxRetries,
    retryStrategy: { retryDelay, backoffMultiplier, maxRetryDelay },
    onResult: (text: string, isFinal: boolean) => {
      setText(text);
      addLog(`识别结果: ${text} ${isFinal ? "(最终)" : "(增量)"}`);
    },
    onMessage: (msg: any) => {
      if (msg?.type === "warning" && msg?.category === "language-url-check") {
        addLog(
          `提示: 语言/域名校验 - ${JSON.stringify({ warns: msg.warns, host: msg.urlHost, lang: msg.lang, accent: msg.accent })}`,
        );
      } else {
        addLog(
          `消息: code=${msg?.code || "unknown"}, action=${msg?.action || "none"}`,
        );
      }
    },
    onOpen: (sid?: string) => {
      addLog(`连接已建立, sid: ${sid || "unknown"}`);
    },
    onClose: (code?: number, reason?: string) => {
      addLog(`连接已关闭: code=${code}, reason=${reason || "unknown"}`);
      setIsRecording(false);
    },
    onError: (message: string, sid?: string) => {
      addLog(`错误: ${message} ${sid ? `(sid: ${sid})` : ""}`);
    },
    onLog: (level: string, payload: Record<string, any>) =>
      publishLog({ level, ...payload, panel: "IAT" }),
  };

  const { status, error, open, sendFrame, close, reset } = useIat(iatOptions);

  // 便捷模式：使用高阶 Hook（内置录音+分帧）
  const recorderClientRef = useRef<IatClient | null>(null);
  const ensureRecorderClient = () => {
    if (!recorderClientRef.current) {
      recorderClientRef.current = new IatClient(iatOptions as any);
    }
    return recorderClientRef.current!;
  };
  const recorder = useIatRecorder({
    client: ensureRecorderClient(),
    frameMs: 40,
  });

  const [text, setText] = useState("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(
    null,
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  async function start() {
    if (!advancedMode) {
      await recorder.start();
      return;
    }

    addLog("开始录音...");
    try {
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
          "./audio-processor.js",
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
      setIsRecording(true);
      addLog("录音已开始");
    } catch (err) {
      addLog(`录音启动失败: ${err}`);
    }
  }

  async function stop() {
    if (!advancedMode) {
      await recorder.stop();
      return;
    }

    addLog("停止录音...");
    try {
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
      setIsRecording(false);
      addLog("录音已停止");
    } catch (err) {
      addLog(`停止录音失败: ${err}`);
    }
  }

  const handleStartRecording = async () => {
    await start();
  };

  const handleStopRecording = async () => {
    await stop();
  };

  const handleClearResult = () => {
    setText("");
    addLog("结果已清空");
  };

  // 便捷模式：监听录音器状态
  useEffect(() => {
    if (!advancedMode && recorder.recording) {
      setIsRecording(true);
    } else if (!advancedMode && !recorder.recording) {
      setIsRecording(false);
    }
  }, [recorder.recording, advancedMode]);

  const result = text;

  // 参数配置内容
  const leftContent = (
    <Row gutter={[16, 16]}>
      <FormField label="语种设置" tooltip="选择识别的语言类型" span={12}>
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
        label="口音设置"
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
        label="VAD断句阈值"
        tooltip="语音活动检测断句时间，单位毫秒，建议2000-5000ms"
        span={12}
      >
        <Input
          type="number"
          value={vadEos}
          onChange={(e) => setVadEos(Number(e.target.value))}
          addonAfter="ms"
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
            { value: 0, label: "关闭" },
            { value: 1, label: "开启" },
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

      <FormField label="模式切换" tooltip="便捷模式隐藏高级参数" span={12}>
        <FormSwitch
          checked={advancedMode}
          onChange={setAdvancedMode}
          checkedChildren="高级"
          unCheckedChildren="便捷"
        />
      </FormField>

      {advancedMode && (
        <>
          <FormField label="VINFO" tooltip="是否返回中间结果" span={12}>
            <FormSelect
              value={vinfo}
              onChange={setVinfo}
              options={[
                { value: undefined, label: "默认" },
                { value: 0, label: "关闭" },
                { value: 1, label: "开启" },
              ]}
            />
          </FormField>

          <FormField label="RST" tooltip="结果格式" span={12}>
            <FormInput
              value={rst || ""}
              onChange={setRst}
              placeholder="如：plain"
            />
          </FormField>

          <FormField label="RLANG" tooltip="结果语言" span={12}>
            <FormInput
              value={rlang || ""}
              onChange={setRlang}
              placeholder="如：zh_cn"
            />
          </FormField>

          <FormField label="PD" tooltip="标点符号设置" span={12}>
            <FormInput value={pd || ""} onChange={setPd} placeholder="如：0" />
          </FormField>

          <FormField label="PD引擎" tooltip="标点符号引擎" span={12}>
            <FormInput
              value={pdEngine || ""}
              onChange={setPdEngine}
              placeholder="如：default"
            />
          </FormField>

          <FormField label="NBEST" tooltip="候选结果数量" span={12}>
            <FormInput
              value={nbest || ""}
              onChange={(v) => setNbest(v ? Number(v) : undefined)}
              placeholder="如：1"
              type="number"
            />
          </FormField>

          <FormField label="WBEST" tooltip="词候选数量" span={12}>
            <FormInput
              value={wbest || ""}
              onChange={(v) => setWbest(v ? Number(v) : undefined)}
              placeholder="如：1"
              type="number"
            />
          </FormField>

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
        </>
      )}
    </Row>
  );

  // 操作和内容区域
  const rightContent = (
    <div>
      <ContentArea title="录音控制">
        <ButtonGroup>
          <ActionButton
            type="primary"
            loading={isRecording}
            onClick={handleStartRecording}
            disabled={advancedMode && status !== "open"}
          >
            {isRecording ? "录音中..." : "开始录音"}
          </ActionButton>

          <ActionButton onClick={handleStopRecording} disabled={!isRecording}>
            停止录音
          </ActionButton>

          <ActionButton onClick={handleClearResult}>清空结果</ActionButton>
        </ButtonGroup>

        <AudioLevel
          level={Math.max(audioLevel, recorder.level || 0)}
          className="mt-4"
        />
      </ContentArea>

      <ContentArea title="识别结果">
        <ResultDisplay
          title="识别文本"
          content={result}
          loading={isRecording}
        />
      </ContentArea>

      <ContentArea title="状态信息">
        <StatusDisplay
          status={status}
          extraInfo={
            <Space>
              <Tag color="blue">模式: {advancedMode ? "高级" : "便捷"}</Tag>
              {(isRecording || recorder.recording) && (
                <Tag color="red">录音中</Tag>
              )}
            </Space>
          }
        />
      </ContentArea>
    </div>
  );

  return (
    <UnifiedPanel
      title="语音听写 (IAT)"
      status={status}
      extraTags={[
        (isRecording || recorder.recording) && (
          <Tag key="recording" color="red">
            录音中
          </Tag>
        ),
      ]}
      error={error}
      extraInfo={
        <Space>
          <span style={{ color: "#ffffff", fontSize: "12px" }}>模式：</span>
          <Switch
            checkedChildren="高级"
            unCheckedChildren="便捷"
            checked={advancedMode}
            onChange={setAdvancedMode}
          />
        </Space>
      }
      leftContent={leftContent}
      rightContent={rightContent}
      className="react-panel"
    />
  );
}
