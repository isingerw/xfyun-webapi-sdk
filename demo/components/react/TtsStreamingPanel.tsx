import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Space, Tag, Row } from "antd";
import { useStreamingTts } from "xfyun-webapi-sdk";
import { publishLog } from "./shared/logBus";
import { UnifiedPanel } from "./shared/UnifiedPanel";
import {
  FormField,
  FormInput,
  FormSelect,
  FormSlider,
  FormTextArea,
} from "./shared/FormField";
import { ActionButton, ButtonGroup } from "./shared/ActionButton";
import { ContentArea, StatusDisplay } from "./shared/ContentArea";

/**
 * 在线语音合成 (TTS) 流式面板（Ant Design 风格，对齐 TtsPanel.tsx）
 */
export default function TtsStreamingPanel({
  serverBase,
  getAuthCode,
}: {
  serverBase: string;
  getAuthCode: () => string;
}) {
  // 参数持久化（不包含 serverBase/getAuthCode）
  const persisted = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = Object.fromEntries(url.searchParams.entries());
      const fromLs = JSON.parse(
        localStorage.getItem("tts_streaming_opts") || "{}",
      );
      return { ...fromLs, ...fromUrl } as Record<string, any>;
    } catch {
      return {} as Record<string, any>;
    }
  }, []);

  const [opts, setOpts] = useState({
    aue: (persisted.aue === "mp3" ? "mp3" : "raw") as "raw" | "mp3",
    vcn: typeof persisted.vcn === "string" ? persisted.vcn : "x4_yezi",
    speed: isFinite(+persisted.speed) ? +persisted.speed : 50,
    volume: isFinite(+persisted.volume) ? +persisted.volume : 50,
    pitch: isFinite(+persisted.pitch) ? +persisted.pitch : 50,
    tte: typeof persisted.tte === "string" ? persisted.tte : "utf8",
    auf:
      typeof persisted.auf === "string"
        ? persisted.auf
        : "audio/L16;rate=16000",
    rdn: isFinite(+persisted.rdn) ? +persisted.rdn : undefined,
    ent: typeof persisted.ent === "string" ? persisted.ent : undefined,
    mp3Playback: (persisted.mp3Playback === "blob" ? "blob" : "mse") as
      | "mse"
      | "blob",
    keepAliveIntervalMs: isFinite(+persisted.keepAliveIntervalMs)
      ? +persisted.keepAliveIntervalMs
      : 15000,
    keepAliveWhenIdle:
      persisted.keepAliveWhenIdle === "true" ||
      persisted.keepAliveWhenIdle === true,
    audioScheduleAheadSec: isFinite(+persisted.audioScheduleAheadSec)
      ? +persisted.audioScheduleAheadSec
      : 0.05,
    autoEndAfterMs: isFinite(+persisted.autoEndAfterMs)
      ? +persisted.autoEndAfterMs
      : 5000,
    logLevel:
      persisted.logLevel === "warn" || persisted.logLevel === "error"
        ? persisted.logLevel
        : ("info" as "info" | "warn" | "error"),
    retry: {
      maxRetries: isFinite(+persisted.maxRetries) ? +persisted.maxRetries : 2,
      initialDelayMs: isFinite(+persisted.initialDelayMs)
        ? +persisted.initialDelayMs
        : 500,
      factor: isFinite(+persisted.factor) ? +persisted.factor : 2,
    },
    localVolume: isFinite(+persisted.localVolume)
      ? Math.min(1, Math.max(0, +persisted.localVolume))
      : 0.6,
  });

  // 错误状态
  const [inlineError, setInlineError] = useState<string>("");

  // 文本输入
  const [text, setText] = useState(
    "语音技术正在快速发展，为我们的生活带来了许多便利。从语音识别到语音合成，从实时转写到流式处理，每一项技术都在不断进步和完善。",
  );

  // 模拟输入相关
  const [simuText, setSimuText] = useState("");
  const [simuRunning, setSimuRunning] = useState(false);
  const [simuIntervalMs] = useState(50);
  const simuTimerRef = useRef<number | undefined>(undefined);

  const addLog = (m: string) =>
    publishLog({ level: "info", panel: "TTS-Streaming", message: m });

  // 持久化参数到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem("tts_streaming_opts", JSON.stringify(opts));
    } catch (e) {
      addLog(`持久化参数失败: ${e}`);
    }
  }, [opts]);

  const {
    status,
    error,
    isPlaying,
    start,
    appendText,
    endText,
    pause,
    resume,
    stop,
    close,
  } = useStreamingTts({
    serverBase,
    getAuthCode,
    business: {
      aue: opts.aue,
      vcn: opts.vcn,
      speed: opts.speed,
      volume: opts.volume,
      pitch: opts.pitch,
      tte: opts.tte,
      auf: opts.auf,
      rdn: opts.rdn,
      ent: opts.ent,
    },
    onLog: (level: "info" | "warn" | "error", payload: any) => {
      publishLog({ level, ...payload, panel: "TTS-Streaming" });
    },
    onError: (err: string) => {
      setInlineError(err);
      addLog(`错误: ${err}`);
    },
    onPlaying: (playing: boolean) => {
      addLog(`播放状态变化: ${playing ? "播放中" : "已停止"}`);
    },
  });

  // 模拟输入
  const startSimu = useCallback(() => {
    if (!simuText || simuRunning) return;
    setSimuRunning(true);
    addLog(
      `开始模拟流式输入: ${simuText.substring(0, 30)}${simuText.length > 30 ? "..." : ""}`,
    );
    publishLog({
      level: "info",
      panel: "TTS-Streaming",
      event: "simulation_started",
      message: "开始模拟流式输入",
      details: { textLength: simuText.length, interval: simuIntervalMs },
    });

    let i = 0;
    const tick = () => {
      if (!simuRunning) return;
      if (i < simuText.length) {
        appendText(simuText[i]);
        i += 1;
        simuTimerRef.current = window.setTimeout(
          tick,
          Math.max(10, simuIntervalMs),
        );
      } else {
        endText();
        setSimuRunning(false);
        addLog("模拟输入完成");
        publishLog({
          level: "info",
          panel: "TTS-Streaming",
          event: "simulation_completed",
          message: "模拟输入完成",
        });
      }
    };
    tick();
  }, [simuText, simuRunning, simuIntervalMs, appendText, endText]);

  const stopSimu = useCallback(() => {
    if (simuTimerRef.current) {
      clearTimeout(simuTimerRef.current);
      simuTimerRef.current = undefined;
    }
    setSimuRunning(false);
    addLog("模拟输入已停止");
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (simuTimerRef.current) {
        clearTimeout(simuTimerRef.current);
      }
    };
  }, []);

  const mseSupported =
    typeof window !== "undefined" && (window as any).MediaSource;

  // 参数配置内容
  const leftContent = (
    <Row gutter={[16, 16]}>
      <FormField label="音频格式" tooltip="选择音频输出格式" span={24}>
        <FormSelect
          value={opts.aue}
          onChange={(v) => setOpts((o) => ({ ...o, aue: v as any }))}
          options={[
            { value: "raw", label: "PCM (原始音频，低延迟)" },
            { value: "mp3", label: "MP3 (压缩音频，小体积)" },
            { value: "wav", label: "WAV (无损音频)" },
            { value: "aac", label: "AAC (高质量压缩)" },
          ]}
        />
      </FormField>

      <FormField
        label="发音人"
        tooltip="选择不同的发音人，每种发音人有不同的音色和特点"
        span={24}
      >
        <FormSelect
          value={opts.vcn}
          onChange={(v) => setOpts((o) => ({ ...o, vcn: v }))}
          options={[
            { value: "x4_yezi", label: "小露（推荐，女声）" },
            { value: "x4_x4_yezi", label: "小燕（女声）" },
            { value: "aisjiuxu", label: "许久（男声）" },
            { value: "aisjinger", label: "小婧（女声）" },
            { value: "aisbabyxu", label: "许小宝（童声）" },
            { value: "aisxping", label: "小萍（女声）" },
            { value: "aisxping_emo", label: "小萍（情感女声）" },
          ]}
        />
      </FormField>

      <FormField label="语速" tooltip="控制语音播放的速度，范围0-100" span={24}>
        <FormSlider
          value={opts.speed}
          onChange={(v) => setOpts((o) => ({ ...o, speed: v }))}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField label="音量" tooltip="控制语音播放的音量，范围0-100" span={24}>
        <FormSlider
          value={opts.volume}
          onChange={(v) => setOpts((o) => ({ ...o, volume: v }))}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField
        label="音调"
        tooltip="控制语音播放的音调高低，范围0-100"
        span={24}
      >
        <FormSlider
          value={opts.pitch}
          onChange={(v) => setOpts((o) => ({ ...o, pitch: v }))}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField
        label="数字发音风格"
        tooltip="控制数字的发音方式，0为数字串，1为数字值"
        span={24}
      >
        <FormSelect
          value={opts.rdn}
          onChange={(v) => setOpts((o) => ({ ...o, rdn: v }))}
          options={[
            { value: 0, label: "数字串（如：123读作一二三）" },
            { value: 1, label: "数字值（如：123读作一百二十三）" },
          ]}
          placeholder="选择数字发音风格"
        />
      </FormField>

      <FormField
        label="引擎类型"
        tooltip="选择音库领域，影响发音风格和效果"
        span={24}
      >
        <FormInput
          value={opts.ent || ""}
          onChange={(v) => setOpts((o) => ({ ...o, ent: v }))}
          placeholder="如：通用、教育、新闻等"
        />
      </FormField>

      <FormField label="MP3播放方式" tooltip="选择MP3音频的播放方式" span={24}>
        <FormSelect
          value={opts.mp3Playback}
          onChange={(v) => setOpts((o) => ({ ...o, mp3Playback: v as any }))}
          options={[
            { value: "mse", label: "MSE (推荐，低延迟)" },
            { value: "blob", label: "Blob (兼容性好)" },
          ]}
        />
      </FormField>

      <FormField label="本地音量" tooltip="控制本地播放音量，范围0-1" span={24}>
        <FormSlider
          value={opts.localVolume}
          onChange={(v) => setOpts((o) => ({ ...o, localVolume: v }))}
          min={0}
          max={1}
          step={0.1}
          marks={{ 0: "0", 0.5: "0.5", 1: "1" }}
        />
      </FormField>
    </Row>
  );

  // 操作和内容区域
  const rightContent = (
    <div>
      <ContentArea title="文本输入">
        <FormTextArea
          value={text}
          onChange={setText}
          placeholder="请输入要合成的文本..."
          rows={4}
        />
      </ContentArea>

      <ContentArea title="流式控制">
        <ButtonGroup>
          <ActionButton
            type="primary"
            loading={isPlaying}
            onClick={() => start()}
            disabled={!text.trim()}
          >
            {isPlaying ? "合成中..." : "开始合成"}
          </ActionButton>

          <ActionButton onClick={stop} disabled={!isPlaying}>
            停止合成
          </ActionButton>

          <ActionButton onClick={pause} disabled={!isPlaying}>
            暂停播放
          </ActionButton>

          <ActionButton onClick={resume} disabled={!isPlaying}>
            恢复播放
          </ActionButton>
        </ButtonGroup>
      </ContentArea>

      <ContentArea title="模拟输入">
        <FormTextArea
          value={simuText}
          onChange={setSimuText}
          placeholder="输入要模拟的文本..."
          rows={3}
        />
        <ButtonGroup>
          <ActionButton
            onClick={startSimu}
            disabled={!simuText.trim() || simuRunning}
          >
            {simuRunning ? "模拟中..." : "开始模拟"}
          </ActionButton>

          <ActionButton onClick={stopSimu} disabled={!simuRunning}>
            停止模拟
          </ActionButton>
        </ButtonGroup>
      </ContentArea>

      <ContentArea title="状态信息">
        <StatusDisplay
          status={status}
          extraInfo={
            <Space>
              <Tag>{opts.aue.toUpperCase()}</Tag>
              {opts.aue === "mp3" && (
                <Tag
                  color={
                    opts.mp3Playback === "mse"
                      ? mseSupported
                        ? "geekblue"
                        : "volcano"
                      : "gold"
                  }
                >
                  {opts.mp3Playback}
                </Tag>
              )}
              {isPlaying && <Tag color="orange">播放中</Tag>}
            </Space>
          }
        />
      </ContentArea>
    </div>
  );

  return (
    <UnifiedPanel
      title="流式语音合成"
      status={status}
      extraTags={[
        <Tag key="format">{opts.aue.toUpperCase()}</Tag>,
        opts.aue === "mp3" && (
          <Tag
            key="playback"
            color={
              opts.mp3Playback === "mse"
                ? mseSupported
                  ? "geekblue"
                  : "volcano"
                : "gold"
            }
          >
            {opts.mp3Playback}
          </Tag>
        ),
        isPlaying && (
          <Tag key="playing" color="orange">
            播放中
          </Tag>
        ),
      ]}
      error={inlineError}
      leftContent={leftContent}
      rightContent={rightContent}
      className="react-panel"
    />
  );
}
