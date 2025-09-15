import React from "react";
import { Button, Space, Tooltip } from "antd";

interface ActionButtonProps {
  type?: "primary" | "default" | "dashed" | "link" | "text";
  size?: "small" | "middle" | "large";
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  ghost?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
  tooltip?: string;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  type = "primary",
  size = "middle",
  loading = false,
  disabled = false,
  danger = false,
  ghost = false,
  icon,
  onClick,
  children,
  tooltip,
  className = "",
}) => {
  const button = (
    <Button
      type={type}
      size={size}
      loading={loading}
      disabled={disabled}
      danger={danger}
      ghost={ghost}
      icon={icon}
      onClick={onClick}
      className={`action-button ${className}`}
    >
      {children}
    </Button>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{button}</Tooltip>;
  }

  return button;
};

interface ButtonGroupProps {
  children: React.ReactNode;
  direction?: "horizontal" | "vertical";
  size?: "small" | "middle" | "large";
  wrap?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  direction = "horizontal",
  size = "middle",
  wrap = true,
}) => {
  return (
    <Space
      direction={direction}
      size={size}
      wrap={wrap}
      className="button-group"
    >
      {children}
    </Space>
  );
};
