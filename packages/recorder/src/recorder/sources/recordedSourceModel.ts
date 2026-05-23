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

import type { Source } from '../../recorderTypes';

export type ActionPreviewEntry = {
  key: string;
  instructionId: string;
  text: string;
  originalText: string;
};

function chooseRecordedSource(sources: Source[]): Source | undefined {
  return sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? sources.find(candidate => candidate.isRecorded && candidate.actions?.length);
}

function normalizePreviewAction(action: string): string {
  return action.trim().split('\n').find(line => line.trim().length > 0)?.trim() ?? '';
}

function hashActionText(action: string): string {
  let hash = 0;
  for (let i = 0; i < action.length; i++)
    hash = Math.imul(31, hash) + action.charCodeAt(i) | 0;
  return (hash >>> 0).toString(36);
}

export function recordedActionKey(source: Source, action: string, index: number): string {
  return source.actionIds?.[index] ?? `${source.id}:${index}:${hashActionText(action)}`;
}

export function applyRecordedActionEdits(sources: Source[], deletedActionKeys: Set<string>, actionTextOverrides: ReadonlyMap<string, string>): Source[] {
  if (!deletedActionKeys.size && !actionTextOverrides.size)
    return sources;
  return sources.map(source => {
    if (!source.isRecorded || !source.actions?.length)
      return source;
    const actions = source.actions.flatMap((action, index) => {
      const key = recordedActionKey(source, action, index);
      if (deletedActionKeys.has(key))
        return [];
      return [actionTextOverrides.get(key) ?? action];
    });
    const actionIds = source.actionIds?.filter((id, index) => !deletedActionKeys.has(id) && source.actions?.[index] !== undefined);
    return { ...source, actions, ...(actionIds ? { actionIds } : {}) };
  });
}

export function applyDeletedActionKeys(sources: Source[], deletedActionKeys: Set<string>): Source[] {
  return applyRecordedActionEdits(sources, deletedActionKeys, new Map());
}

export function choosePreviewActions(sources: Source[], deletedActionKeys: Set<string>, actionTextOverrides: ReadonlyMap<string, string> = new Map()): ActionPreviewEntry[] {
  const source = sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? chooseRecordedSource(sources);
  if (!source)
    return [];
  return (source.actions ?? []).flatMap((action, index) => {
    const key = recordedActionKey(source, action, index);
    if (deletedActionKeys.has(key))
      return [];
    const actionText = actionTextOverrides.get(key) ?? action;
    const text = normalizePreviewAction(actionText);
    return text ? [{ key, instructionId: key, text, originalText: action }] : [];
  });
}
