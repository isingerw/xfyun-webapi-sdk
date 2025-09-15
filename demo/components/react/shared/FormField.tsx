import React from "react";
import {
  Form,
  Input,
  Select,
  Slider,
  Switch,
  InputNumber,
  Tooltip,
  Col,
} from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

interface FormFieldProps {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  span?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  tooltip,
  children,
  span = 12,
}) => {
  return (
    <Col span={span}>
      <Form.Item
        label={
          <span className="form-field-label">
            {label}
            {tooltip && (
              <Tooltip title={tooltip}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: "#999" }} />
              </Tooltip>
            )}
          </span>
        }
      >
        {children}
      </Form.Item>
    </Col>
  );
};

interface FormInputProps {
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "password" | "number";
}

export const FormInput: React.FC<FormInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = "text",
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      className="form-input"
    />
  );
};

interface FormSelectProps {
  value: any;
  onChange: (value: any) => void;
  options: Array<{ label: string; value: any }>;
  placeholder?: string;
  disabled?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="form-select"
      options={options}
    />
  );
};

interface FormSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  marks?: Record<number, string>;
  disabled?: boolean;
}

export const FormSlider: React.FC<FormSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  marks,
  disabled = false,
}) => {
  return (
    <Slider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      marks={marks}
      disabled={disabled}
      className="form-slider"
    />
  );
};

interface FormSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  checkedChildren?: string;
  unCheckedChildren?: string;
  disabled?: boolean;
}

export const FormSwitch: React.FC<FormSwitchProps> = ({
  checked,
  onChange,
  checkedChildren,
  unCheckedChildren,
  disabled = false,
}) => {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
      disabled={disabled}
      className="form-switch"
    />
  );
};

interface FormTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export const FormTextArea: React.FC<FormTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
}) => {
  return (
    <Input.TextArea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="form-textarea"
    />
  );
};
