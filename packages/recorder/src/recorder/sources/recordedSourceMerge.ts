/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import type { Source } from '../../recorderTypes';

function hasRecordedActions(source: Source): boolean {
  return Boolean(source.isRecorded && source.actions?.length);
}

function hasActionPrefix(actions: string[], prefix: string[]): boolean {
  return prefix.every((action, index) => actions[index] === action);
}

function mergeRecordedSource(base: Source, current: Source): Source {
  const baseActions = base.actions ?? [];
  const currentActions = current.actions ?? [];
  if (!baseActions.length)
    return current;
  if (!currentActions.length)
    return { ...base };
  if (hasActionPrefix(currentActions, baseActions))
    return current;

  const actions = [...baseActions, ...currentActions];
  const actionIds = [...(base.actionIds ?? []), ...(current.actionIds ?? [])];
  return {
    ...current,
    actions,
    ...(actionIds.length ? { actionIds } : {}),
    text: actions.join('\n'),
  };
}

export function mergeRecordedSourceBaselines(baseSources: Source[], currentSources: Source[]): Source[] {
  if (!baseSources.length)
    return currentSources;

  const baseById = new Map<string, Source>();
  for (const source of baseSources) {
    if (hasRecordedActions(source))
      baseById.set(source.id, source);
  }
  if (!baseById.size)
    return currentSources;

  const mergedIds = new Set<string>();
  const mergedSources = currentSources.map(source => {
    const base = source.isRecorded ? baseById.get(source.id) : undefined;
    if (!base)
      return source;
    mergedIds.add(source.id);
    return mergeRecordedSource(base, source);
  });

  for (const source of baseSources) {
    if (hasRecordedActions(source) && !mergedIds.has(source.id))
      mergedSources.push(source);
  }

  return mergedSources;
}
