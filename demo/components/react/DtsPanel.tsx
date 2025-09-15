import React, { useState } from "react";
import { Space, Tag, Row } from "antd";
import { useDts, DtsBusiness } from "xfyun-webapi-sdk";
import { publishLog } from "./shared/logBus";
import { UnifiedPanel } from "./shared/UnifiedPanel";
import {
  FormField,
  FormSelect,
  FormSlider,
  FormTextArea,
} from "./shared/FormField";
import { ActionButton, ButtonGroup } from "./shared/ActionButton";
import {
  ContentArea,
  StatusDisplay,
  ResultDisplay,
} from "./shared/ContentArea";

export default function DtsPanel(props: {
  serverBase: string;
  getAuthCode: () => string;
}) {
  const { serverBase, getAuthCode } = props;

  // 配置参数
  const [aue, setAue] = useState<string>("raw");
  const [vcn, setVcn] = useState<DtsBusiness['vcn']>("x4_mingge");
  const [speed, setSpeed] = useState<number>(50);
  const [volume, setVolume] = useState<number>(50);
  const [pitch, setPitch] = useState<number>(50);
  const [bgs, setBgs] = useState<number>(0);
  const [ttp, setTtp] = useState<number>(0);

  // 状态管理
  const [text, setText] = useState(
    "长文本语音合成提供了支持单次超大文本（万字级别）进行快速语音合成的功能。",
  );
  // 调试日志改由统一悬浮窗显示
  const [downloadMime, setDownloadMime] = useState<string>("mp3");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const addLog = (m: string) =>
    publishLog({ level: "info", panel: "DTS", message: m });

  // 构建business对象
  const business: DtsBusiness = {
    aue,
    vcn,
    speed,
    volume,
    pitch,
    bgs,
    ttp,
  };

  const { status, error, taskId, result, createTask, queryTask, waitForTask } =
    useDts({
      serverBase,
      getAuthCode,
      business,
      onLog: (level: string, payload: Record<string, any>) =>
        publishLog({ level, ...payload, panel: "DTS" }),
      onTaskCreated: (taskId: string) => {
        addLog(`任务创建成功: ${taskId}`);
      },
      onTaskCompleted: (result: any) => {
        addLog(`任务完成: ${JSON.stringify(result)}`);
        setIsProcessing(false);
      },
      onError: (error: string) => {
        addLog(`错误: ${error}`);
        setIsProcessing(false);
      },
    });

  const handleCreateTask = async () => {
    if (!text.trim()) {
      addLog("请输入要合成的文本");
      return;
    }

    try {
      setIsProcessing(true);
      addLog("开始创建DTS任务...");
      const taskId = await createTask(text);
      addLog(`任务创建成功，任务ID: ${taskId}`);
    } catch (error) {
      addLog(
        `创建任务失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
      setIsProcessing(false);
    }
  };

  const handleQueryTask = async () => {
    if (!taskId) {
      addLog("错误: 没有任务ID，请先创建任务");
      return;
    }
    try {
      addLog(`查询任务状态... 任务ID: ${taskId}`);
      const result = await queryTask(taskId);
      addLog(`查询结果: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(
        `查询错误: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };

  const handleWaitForTask = async () => {
    if (!taskId) {
      addLog("错误: 没有任务ID，请先创建任务");
      return;
    }
    try {
      addLog(`等待任务完成... 任务ID: ${taskId}`);
      const result = await waitForTask(taskId, 2000);
      addLog(`任务完成，结果: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(
        `等待错误: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };

  const handleDownload = async () => {
    if (!taskId) return;
    try {
      addLog("下载结果产物...");
      // 使用动态导入替代require
      const { DtsClient } = await import("xfyun-webapi-sdk");
      const client = new DtsClient({
        serverBase,
        getAuthCode,
      });
      const blob = await client.downloadResult(taskId, downloadMime);
      if (!blob) {
        addLog("没有可下载的结果");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dts-result-${taskId}.${downloadMime}`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`下载完成: dts-result-${taskId}.${downloadMime}`);
    } catch (error) {
      addLog(
        `下载错误: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };

  // 参数配置内容
  const leftContent = (
    <Row gutter={[16, 16]}>
      <FormField
        label="音频格式"
        tooltip="选择音频输出格式，PCM为原始音频格式，其他为压缩格式"
        span={24}
      >
        <FormSelect
          value={aue}
          onChange={setAue}
          options={[
            { value: "raw", label: "PCM (原始音频，无损音质)" },
            { value: "mp3", label: "MP3 (压缩音频，小体积)" },
            { value: "speex", label: "Speex (语音优化压缩)" },
            { value: "opus", label: "Opus (现代压缩格式)" },
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
          onChange={(value) => setVcn(value as DtsBusiness['vcn'])}
          options={[
            { value: "x4_yeting", label: "希涵（女声，游戏影视解说）" },
            { value: "x4_mingge", label: "明哥（男声，阅读听书）" },
            { value: "x4_pengfei", label: "小鹏（男声，新闻播报）" },
            { value: "x4_qianxue", label: "千雪（女声，阅读听书）" },
            { value: "x4_lingbosong", label: "聆伯松（男声，老年，阅读听书）" },
            { value: "x4_xiuying", label: "秀英（女声，老年，阅读听书）" },
            { value: "x4_doudou", label: "豆豆（男童，阅读听书）" },
            { value: "x4_lingxiaoshan_profnews", label: "聆小珊（女声，新闻播报）" },
            { value: "x4_xiaoguo", label: "小果（女声，新闻播报）" },
            { value: "x4_xiaozhong", label: "小忠（男声，新闻播报）" },
            { value: "x4_yezi", label: "小露（女声，通用场景）" },
            { value: "x4_chaoge", label: "超哥（男声，新闻播报）" },
            { value: "x4_feidie", label: "飞碟哥（男声，游戏影视解说）" },
            { value: "x4_lingfeihao_upbeatads", label: "聆飞皓（男声，直播广告）" },
            { value: "x4_wangqianqian", label: "嘉欣（女声，直播广告）" },
            { value: "x4_lingxiaozhen_eclives", label: "聆小臻（女声，直播广告）" },
            { value: "x4_guanyijie", label: "关山-专题（男声，专题片纪录片）" },
          ]}
        />
      </FormField>

      <FormField
        label="语速"
        tooltip="控制语音播放的速度，50为正常语速"
        span={24}
      >
        <FormSlider
          value={speed}
          onChange={setSpeed}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField
        label="音量"
        tooltip="控制语音播放的音量大小，50为正常音量"
        span={24}
      >
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
        tooltip="控制语音播放的音调高低，50为正常音调"
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

      <FormField label="背景音" tooltip="添加背景音乐，0为无背景音" span={24}>
        <FormSlider
          value={bgs}
          onChange={setBgs}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField
        label="文本预处理"
        tooltip="文本预处理选项，0为无预处理"
        span={24}
      >
        <FormSlider
          value={ttp}
          onChange={setTtp}
          min={0}
          max={100}
          marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
        />
      </FormField>

      <FormField label="下载格式" tooltip="下载结果的音频格式" span={24}>
        <FormSelect
          value={downloadMime}
          onChange={setDownloadMime}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "wav", label: "WAV" },
            { value: "pcm", label: "PCM" },
          ]}
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
          placeholder="请输入要合成的长文本..."
          rows={8}
        />
      </ContentArea>

      <ContentArea title="任务控制">
        <ButtonGroup>
          <ActionButton
            type="primary"
            loading={isProcessing}
            onClick={handleCreateTask}
            disabled={!text.trim()}
          >
            {isProcessing ? "创建中..." : "创建任务"}
          </ActionButton>

          <ActionButton onClick={handleQueryTask} disabled={!taskId}>
            查询任务
          </ActionButton>

          <ActionButton onClick={handleWaitForTask} disabled={!taskId}>
            等待完成
          </ActionButton>

          <ActionButton onClick={handleDownload} disabled={!taskId}>
            下载结果
          </ActionButton>
        </ButtonGroup>
      </ContentArea>

      <ContentArea title="任务信息">
        <ResultDisplay
          title="任务状态"
          content={result ? JSON.stringify(result, null, 2) : "暂无结果"}
          loading={isProcessing}
        />
      </ContentArea>

      <ContentArea title="状态信息">
        <StatusDisplay
          status={status}
          extraInfo={
            <Space>
              {isProcessing && <Tag color="orange">处理中</Tag>}
              {taskId && <Tag color="blue">任务: {taskId}</Tag>}
              {!taskId && <Tag color="red">无任务ID</Tag>}
            </Space>
          }
        />
      </ContentArea>
    </div>
  );

  return (
    <UnifiedPanel
      title="长文本语音合成 (DTS)"
      status={status}
      extraTags={[
        isProcessing && (
          <Tag key="processing" color="orange">
            处理中
          </Tag>
        ),
        taskId && (
          <Tag key="task" color="blue">
            任务: {taskId}
          </Tag>
        ),
      ]}
      error={error}
      leftContent={leftContent}
      rightContent={rightContent}
      className="react-panel"
    />
  );
}
