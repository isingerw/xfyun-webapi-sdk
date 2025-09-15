import React from "react";
import { Space, Tag, Alert } from "antd";

interface PanelTitleProps {
  title: string;
  status?: string;
  statusColor?: string;
  statusText?: string;
  extraTags?: React.ReactNode[];
  error?: string;
  extraInfo?: React.ReactNode;
}

export const PanelTitle: React.FC<PanelTitleProps> = ({
  title,
  status,
  statusColor,
  statusText,
  extraTags = [],
  error,
  extraInfo,
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
      default:
        return status;
    }
  };

  return (
    <div className="panel-title">
      <div className="panel-title-main">
        <h2 className="panel-title-text">{title}</h2>
        <div className="panel-title-tags">
          {status && (
            <Tag color={statusColor || getStatusColor(status)}>
              {statusText || getStatusText(status)}
            </Tag>
          )}
          {extraTags.map((tag, index) => (
            <React.Fragment key={index}>{tag}</React.Fragment>
          ))}
        </div>
      </div>
      <div className="panel-title-extra">
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginRight: 8 }}
          />
        )}
        {extraInfo}
      </div>
    </div>
  );
};
