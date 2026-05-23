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
import { createPlaywrightAssertionActionWithArgument, parseJsonArgument, parsePlaywrightAssertionCall } from '../shared/playwrightAssertion';
import { InstructionCheckbox, InstructionField, InstructionTextInput } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';

export type AssertPasswordInputInstructionConfig = {
  targetExpression: string;
  assertValue: boolean;
  expectedValue: string;
};

type PasswordInputAssertionArgument = {
  assertValue?: unknown;
  expectedValue?: unknown;
};

export const assertPasswordInputInstructionDefinition: RecorderInstructionDefinition<AssertPasswordInputInstructionConfig> = {
  typeId: 'assert-password-input',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.negated || call.matcher !== 'toBePasswordInput')
      return null;
    const parsed = parseJsonArgument(call.argumentText) as PasswordInputAssertionArgument | null;
    const assertValue = parsed?.assertValue === true;
    return {
      targetExpression: call.targetExpression,
      assertValue,
      expectedValue: typeof parsed?.expectedValue === 'string' ? parsed.expectedValue : '',
    };
  },
  createActionText: (_originalActionText, config) => {
    return createPlaywrightAssertionActionWithArgument(config.targetExpression, 'toBePasswordInput', JSON.stringify({
      assertValue: config.assertValue,
      expectedValue: config.assertValue ? config.expectedValue : '',
      matchMode: 'exact',
    }));
  },
  renderPanel: props => {
    const setAssertValue = (assertValue: boolean) => props.onChange({
      ...props.config,
      assertValue,
    });
    const setExpectedValue = (expectedValue: string) => props.onChange({
      ...props.config,
      expectedValue,
      assertValue: true,
    });
    return <InstructionPanelFrame
      title={props.labels.passwordInputAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <InstructionCheckbox
        checked={props.config.assertValue}
        disabled={props.disabled}
        label={props.labels.assertPasswordValue}
        onChange={setAssertValue}
      />
      <InstructionField label={props.labels.expectedValue}>
        <InstructionTextInput
          disabled={props.disabled || !props.config.assertValue}
          onChange={setExpectedValue}
          type='password'
          value={props.config.expectedValue}
        />
      </InstructionField>
    </InstructionPanelFrame>;
  },
};
