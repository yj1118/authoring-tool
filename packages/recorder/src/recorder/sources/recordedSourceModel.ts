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
  detailText: string;
  isMultiline: boolean;
  signalNames: string[];
  originalText: string;
  actionContext?: NonNullable<Source['actionContexts']>[number];
  actionTargetExpression?: string;
};

function chooseRecordedSource(sources: Source[]): Source | undefined {
  return sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? sources.find(candidate => candidate.isRecorded && candidate.actions?.length);
}

function normalizePreviewAction(action: string): string {
  return action.trim().split('\n').find(line => line.trim().length > 0)?.trim() ?? '';
}

function isMultilineAction(action: string): boolean {
  return action.trim().split('\n').filter(line => line.trim().length > 0).length > 1;
}

function previewText(actionText: string, actionContext: NonNullable<Source['actionContexts']>[number] | undefined, actionTargetExpression: string | undefined): string {
  const normalized = normalizePreviewAction(actionText);
  if (!isMultilineAction(actionText))
    return normalized;
  const lines = actionText.trim().split('\n').map(line => line.trim()).filter(Boolean);
  if (actionTargetExpression) {
    const targetLine = lines.find(line => line.includes(actionTargetExpression));
    if (targetLine)
      return targetLine;
  }

  const pageAlias = actionContext?.frame.pageAlias;
  const actionName = actionContext?.action.name;
  if (pageAlias && (actionName === 'navigate' || actionName === 'openPage')) {
    const gotoLine = lines.find(line => line.includes(`${pageAlias}.goto(`));
    if (gotoLine)
      return gotoLine;
  }
  if (pageAlias && actionName === 'closePage') {
    const closeLine = lines.find(line => line.includes(`${pageAlias}.close(`));
    if (closeLine)
      return closeLine;
  }
  return normalized;
}

function previewSignalNames(actionContext: NonNullable<Source['actionContexts']>[number] | undefined): string[] {
  const signalNames = new Set<string>();
  for (const signal of actionContext?.action.signals ?? []) {
    if (signal.name === 'dialog' || signal.name === 'download' || signal.name === 'popup')
      signalNames.add(signal.name);
  }
  return [...signalNames];
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
    const nextActions: string[] = [];
    const nextActionIds: string[] = [];
    const nextActionContexts: NonNullable<Source['actionContexts']> = [];
    const nextActionTargetExpressions: string[] = [];
    for (const [index, action] of source.actions.entries()) {
      const key = recordedActionKey(source, action, index);
      if (deletedActionKeys.has(key))
        continue;
      nextActions.push(actionTextOverrides.get(key) ?? action);
      const actionId = source.actionIds?.[index];
      if (actionId)
        nextActionIds.push(actionId);
      const actionContext = source.actionContexts?.[index];
      if (actionContext)
        nextActionContexts.push(actionContext);
      const actionTargetExpression = source.actionTargetExpressions?.[index];
      if (actionTargetExpression)
        nextActionTargetExpressions.push(actionTargetExpression);
    }
    return {
      ...source,
      actions: nextActions,
      ...(nextActionIds.length ? { actionIds: nextActionIds } : {}),
      ...(nextActionContexts.length === nextActions.length ? { actionContexts: nextActionContexts } : {}),
      ...(nextActionTargetExpressions.length === nextActions.length ? { actionTargetExpressions: nextActionTargetExpressions } : {}),
    };
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
    const actionContext = source.actionContexts?.[index];
    const actionTargetExpression = source.actionTargetExpressions?.[index] ?? undefined;
    const text = previewText(actionText, actionContext, actionTargetExpression);
    return text ? [{
      key,
      instructionId: key,
      text,
      detailText: actionText.trim(),
      isMultiline: isMultilineAction(actionText),
      signalNames: previewSignalNames(actionContext),
      originalText: action,
      actionContext,
      actionTargetExpression,
    }] : [];
  });
}
