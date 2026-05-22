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
import { createPlaywrightAssertionAction, parsePlaywrightAssertionCall, parseStringArgument } from '../shared/playwrightAssertion';
import { InstructionCheckbox, InstructionField, InstructionTextarea } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';

export type AssertTextInstructionConfig = {
  targetExpression: string;
  expectedText: string;
  match: 'exact' | 'contains';
};

export const assertTextInstructionDefinition: RecorderInstructionDefinition<AssertTextInstructionConfig> = {
  typeId: 'assert-text',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.negated)
      return null;
    if (call.matcher !== 'toHaveText' && call.matcher !== 'toContainText')
      return null;
    const expectedText = parseStringArgument(call.argumentText);
    if (expectedText === null)
      return null;
    return {
      targetExpression: call.targetExpression,
      expectedText,
      match: call.matcher === 'toContainText' ? 'contains' : 'exact',
    };
  },
  createActionText: (_originalActionText, config) => {
    const matcher = config.match === 'contains' ? 'toContainText' : 'toHaveText';
    return createPlaywrightAssertionAction(config.targetExpression, matcher, config.expectedText);
  },
  renderPanel: props => {
    const setExpectedText = (expectedText: string) => props.onChange({ ...props.config, expectedText });
    const setContains = (contains: boolean) => props.onChange({ ...props.config, match: contains ? 'contains' : 'exact' });
    return <InstructionPanelFrame
      title={props.labels.textAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <InstructionField label={props.labels.expectedText}>
        <InstructionTextarea disabled={props.disabled} onChange={setExpectedText} rows={3} value={props.config.expectedText} />
      </InstructionField>
      <InstructionCheckbox
        checked={props.config.match === 'contains'}
        disabled={props.disabled}
        label={props.labels.containsText}
        onChange={setContains}
      />
    </InstructionPanelFrame>;
  },
};
