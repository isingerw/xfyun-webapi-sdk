import React, { useEffect, useRef, useState } from "react";
import { Select, Space, Tag, Row } from "antd";
import {
  releaseSharedAudioContext,
  TtsClient,
  useTts,
  useTtsPlayer,
} from "xfyun-webapi-sdk";
import { publishLog } from "./shared/logBus";
import { UnifiedPanel } from "./shared/UnifiedPanel";
import {
  FormField,
  FormSelect,
  FormSlider,
  FormSwitch,
  FormTextArea,
} from "./shared/FormField";
import { ActionButton, ButtonGroup } from "./shared/ActionButton";
import { ContentArea, StatusDisplay, AudioLevel } from "./shared/ContentArea";

export default function TtsPanel(props: {
  serverBase: string;
  getAuthCode: () => string;
}) {
  const { serverBase, getAuthCode } = props;
  const [aue, setAue] = useState<string>("raw");
  const [vcn, setVcn] = useState<string>("x4_yezi");
  const [speed, setSpeed] = useState<number>(50);
  const [volume, setVolume] = useState<number>(60);
  const [pitch, setPitch] = useState<number>(50);
  // 调试日志改由统一悬浮窗显示
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false); // 默认便捷模式

  const addLog = (m: string) =>
    publishLog({ level: "info", panel: "TTS", message: m });

  // 便捷模式：使用高阶 Hook（内置播放器）
  const playerClientRef = useRef<TtsClient | null>(null);
  const ensurePlayerClient = () => {
    // 总是重新创建客户端以确保参数更新
    playerClientRef.current = new TtsClient({
      serverBase,
      getAuthCode,
      business: {
        aue,
        vcn,
        speed,
        volume,
        pitch,
        tte: "utf8",
        auf: "audio/L16;rate=16000",
      },
      onMessage: (msg: any) => {
        addLog(`消息: ${JSON.stringify(msg)}`);
      },
      onLog: (level: string, payload: Record<string, any>) =>
        publishLog({ level, ...payload, panel: "TTS" }),
    } as any);

    return playerClientRef.current!;
  };
  const player = useTtsPlayer({ client: ensurePlayerClient() });

  const [text, setText] = useState(
    "Websocket API具备流式传输能力，适用于需要流式数据传输的服务场景。",
  );

  // 进入页面自动合成播放
  useEffect(() => {
    if (text.trim()) {
      // 延迟到下一帧，确保播放器/客户端已就绪
      const timer = setTimeout(() => {
        void handlePlay();
      }, 0);
      return () => clearTimeout(timer);
    }
  // 仅在首次挂载时触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 便捷模式：使用高阶 Hook（内置播放器）
  const { status, error, speak, stop, forceRecreate } = useTts({
    serverBase,
    getAuthCode,
    business: {
      aue,
      vcn,
      speed,
      volume,
      pitch,
      tte: "utf8",
      auf: "audio/L16;rate=16000",
    },
    onLevel: (level: number) => {
      setAudioLevel(level);
    },
    onComplete: () => {
      addLog("语音合成完成");
    },
  });

  // 监听参数变化，记录日志并强制重新创建客户端
  useEffect(() => {
    addLog(
      `TTS参数已更新: 发音人=${vcn}, 音频格式=${aue}, 语速=${speed}, 音量=${volume}, 音调=${pitch}`,
    );
    publishLog({
      level: "info",
      panel: "TTS",
      event: "parameters_changed",
      message: "TTS参数已更新",
      details: {
        audioFormat: aue,
        voice: vcn,
        speed: speed,
        volume: volume,
        pitch: pitch,
      },
    });

    // 强制重新创建客户端，确保新参数生效
    try {
      // 停止当前播放
      if (isPlaying) {
        handleStop();
      }

      // 重新创建高级模式客户端
      forceRecreate();

      addLog("TTS客户端已重新创建，新参数已生效");
    } catch (e) {
      addLog(`参数更新时重新创建客户端失败: ${e}`);
    }
  }, [aue, vcn, speed, volume, pitch, forceRecreate]);

  const handlePlay = async () => {
    if (!text.trim()) {
      addLog("请输入要合成的文本");
      return;
    }

    try {
      // 先停止之前的播放，避免重叠
      if (isPlaying) {
        handleStop();
      }

      addLog(
        `开始合成: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
      );

      if (!advancedMode) {
        // 便捷模式：使用内置播放器
        await player.speak(text);
        addLog("便捷模式播放已开始");
      } else {
        // 高级模式：手动控制
        await speak(text);
        addLog("高级模式播放已开始");
      }
    } catch (err) {
      addLog(`播放失败: ${err}`);
    }
  };

  const handleStop = async () => {
    try {
      if (!advancedMode) {
        // 便捷模式：停止内置播放器
        player.stop();
        addLog("便捷模式播放已停止");
      } else {
        // 高级模式：手动控制
        stop();
        addLog("高级模式播放已停止");
      }
    } catch (err) {
      addLog(`停止播放失败: ${err}`);
    }
  };

  const handlePause = async () => {
    try {
      if (!advancedMode) {
        // 便捷模式：暂停内置播放器
        player.pause();
        addLog("便捷模式播放已暂停");
      } else {
        // 高级模式：手动控制
        // 注意：useTts没有pause方法，需要实现
        addLog("高级模式暂不支持暂停功能");
      }
    } catch (err) {
      addLog(`暂停播放失败: ${err}`);
    }
  };

  const handleResume = async () => {
    try {
      if (!advancedMode) {
        // 便捷模式：恢复内置播放器
        player.resume();
        addLog("便捷模式播放已恢复");
      } else {
        // 高级模式：手动控制
        // 注意：useTts没有resume方法，需要实现
        addLog("高级模式暂不支持恢复功能");
      }
    } catch (err) {
      addLog(`恢复播放失败: ${err}`);
    }
  };

  // 监听播放器状态变化
  useEffect(() => {
    addLog(`播放器状态: ${player.status}, isPlaying: ${isPlaying}`);
    // 简化状态同步逻辑
    if (player.status === "playing") {
      setIsPlaying(true);
    } else if (player.status === "idle" || player.status === "closed" || player.status === "error") {
      setIsPlaying(false);
    }
  }, [player.status]);

  // 监听播放器音量变化
  useEffect(() => {
    if (player.level !== undefined) {
      setAudioLevel(player.level);
    }
  }, [player.level]);

  // 清理资源
  useEffect(() => {
    return () => {
      try {
        if (isPlaying) {
          handleStop();
        }
        releaseSharedAudioContext();
      } catch (e) {
        addLog(`清理资源时出错: ${e}`);
      }
    };
  }, []);

  // 参数配置内容
  const leftContent = (
    <Row gutter={[16, 16]}>
      <FormField
        label="音频格式"
        tooltip="选择音频输出格式，PCM为原始音频格式，MP3为压缩格式"
        span={24}
      >
        <FormSelect
          value={aue}
          onChange={setAue}
          options={[
            { value: "raw", label: "PCM (原始音频，低延迟)" },
            { value: "mp3", label: "MP3 (压缩音频，小体积)" },
          ]}
        />
      </FormField>

      <FormField
        label="发音人"
        tooltip="选择不同的发音人，每种发音人有不同的音色和特点"
        span={24}
      >
        <FormSelect
          value={vcn}
          onChange={setVcn}
          options={[
            { value: "x4_yezi", label: "小露（推荐，女声）" },
            { value: "x4_x4_yezi", label: "小燕（女声）" },
            { value: "aisjiuxu", label: "许久（男声）" },
            { value: "aisjinger", label: "小婧（女声）" },
            { value: "aisbabyxu", label: "许小宝（童声）" },
          ]}
        />
      </FormField>

      <FormField label="语速" tooltip="控制语音播放的速度，范围0-100" span={24}>
        <FormSlider
          value={speed}
          onChange={setSpeed}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField label="音量" tooltip="控制语音播放的音量，范围0-100" span={24}>
        <FormSlider
          value={volume}
          onChange={setVolume}
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
          value={pitch}
          onChange={setPitch}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField label="模式切换" tooltip="便捷模式隐藏高级参数" span={24}>
        <FormSwitch
          checked={advancedMode}
          onChange={(checked) => {
            setAdvancedMode(checked);
            addLog(`切换到${checked ? "高级" : "便捷"}模式`);
          }}
          checkedChildren="高级"
          unCheckedChildren="便捷"
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
          rows={6}
        />
      </ContentArea>

      <ContentArea title="播放控制">
        <ButtonGroup>
          <ActionButton
            type="primary"
            loading={isPlaying}
            onClick={handlePlay}
            disabled={!text.trim()}
          >
            {isPlaying ? "播放中..." : "开始播放"}
          </ActionButton>

          <ActionButton onClick={handleStop}>
            停止播放
          </ActionButton>

          <ActionButton onClick={handlePause}>
            暂停播放
          </ActionButton>

          <ActionButton onClick={handleResume}>
            恢复播放
          </ActionButton>

          <ActionButton
            onClick={() => {
              addLog("尝试恢复音频自动播放");
              player.requestAutoplay?.();
            }}
          >
            恢复自动播放
          </ActionButton>
        </ButtonGroup>

        <AudioLevel level={audioLevel} className="mt-4" />
      </ContentArea>

      <ContentArea title="状态信息">
        <StatusDisplay
          status={status}
          extraInfo={
            <Space>
              <Tag color="blue">模式: {advancedMode ? "高级" : "便捷"}</Tag>
              {isPlaying && <Tag color="orange">播放中</Tag>}
            </Space>
          }
        />
      </ContentArea>
    </div>
  );

  return (
    <UnifiedPanel
      title="在线语音合成 (TTS)"
      status={status}
      extraTags={[
        isPlaying && (
          <Tag key="playing" color="orange">
            播放中
          </Tag>
        ),
      ]}
      error={error}
      extraInfo={
        <Space>
          <span style={{ color: "#fff", fontSize: "12px" }}>模式：</span>
          <Select
            value={advancedMode ? "advanced" : "simple"}
            onChange={(v) => {
              const newMode = v === "advanced";
              setAdvancedMode(newMode);
              addLog(`切换到${newMode ? "高级" : "便捷"}模式`);
            }}
            style={{ width: 120 }}
            options={[
              { value: "advanced", label: "高级模式" },
              { value: "simple", label: "便捷模式" },
            ]}
          />
        </Space>
      }
      leftContent={leftContent}
      rightContent={rightContent}
      className="react-panel"
    />
  );
}
