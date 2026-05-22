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

import type * as React from 'react';

export type RecorderInstructionLabels = {
  textAssertionTitle: string;
  valueAssertionTitle: string;
  selectOptionsAssertionTitle: string;
  expectedText: string;
  expectedValue: string;
  optionTexts: string;
  optionValues: string;
  containsText: string;
  containsValue: string;
  matchByText: string;
  matchByValue: string;
  exactOptions: string;
  containsOptions: string;
  confirm: string;
  edit: string;
  reset: string;
  confirmed: string;
  needsConfirmation: string;
  confirmBeforeSave: string;
};

export type RecorderInstructionDraft = {
  typeId: string;
  config: unknown;
  expanded: boolean;
  confirmed: boolean;
};

export type RecorderInstructionDraftMap = Map<string, RecorderInstructionDraft>;

export type RecorderInstructionPanelProps<TConfig> = {
  instructionId: string;
  config: TConfig;
  disabled: boolean;
  expanded: boolean;
  confirmed: boolean;
  labels: RecorderInstructionLabels;
  onChange: (config: TConfig) => void;
  onConfirm: () => void;
  onEdit: () => void;
  onReset: () => void;
};

export type RecorderInstructionDefinition<TConfig> = {
  typeId: string;
  parse: (actionText: string) => TConfig | null;
  createActionText: (originalActionText: string, config: TConfig) => string;
  renderPanel: (props: RecorderInstructionPanelProps<TConfig>) => React.ReactNode;
};

export type ResolvedRecorderInstruction = {
  definition: RecorderInstructionDefinition<any>;
  config: unknown;
};
