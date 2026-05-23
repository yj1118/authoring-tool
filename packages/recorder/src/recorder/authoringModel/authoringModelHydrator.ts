/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { RECORDING_AUTHORING_MODEL_SCHEMA, type RecordingAuthoringModelV1 } from './authoringModelTypes';
import type { RecorderInstructionDraftMap } from '../instructions/types';
import type { Source } from '../../recorderTypes';

export type HydratedRecordingAuthoringModel = {
  sources: Source[];
  instructionDrafts: RecorderInstructionDraftMap;
};

export function isRecordingAuthoringModel(value: unknown): value is RecordingAuthoringModelV1 {
  return Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && (value as RecordingAuthoringModelV1).schema === RECORDING_AUTHORING_MODEL_SCHEMA
      && typeof (value as RecordingAuthoringModelV1).sourceId === 'string'
      && Array.isArray((value as RecordingAuthoringModelV1).actions),
  );
}

export function hydrateRecordingAuthoringModel(model: RecordingAuthoringModelV1 | null | undefined): HydratedRecordingAuthoringModel {
  if (!isRecordingAuthoringModel(model) || model.actions.length === 0) {
    return {
      sources: [],
      instructionDrafts: new Map(),
    };
  }

  const actions = model.actions
      .filter(action => typeof action.actionId === 'string' && action.actionId.trim() && typeof action.actionText === 'string' && action.actionText.trim())
      .map(action => ({
        actionId: action.actionId.trim(),
        actionText: action.actionText,
        instructionDraft: action.instructionDraft,
      }));
  if (!actions.length) {
    return {
      sources: [],
      instructionDrafts: new Map(),
    };
  }

  const instructionDrafts: RecorderInstructionDraftMap = new Map();
  for (const action of actions) {
    if (action.instructionDraft?.typeId)
      instructionDrafts.set(action.actionId, action.instructionDraft);
  }

  return {
    sources: [{
      isRecorded: true,
      id: model.sourceId || 'playwright-test',
      label: 'Playwright Test',
      text: actions.map(action => action.actionText).join('\n'),
      language: 'javascript',
      highlight: [],
      actions: actions.map(action => action.actionText),
      actionIds: actions.map(action => action.actionId),
    }],
    instructionDrafts,
  };
}
