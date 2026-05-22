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
import { InstructionCheckbox, InstructionField, InstructionRadioGroup, InstructionTextarea } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';

type SelectMatchBy = 'text' | 'value';
type SelectMatch = 'exact' | 'contains';

export type AssertSelectInitialInstructionConfig = {
  targetExpression: string;
  matchBy: SelectMatchBy;
  match: SelectMatch;
  expectedSelection: string;
  sampledText: string;
  sampledValue: string;
};

type SelectInitialAssertionArgument = {
  matchBy?: unknown;
  match?: unknown;
  expected?: unknown;
  text?: unknown;
  value?: unknown;
};

export const assertSelectInitialInstructionDefinition: RecorderInstructionDefinition<AssertSelectInitialInstructionConfig> = {
  typeId: 'assert-select-initial',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.negated || call.matcher !== 'toHaveSelectInitial')
      return null;
    const parsed = parseJsonArgument(call.argumentText) as SelectInitialAssertionArgument | null;
    if (!parsed || typeof parsed !== 'object')
      return null;
    const expectedSelection = typeof parsed.expected === 'string' ? parsed.expected : '';
    const sampledText = typeof parsed.text === 'string' ? parsed.text : expectedSelection;
    const sampledValue = typeof parsed.value === 'string' ? parsed.value : '';
    return {
      targetExpression: call.targetExpression,
      matchBy: parsed.matchBy === 'value' ? 'value' : 'text',
      match: parsed.match === 'contains' ? 'contains' : 'exact',
      expectedSelection,
      sampledText,
      sampledValue,
    };
  },
  createActionText: (_originalActionText, config) => {
    return createPlaywrightAssertionActionWithArgument(config.targetExpression, 'toHaveSelectInitial', JSON.stringify({
      matchBy: config.matchBy,
      match: config.match,
      expected: config.expectedSelection,
      text: config.sampledText,
      value: config.sampledValue,
    }));
  },
  renderPanel: props => {
    const setExpectedSelection = (expectedSelection: string) => props.onChange({ ...props.config, expectedSelection });
    const setMatchBy = (matchBy: SelectMatchBy) => props.onChange({
      ...props.config,
      matchBy,
      expectedSelection: matchBy === 'value' ? props.config.sampledValue : props.config.sampledText,
    });
    const setContains = (contains: boolean) => props.onChange({ ...props.config, match: contains ? 'contains' : 'exact' });
    return <InstructionPanelFrame
      title={props.labels.selectInitialAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <InstructionRadioGroup
        disabled={props.disabled}
        name={`${props.instructionId}-select-initial-match-by`}
        onChange={setMatchBy}
        options={[
          { value: 'text', label: props.labels.matchByText },
          { value: 'value', label: props.labels.matchByValue },
        ]}
        value={props.config.matchBy}
      />
      <InstructionField label={props.labels.expectedSelection}>
        <InstructionTextarea disabled={props.disabled} onChange={setExpectedSelection} value={props.config.expectedSelection} />
      </InstructionField>
      <InstructionCheckbox
        checked={props.config.match === 'contains'}
        disabled={props.disabled}
        label={props.labels.containsSelection}
        onChange={setContains}
      />
    </InstructionPanelFrame>;
  },
};
