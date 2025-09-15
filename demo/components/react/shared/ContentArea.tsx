import React from "react";
import { Card, Progress, Tag, Typography, Space, Alert } from "antd";

const { Text, Paragraph } = Typography;

interface ContentAreaProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const ContentArea: React.FC<ContentAreaProps> = ({
  children,
  title,
  className = "",
}) => {
  return (
    <div className={`content-area ${className}`}>
      {title && <h3 className="content-area-title">{title}</h3>}
      <div className="content-area-body">{children}</div>
    </div>
  );
};

interface StatusDisplayProps {
  status: string;
  statusText?: string;
  statusColor?: string;
  progress?: number;
  extraInfo?: React.ReactNode;
  className?: string;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  status,
  statusText,
  statusColor,
  progress,
  extraInfo,
  className = "",
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle":
        return "default";
      case "connecting":
        return "processing";
      case "open":
        return "success";
      case "closing":
        return "warning";
      case "closed":
        return "default";
      case "error":
        return "error";
      case "recording":
        return "red";
      case "playing":
        return "blue";
      case "processing":
        return "orange";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "idle":
        return "空闲";
      case "connecting":
        return "连接中";
      case "open":
        return "已连接";
      case "closing":
        return "关闭中";
      case "closed":
        return "已关闭";
      case "error":
        return "错误";
      case "recording":
        return "录音中";
      case "playing":
        return "播放中";
      case "processing":
        return "处理中";
      default:
        return status;
    }
  };

  return (
    <div className={`status-display ${className}`}>
      <Space align="center">
        <Tag color={statusColor || getStatusColor(status)}>
          {statusText || getStatusText(status)}
        </Tag>
        {progress !== undefined && (
          <Progress
            percent={progress}
            size="small"
            showInfo={false}
            className="status-progress"
          />
        )}
        {extraInfo}
      </Space>
    </div>
  );
};

interface AudioLevelProps {
  level: number;
  maxLevel?: number;
  className?: string;
}

export const AudioLevel: React.FC<AudioLevelProps> = ({
  level,
  maxLevel = 100,
  className = "",
}) => {
  const percentage = Math.min((level / maxLevel) * 100, 100);

  return (
    <div className={`audio-level ${className}`}>
      <Text type="secondary" style={{ fontSize: "12px" }}>
        音量: {Math.round(percentage)}%
      </Text>
      <Progress
        percent={percentage}
        size="small"
        showInfo={false}
        strokeColor={
          percentage > 80 ? "#ff4d4f" : percentage > 50 ? "#faad14" : "#52c41a"
        }
        className="audio-level-bar"
      />
    </div>
  );
};

interface ResultDisplayProps {
  title: string;
  content: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  title,
  content,
  loading = false,
  error,
  className = "",
}) => {
  return (
    <Card
      title={title}
      size="small"
      className={`result-display ${className}`}
      loading={loading}
    >
      {error ? (
        <Alert message={error} type="error" showIcon />
      ) : (
        <Paragraph
          copyable
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {content || "暂无结果"}
        </Paragraph>
      )}
    </Card>
  );
};
