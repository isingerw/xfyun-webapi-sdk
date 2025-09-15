import React from "react";
import { Row, Col, Card, Divider } from "antd";
import { PanelTitle } from "./PanelTitle";

interface UnifiedPanelProps {
  title: string;
  status?: string;
  statusColor?: string;
  statusText?: string;
  extraTags?: React.ReactNode[];
  error?: string;
  extraInfo?: React.ReactNode;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  className?: string;
}

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  title,
  status,
  statusColor,
  statusText,
  extraTags = [],
  error,
  extraInfo,
  leftContent,
  rightContent,
  className = "",
}) => {
  return (
    <div className={`unified-panel ${className}`}>
      <PanelTitle
        title={title}
        status={status}
        statusColor={statusColor}
        statusText={statusText}
        extraTags={extraTags}
        error={error}
        extraInfo={extraInfo}
      />

      <div className="panel-content">
        <Row gutter={[24, 16]} className="panel-layout">
          <Col xs={24} lg={10} xl={8} className="panel-left">
            <Card
              title="参数配置"
              size="small"
              className="config-card"
              styles={{
                header: {
                  background: "#fafafa",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: "14px",
                  fontWeight: 600,
                },
              }}
            >
              {leftContent}
            </Card>
          </Col>

          <Col xs={24} lg={14} xl={16} className="panel-right">
            <Card
              title="操作与内容"
              size="small"
              className="action-card"
              styles={{
                header: {
                  background: "#fafafa",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: "14px",
                  fontWeight: 600,
                },
              }}
            >
              {rightContent}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};
