/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';

export const InstructionField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => {
  return <label className='recorder-instruction-field'>
    <span>{label}</span>
    {children}
  </label>;
};

export const InstructionTextInput: React.FC<{
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  type?: 'text' | 'password';
  onChange: (value: string) => void;
}> = ({ value, disabled, readOnly, type = 'text', onChange }) => {
  return <input
    className='recorder-instruction-input'
    disabled={disabled}
    onChange={event => onChange(event.target.value)}
    readOnly={readOnly}
    type={type}
    value={value}
  />;
};

export const InstructionTextarea: React.FC<{
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}> = ({ value, disabled, readOnly, rows = 1, onChange }) => {
  return <textarea
    className='recorder-instruction-textarea'
    disabled={disabled}
    onChange={event => onChange(event.target.value)}
    readOnly={readOnly}
    rows={rows}
    value={value}
  />;
};

export const InstructionCheckbox: React.FC<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, disabled, label, onChange }) => {
  return <label className='recorder-instruction-checkbox'>
    <input
      checked={checked}
      disabled={disabled}
      onChange={event => onChange(event.target.checked)}
      type='checkbox'
    />
    <span>{label}</span>
  </label>;
};

export const InstructionRadioGroup = <TValue extends string>({ disabled, name, value, options, onChange }: {
  disabled?: boolean;
  name: string;
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) => {
  return <div className='recorder-instruction-radio-group'>
    {options.map(option => <label className='recorder-instruction-radio' key={option.value}>
      <input
        checked={value === option.value}
        disabled={disabled}
        name={name}
        onChange={() => onChange(option.value)}
        type='radio'
      />
      <span>{option.label}</span>
    </label>)}
  </div>;
};

export const InstructionPanelButton: React.FC<{
  children: React.ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}> = ({ children, disabled, primary, onClick }) => {
  return <button
    className={`recorder-instruction-panel-button ${primary ? 'primary' : ''}`}
    disabled={disabled}
    onClick={onClick}
    type='button'
  >
    {children}
  </button>;
};
