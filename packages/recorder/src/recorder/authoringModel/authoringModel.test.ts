/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import assert from 'node:assert';
import { test } from 'node:test';

import type { RecordingAuthoringModelV1, Source } from '../../recorderTypes';
import { buildRecordingAuthoringModel } from './authoringModelBuilder';
import { hydrateRecordingAuthoringModel, isRecordingAuthoringModel } from './authoringModelHydrator';
import { RECORDING_AUTHORING_MODEL_SCHEMA } from './authoringModelTypes';
import { mergeRecordedSourceBaselines } from '../sources/recordedSourceMerge';

const recordedSource: Source = {
  isRecorded: true,
  id: 'playwright-test',
  label: 'Playwright Test',
  text: '',
  language: 'javascript',
  highlight: [],
  actions: [
    "await page.getByText('A').click();",
    "await expect(page.getByLabel('Name')).toHaveValue('old');",
  ],
  actionIds: ['action-a', 'action-b'],
};

test('buildRecordingAuthoringModel stores edited actions and instruction drafts', () => {
  const model = buildRecordingAuthoringModel({
    actionTextOverrides: new Map([
      ['action-b', "await expect(page.getByLabel('Name')).toHaveValue('new');"],
    ]),
    createdAt: '2026-05-23T00:00:00.000Z',
    deletedActionKeys: new Set(['action-a']),
    instructionDrafts: new Map([
      ['action-b', {
        typeId: 'assert-value',
        config: { expectedValue: 'new' },
        expanded: true,
        confirmed: false,
      }],
    ]),
    sourceId: 'playwright-test',
    sources: [recordedSource],
  });

  assert.equal(model.schema, RECORDING_AUTHORING_MODEL_SCHEMA);
  assert.equal(model.sourceId, 'playwright-test');
  assert.deepEqual(model.actions, [{
    actionId: 'action-b',
    actionText: "await expect(page.getByLabel('Name')).toHaveValue('new');",
    instructionDraft: {
      typeId: 'assert-value',
      config: { expectedValue: 'new' },
      expanded: true,
      confirmed: false,
    },
  }]);
});

test('hydrateRecordingAuthoringModel restores action ids and drafts for recorder editing', () => {
  const model: RecordingAuthoringModelV1 = {
    schema: RECORDING_AUTHORING_MODEL_SCHEMA,
    sourceId: 'playwright-test',
    createdAt: '2026-05-23T00:00:00.000Z',
    tool: { name: 'authoring-tool-recorder' },
    actions: [{
      actionId: 'action-1',
      actionText: "await expect(page.locator('form')).toContainText('Name');",
      instructionDraft: {
        typeId: 'assert-text',
        config: { expectedText: 'Name' },
        expanded: false,
        confirmed: true,
      },
    }],
  };

  assert.equal(isRecordingAuthoringModel(model), true);

  const hydrated = hydrateRecordingAuthoringModel(model);
  assert.equal(hydrated.sources.length, 1);
  assert.deepEqual(hydrated.sources[0]?.actions, [
    "await expect(page.locator('form')).toContainText('Name');",
  ]);
  assert.deepEqual(hydrated.sources[0]?.actionIds, ['action-1']);
  assert.deepEqual(hydrated.instructionDrafts.get('action-1'), {
    typeId: 'assert-text',
    config: { expectedText: 'Name' },
    expanded: false,
    confirmed: true,
  });
});

test('mergeRecordedSourceBaselines appends newly recorded actions to restored actions', () => {
  const currentSource: Source = {
    isRecorded: true,
    id: 'playwright-test',
    label: 'Playwright Test',
    text: '',
    language: 'javascript',
    highlight: [],
    actions: [
      "await page.getByText('C').click();",
    ],
  };

  const [merged] = mergeRecordedSourceBaselines([recordedSource], [currentSource]);

  assert.deepEqual(merged?.actions, [
    "await page.getByText('A').click();",
    "await expect(page.getByLabel('Name')).toHaveValue('old');",
    "await page.getByText('C').click();",
  ]);
  assert.deepEqual(merged?.actionIds, ['action-a', 'action-b']);
});

test('mergeRecordedSourceBaselines does not duplicate a restored prefix', () => {
  const currentSource: Source = {
    isRecorded: true,
    id: 'playwright-test',
    label: 'Playwright Test',
    text: '',
    language: 'javascript',
    highlight: [],
    actions: [
      "await page.getByText('A').click();",
      "await expect(page.getByLabel('Name')).toHaveValue('old');",
      "await page.getByText('C').click();",
    ],
    actionIds: ['action-a', 'action-b', 'action-c'],
  };

  const [merged] = mergeRecordedSourceBaselines([recordedSource], [currentSource]);

  assert.deepEqual(merged?.actions, currentSource.actions);
  assert.deepEqual(merged?.actionIds, currentSource.actionIds);
});
