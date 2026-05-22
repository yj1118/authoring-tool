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
import { createPlaywrightAssertionAction, createPlaywrightAssertionActionWithArgument, parsePlaywrightAssertionCall, parseStringArgument, quoteRegexLiteral } from '../shared/playwrightAssertion';
import { InstructionCheckbox, InstructionField, InstructionTextarea } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';

export type AssertValueInstructionConfig = {
  targetExpression: string;
  expectedValue: string;
  match: 'exact' | 'contains';
};

export const assertValueInstructionDefinition: RecorderInstructionDefinition<AssertValueInstructionConfig> = {
  typeId: 'assert-value',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.negated)
      return null;
    if (call.matcher === 'toBeEmpty') {
      if (call.argumentText)
        return null;
      return {
        targetExpression: call.targetExpression,
        expectedValue: '',
        match: 'exact',
      };
    }
    if (call.matcher !== 'toHaveValue')
      return null;
    const expectedValue = parseStringArgument(call.argumentText);
    if (expectedValue === null)
      return null;
    return {
      targetExpression: call.targetExpression,
      expectedValue,
      match: 'exact',
    };
  },
  createActionText: (_originalActionText, config) => {
    if (!config.expectedValue)
      return createPlaywrightAssertionAction(config.targetExpression, 'toBeEmpty');
    if (config.match === 'contains')
      return createPlaywrightAssertionActionWithArgument(config.targetExpression, 'toHaveValue', quoteRegexLiteral(config.expectedValue));
    return createPlaywrightAssertionAction(config.targetExpression, 'toHaveValue', config.expectedValue);
  },
  renderPanel: props => {
    const setExpectedValue = (expectedValue: string) => props.onChange({ ...props.config, expectedValue });
    const setContains = (contains: boolean) => props.onChange({ ...props.config, match: contains ? 'contains' : 'exact' });
    return <InstructionPanelFrame
      title={props.labels.valueAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <InstructionField label={props.labels.expectedValue}>
        <InstructionTextarea disabled={props.disabled} onChange={setExpectedValue} value={props.config.expectedValue} />
      </InstructionField>
      <div className='recorder-instruction-checkbox-row'>
        <InstructionCheckbox
          checked={props.config.match === 'contains' && !!props.config.expectedValue}
          disabled={props.disabled || !props.config.expectedValue}
          label={props.labels.containsValue}
          onChange={setContains}
        />
      </div>
    </InstructionPanelFrame>;
  },
};
