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

import type { ActionPreviewEntry } from '../sources/recordedSourceModel';
import type { RecorderInstructionDraft, RecorderInstructionDraftMap, RecorderInstructionLabels, ResolvedRecorderInstruction } from './types';
import * as React from 'react';
import { assertTextInstructionDefinition } from './assertText/assertTextInstruction';
import { assertValueInstructionDefinition } from './assertValue/assertValueInstruction';

const recorderInstructionDefinitions = [
  assertTextInstructionDefinition,
  assertValueInstructionDefinition,
];

export function resolveRecorderInstruction(actionText: string): ResolvedRecorderInstruction | null {
  for (const definition of recorderInstructionDefinitions) {
    const config = definition.parse(actionText);
    if (config)
      return { definition, config };
  }
  return null;
}

export function reconcileRecorderInstructionDrafts(entries: ActionPreviewEntry[], current: RecorderInstructionDraftMap): RecorderInstructionDraftMap {
  const next: RecorderInstructionDraftMap = new Map();
  for (const entry of entries) {
    const resolved = resolveRecorderInstruction(entry.originalText);
    if (!resolved)
      continue;
    const currentDraft = current.get(entry.instructionId);
    if (currentDraft?.typeId === resolved.definition.typeId) {
      next.set(entry.instructionId, currentDraft);
      continue;
    }
    next.set(entry.instructionId, {
      typeId: resolved.definition.typeId,
      config: resolved.config,
      expanded: true,
      confirmed: false,
    });
  }

  if (next.size !== current.size)
    return next;
  for (const [instructionId, draft] of next) {
    if (current.get(instructionId) !== draft)
      return next;
  }
  return current;
}

export function buildRecorderInstructionActionTextOverrides(entries: ActionPreviewEntry[], drafts: RecorderInstructionDraftMap): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const entry of entries) {
    const resolved = resolveRecorderInstruction(entry.originalText);
    const draft = drafts.get(entry.instructionId);
    if (!resolved || !draft || draft.typeId !== resolved.definition.typeId)
      continue;
    const actionText = resolved.definition.createActionText(entry.originalText, draft.config);
    if (actionText !== entry.originalText)
      overrides.set(entry.instructionId, actionText);
  }
  return overrides;
}

export function hasUnconfirmedRecorderInstructions(entries: ActionPreviewEntry[], drafts: RecorderInstructionDraftMap): boolean {
  for (const entry of entries) {
    const resolved = resolveRecorderInstruction(entry.originalText);
    if (!resolved)
      continue;
    const draft = drafts.get(entry.instructionId);
    if (!draft || draft.typeId !== resolved.definition.typeId || !draft.confirmed)
      return true;
  }
  return false;
}

export const RecorderInstructionPanel: React.FC<{
  entry: ActionPreviewEntry;
  draft: RecorderInstructionDraft | undefined;
  labels: RecorderInstructionLabels;
  disabled: boolean;
  onChange: (instructionId: string, draft: RecorderInstructionDraft) => void;
}> = ({ entry, draft, labels, disabled, onChange }) => {
  const resolved = resolveRecorderInstruction(entry.originalText);
  if (!resolved)
    return null;
  const effectiveDraft: RecorderInstructionDraft = draft?.typeId === resolved.definition.typeId ? draft : {
    typeId: resolved.definition.typeId,
    config: resolved.config,
    expanded: true,
    confirmed: false,
  };
  return <>{resolved.definition.renderPanel({
    instructionId: entry.instructionId,
    config: effectiveDraft.config,
    labels,
    disabled,
    expanded: effectiveDraft.expanded,
    confirmed: effectiveDraft.confirmed,
    onChange: config => onChange(entry.instructionId, {
      ...effectiveDraft,
      config,
      expanded: true,
      confirmed: false,
    }),
    onConfirm: () => onChange(entry.instructionId, {
      ...effectiveDraft,
      expanded: false,
      confirmed: true,
    }),
    onEdit: () => onChange(entry.instructionId, {
      ...effectiveDraft,
      expanded: true,
    }),
    onReset: () => onChange(entry.instructionId, {
      typeId: resolved.definition.typeId,
      config: resolved.config,
      expanded: true,
      confirmed: false,
    }),
  })}</>;
};
