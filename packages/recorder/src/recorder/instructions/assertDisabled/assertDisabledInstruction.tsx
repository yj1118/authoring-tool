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

import type { RecorderInstructionDefinition } from '../types';
import * as React from 'react';
import { parsePlaywrightAssertionCall } from '../shared/playwrightAssertion';
import { InstructionField, InstructionRadioGroup } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';

export type AssertDisabledInstructionConfig = {
  targetExpression: string;
  disabled: boolean;
};

export const assertDisabledInstructionDefinition: RecorderInstructionDefinition<AssertDisabledInstructionConfig> = {
  typeId: 'assert-disabled',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.matcher !== 'toBeDisabled')
      return null;
    if (call.argumentText)
      return null;
    return {
      targetExpression: call.targetExpression,
      disabled: !call.negated,
    };
  },
  createActionText: (_originalActionText, config) => {
    return `await expect(${config.targetExpression})${config.disabled ? '' : '.not'}.toBeDisabled();`;
  },
  renderPanel: props => {
    const setExpectedState = (value: 'disabled' | 'enabled') => props.onChange({ ...props.config, disabled: value === 'disabled' });
    return <InstructionPanelFrame
      title={props.labels.disabledAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <InstructionField label={props.labels.expectedDisabledState}>
        <InstructionRadioGroup
          disabled={props.disabled}
          name={`${props.instructionId}-disabled-state`}
          onChange={setExpectedState}
          options={[
            { value: 'disabled', label: props.labels.disabledState },
            { value: 'enabled', label: props.labels.notDisabledState },
          ]}
          value={props.config.disabled ? 'disabled' : 'enabled'}
        />
      </InstructionField>
    </InstructionPanelFrame>;
  },
};
