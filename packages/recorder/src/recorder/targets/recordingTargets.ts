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

import type { RecordingTarget, RecorderLocale } from '../../recorderTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    return undefined;
  return value;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
    : [];
}

function parseExecutionTaskTarget(payload: Record<string, unknown>): RecordingTarget | null {
  const caseId = normalizeOptionalString(payload.caseId);
  const caseVersionId = normalizeOptionalString(payload.caseVersionId);
  const taskId = normalizeOptionalString(payload.taskId);
  const sourceStepIds = normalizeStringArray(payload.sourceStepIds);
  const instructionHash = normalizeOptionalString(payload.instructionHash);
  const planVersion = normalizeOptionalString(payload.planVersion);
  if (!caseId || !caseVersionId || !taskId || !sourceStepIds.length || !instructionHash || !planVersion)
    return null;

  return {
    kind: 'execution_task',
    caseId,
    caseVersionId,
    taskId,
    sourceStepIds,
    instructionHash,
    planVersion,
    title: normalizeOptionalString(payload.title),
    instruction: normalizeOptionalString(payload.instruction),
  };
}

function parseCaseStepTarget(payload: Record<string, unknown>): RecordingTarget | null {
  const caseId = normalizeOptionalString(payload.caseId);
  const stepId = normalizeOptionalString(payload.stepId);
  if (!caseId || !stepId)
    return null;

  return {
    kind: 'case_step',
    caseId,
    stepId,
    stepIndex: normalizeOptionalPositiveInteger(payload.stepIndex),
    stepText: normalizeOptionalString(payload.stepText),
    moduleKind: normalizeOptionalString(payload.moduleKind) ?? 'recording.script',
  };
}

export function parseRecordingTargetFromPayload(payload: unknown): RecordingTarget | null {
  if (!isRecord(payload))
    return null;

  if (isRecord(payload.target)) {
    if (payload.target.kind === 'execution_task')
      return parseExecutionTaskTarget(payload.target);
    if (payload.target.kind === 'case_step')
      return parseCaseStepTarget(payload.target);
  }

  return parseCaseStepTarget(payload);
}

export function recordingTargetKey(target: RecordingTarget): string {
  if (target.kind === 'execution_task') {
    return [
      'execution_task',
      target.caseId,
      target.caseVersionId,
      target.taskId,
      target.instructionHash,
      target.sourceStepIds.join(','),
    ].map(encodeURIComponent).join(':');
  }
  return ['case_step', target.caseId, target.stepId].map(encodeURIComponent).join(':');
}

export function recordingTargetModuleKind(target: RecordingTarget): string {
  return target.kind === 'execution_task'
    ? 'execution.package'
    : target.moduleKind ?? 'recording.script';
}

export function recordingTargetTitle(target: RecordingTarget, locale: RecorderLocale): string {
  if (target.kind === 'execution_task') {
    if (target.title)
      return target.title;
    if (locale === 'zh-CN')
      return `任务 ${target.taskId}`;
    if (locale === 'zh-TW')
      return `任務 ${target.taskId}`;
    if (locale === 'ja-JP')
      return `タスク ${target.taskId}`;
    return `Task ${target.taskId}`;
  }

  if (target.stepIndex) {
    if (locale === 'zh-CN')
      return `步骤 ${target.stepIndex}`;
    if (locale === 'zh-TW')
      return `步驟 ${target.stepIndex}`;
    if (locale === 'ja-JP')
      return `ステップ ${target.stepIndex}`;
    if (locale === 'en')
      return `Step ${target.stepIndex}`;
    return `Step ${target.stepIndex}`;
  }
  return target.stepId;
}

export function recordingTargetBody(target: RecordingTarget): string | undefined {
  return target.kind === 'execution_task'
    ? target.instruction
    : target.stepText;
}

export type RecordingTargetViewModel = {
  key: string;
  kind: RecordingTarget['kind'];
  title: string;
  body?: string;
};

export function recordingTargetViewModel(target: RecordingTarget, locale: RecorderLocale): RecordingTargetViewModel {
  return {
    key: recordingTargetKey(target),
    kind: target.kind,
    title: recordingTargetTitle(target, locale),
    body: recordingTargetBody(target),
  };
}

export class RecordingTargetCatalog {
  private _targets = new Map<string, RecordingTarget>();
  private _activeTargetKey: string | undefined;

  upsert(target: RecordingTarget): string {
    const key = recordingTargetKey(target);
    this._targets.delete(key);
    this._targets.set(key, target);
    this._activeTargetKey = key;
    return key;
  }

  activate(key: string): RecordingTarget | null {
    const target = this._targets.get(key);
    if (!target)
      return null;
    this._activeTargetKey = key;
    return target;
  }

  activeTarget(): RecordingTarget | null {
    return this._activeTargetKey ? this._targets.get(this._activeTargetKey) ?? null : null;
  }

  viewModels(locale: RecorderLocale): RecordingTargetViewModel[] {
    return [...this._targets.values()].map(target => recordingTargetViewModel(target, locale));
  }
}

export type ActiveTargetViewModel<TContext> = {
  context: TContext;
  viewModel: RecordingTargetViewModel;
};

export class ActiveTargetController<TContext extends { target: RecordingTarget }> {
  private _catalog = new RecordingTargetCatalog();
  private _contexts = new Map<string, TContext>();

  upsert(context: TContext): string {
    const key = this._catalog.upsert(context.target);
    this._contexts.delete(key);
    this._contexts.set(key, context);
    return key;
  }

  activate(key: string): TContext | null {
    if (!this._catalog.activate(key))
      return null;
    return this._contexts.get(key) ?? null;
  }

  activeContext(): TContext | null {
    const target = this._catalog.activeTarget();
    return target ? this._contexts.get(recordingTargetKey(target)) ?? null : null;
  }

  contexts(): TContext[] {
    return [...this._contexts.values()];
  }

  viewModels(locale: RecorderLocale): ActiveTargetViewModel<TContext>[] {
    return this._catalog.viewModels(locale).flatMap(viewModel => {
      const context = this._contexts.get(viewModel.key);
      return context ? [{ context, viewModel }] : [];
    });
  }
}

export class RecordingScriptBuffer<TSource> {
  private _buffers = new Map<string, { sources: TSource[]; deletedActionKeys: string[] }>();

  save(key: string, buffer: { sources: TSource[]; deletedActionKeys: Iterable<string> }): void {
    this._buffers.set(key, {
      sources: [...buffer.sources],
      deletedActionKeys: [...buffer.deletedActionKeys],
    });
  }

  read(key: string): { sources: TSource[]; deletedActionKeys: string[] } | null {
    const buffer = this._buffers.get(key);
    return buffer ? { sources: [...buffer.sources], deletedActionKeys: [...buffer.deletedActionKeys] } : null;
  }

  clear(key: string): void {
    this._buffers.delete(key);
  }

  hasContent(key: string): boolean {
    const buffer = this._buffers.get(key);
    return !!buffer && (buffer.sources.length > 0 || buffer.deletedActionKeys.length > 0);
  }
}
