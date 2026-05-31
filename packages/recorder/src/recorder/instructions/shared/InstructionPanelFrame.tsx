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

import type { RecorderInstructionLabels } from '../types';
import * as React from 'react';
import { InstructionPanelButton } from './InstructionControls';

export const InstructionPanelFrame: React.FC<{
  title: string;
  labels: RecorderInstructionLabels;
  disabled: boolean;
  confirmDisabled?: boolean;
  expanded: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onReset: () => void;
  children: React.ReactNode;
}> = ({ title, labels, disabled, confirmDisabled, expanded, confirmed, onConfirm, onEdit, onReset, children }) => {
  return <div className='recorder-instruction-panel'>
    <div className='recorder-instruction-panel-header'>
      <span className='recorder-instruction-panel-title'>{title}</span>
      <span className={`recorder-instruction-panel-state ${confirmed ? 'confirmed' : 'pending'}`}>
        {confirmed ? labels.confirmed : labels.needsConfirmation}
      </span>
      {expanded ? null : <InstructionPanelButton disabled={disabled} onClick={onEdit}>
        {labels.edit}
      </InstructionPanelButton>}
    </div>
    {expanded ? <div className='recorder-instruction-panel-body'>
      {children}
      <div className='recorder-instruction-panel-actions'>
        <InstructionPanelButton disabled={disabled} onClick={onReset}>
          {labels.reset}
        </InstructionPanelButton>
        <InstructionPanelButton disabled={disabled || confirmDisabled} onClick={onConfirm} primary>
          {labels.confirm}
        </InstructionPanelButton>
      </div>
    </div> : null}
  </div>;
};
