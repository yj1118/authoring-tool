/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { choosePreviewActions } from '../sources/recordedSourceModel';
import { RECORDING_AUTHORING_MODEL_SCHEMA, type RecordingAuthoringModelV1 } from './authoringModelTypes';
import type { RecorderInstructionDraftMap } from '../instructions/types';
import type { Source } from '../../recorderTypes';

export function buildRecordingAuthoringModel(input: {
  actionTextOverrides: ReadonlyMap<string, string>;
  createdAt?: string;
  deletedActionKeys: Set<string>;
  instructionDrafts: RecorderInstructionDraftMap;
  sourceId: string;
  sources: Source[];
}): RecordingAuthoringModelV1 {
  const entries = choosePreviewActions(input.sources, input.deletedActionKeys, input.actionTextOverrides);
  return {
    schema: RECORDING_AUTHORING_MODEL_SCHEMA,
    sourceId: input.sourceId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    tool: {
      name: 'authoring-tool-recorder',
    },
    actions: entries.map(entry => {
      const draft = input.instructionDrafts.get(entry.instructionId);
      return {
        actionId: entry.key,
        actionText: input.actionTextOverrides.get(entry.key) ?? entry.originalText,
        ...(draft ? { instructionDraft: draft } : {}),
      };
    }),
  };
}
