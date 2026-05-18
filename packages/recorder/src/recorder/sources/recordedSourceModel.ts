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
  text: string;
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

function actionKey(source: Source, action: string, index: number): string {
  return `${source.id}:${index}:${hashActionText(action)}`;
}

export function applyDeletedActionKeys(sources: Source[], deletedActionKeys: Set<string>): Source[] {
  if (!deletedActionKeys.size)
    return sources;
  return sources.map(source => {
    if (!source.isRecorded || !source.actions?.length)
      return source;
    const actions = source.actions.filter((action, index) => !deletedActionKeys.has(actionKey(source, action, index)));
    return { ...source, actions };
  });
}

export function choosePreviewActions(sources: Source[], deletedActionKeys: Set<string>): ActionPreviewEntry[] {
  const source = sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? chooseRecordedSource(sources);
  if (!source)
    return [];
  return (source.actions ?? []).flatMap((action, index) => {
    const key = actionKey(source, action, index);
    if (deletedActionKeys.has(key))
      return [];
    const text = normalizePreviewAction(action);
    return text ? [{ key, text }] : [];
  });
}
