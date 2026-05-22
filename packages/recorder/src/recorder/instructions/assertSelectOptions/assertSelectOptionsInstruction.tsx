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
type SelectOptionsMatch = 'exact' | 'contains';

export type AssertSelectOptionsInstructionConfig = {
  targetExpression: string;
  matchByText: boolean;
  matchByValue: boolean;
  match: SelectOptionsMatch;
  optionTexts: string;
  optionValues: string;
  sampleOptionTexts: string;
  sampleOptionValues: string;
  allOptionTexts: string;
  allOptionValues: string;
};

type SelectOptionsAssertionArgument = {
  matchBy?: unknown;
  match?: unknown;
  texts?: unknown;
  values?: unknown;
  allTexts?: unknown;
  allValues?: unknown;
};

export const assertSelectOptionsInstructionDefinition: RecorderInstructionDefinition<AssertSelectOptionsInstructionConfig> = {
  typeId: 'assert-select-options',
  parse: actionText => {
    const call = parsePlaywrightAssertionCall(actionText);
    if (!call || call.negated || call.matcher !== 'toHaveSelectOptions')
      return null;
    const parsed = parseJsonArgument(call.argumentText) as SelectOptionsAssertionArgument | null;
    if (!parsed || typeof parsed !== 'object')
      return null;
    const matchBy = parseMatchBy(parsed.matchBy);
    const sampleOptionTexts = arrayToLines(parsed.texts);
    const sampleOptionValues = arrayToLines(parsed.values);
    const allOptionTexts = arrayToLines(parsed.allTexts) || sampleOptionTexts;
    const allOptionValues = arrayToLines(parsed.allValues) || sampleOptionValues;
    const match = parsed.match === 'exact' ? 'exact' : 'contains';
    return {
      targetExpression: call.targetExpression,
      matchByText: matchBy.includes('text'),
      matchByValue: matchBy.includes('value'),
      match,
      optionTexts: match === 'exact' ? allOptionTexts : sampleOptionTexts,
      optionValues: match === 'exact' ? allOptionValues : sampleOptionValues,
      sampleOptionTexts,
      sampleOptionValues,
      allOptionTexts,
      allOptionValues,
    };
  },
  createActionText: (_originalActionText, config) => {
    return createPlaywrightAssertionActionWithArgument(config.targetExpression, 'toHaveSelectOptions', JSON.stringify({
      matchBy: buildMatchBy(config),
      match: config.match,
      texts: splitLines(config.optionTexts),
      values: splitLines(config.optionValues),
    }));
  },
  renderPanel: props => {
    const setMatchByText = (matchByText: boolean) => {
      if (!matchByText && !props.config.matchByValue)
        return;
      props.onChange({ ...props.config, matchByText });
    };
    const setMatchByValue = (matchByValue: boolean) => {
      if (!matchByValue && !props.config.matchByText)
        return;
      props.onChange({ ...props.config, matchByValue });
    };
    const setMatch = (match: SelectOptionsMatch) => {
      if (match === props.config.match)
        return;
      const currentConfig = syncVisibleOptionsToSnapshot(props.config);
      props.onChange({
        ...currentConfig,
        match,
        optionTexts: match === 'exact' ? currentConfig.allOptionTexts : currentConfig.sampleOptionTexts,
        optionValues: match === 'exact' ? currentConfig.allOptionValues : currentConfig.sampleOptionValues,
      });
    };
    const setOptionTexts = (optionTexts: string) => props.onChange(syncVisibleOptionsToSnapshot({
      ...props.config,
      optionTexts,
    }));
    const setOptionValues = (optionValues: string) => props.onChange(syncVisibleOptionsToSnapshot({
      ...props.config,
      optionValues,
    }));
    return <InstructionPanelFrame
      title={props.labels.selectOptionsAssertionTitle}
      labels={props.labels}
      disabled={props.disabled}
      expanded={props.expanded}
      confirmed={props.confirmed}
      onConfirm={props.onConfirm}
      onEdit={props.onEdit}
      onReset={props.onReset}
    >
      <div className='recorder-instruction-checkbox-row'>
        <InstructionCheckbox
          checked={props.config.matchByText}
          disabled={props.disabled || (props.config.matchByText && !props.config.matchByValue)}
          label={props.labels.matchByText}
          onChange={setMatchByText}
        />
        <InstructionCheckbox
          checked={props.config.matchByValue}
          disabled={props.disabled || (props.config.matchByValue && !props.config.matchByText)}
          label={props.labels.matchByValue}
          onChange={setMatchByValue}
        />
      </div>
      <InstructionRadioGroup
        disabled={props.disabled}
        name={`${props.instructionId}-select-options-match`}
        onChange={setMatch}
        options={[
          { value: 'contains', label: props.labels.containsOptions },
          { value: 'exact', label: props.labels.exactOptions },
        ]}
        value={props.config.match}
      />
      <div className='recorder-instruction-two-column'>
        <InstructionField label={props.labels.optionTexts}>
          <InstructionTextarea disabled={props.disabled} onChange={setOptionTexts} rows={6} value={props.config.optionTexts} />
        </InstructionField>
        <InstructionField label={props.labels.optionValues}>
          <InstructionTextarea disabled={props.disabled} onChange={setOptionValues} rows={6} value={props.config.optionValues} />
        </InstructionField>
      </div>
    </InstructionPanelFrame>;
  },
};

function parseMatchBy(value: unknown): SelectMatchBy[] {
  const matchBy: SelectMatchBy[] = [];
  const values = Array.isArray(value) ? value : [value];
  if (values.includes('text'))
    matchBy.push('text');
  if (values.includes('value'))
    matchBy.push('value');
  return matchBy.length ? matchBy : ['text', 'value'];
}

function buildMatchBy(config: AssertSelectOptionsInstructionConfig): SelectMatchBy[] {
  const matchBy: SelectMatchBy[] = [];
  if (config.matchByText)
    matchBy.push('text');
  if (config.matchByValue)
    matchBy.push('value');
  return matchBy.length ? matchBy : ['text'];
}

function syncVisibleOptionsToSnapshot(config: AssertSelectOptionsInstructionConfig): AssertSelectOptionsInstructionConfig {
  if (config.match === 'exact') {
    return {
      ...config,
      allOptionTexts: config.optionTexts,
      allOptionValues: config.optionValues,
    };
  }
  return {
    ...config,
    sampleOptionTexts: config.optionTexts,
    sampleOptionValues: config.optionValues,
  };
}

function arrayToLines(value: unknown): string {
  if (!Array.isArray(value))
    return '';
  return value.map(item => typeof item === 'string' ? item : String(item ?? '')).join('\n');
}

function splitLines(value: string): string[] {
  const lines = value.replace(/\r\n/gu, '\n').split('\n');
  while (lines.length && lines[lines.length - 1] === '')
    lines.pop();
  return lines;
}
