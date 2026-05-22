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

import assert from 'node:assert/strict';
import test from 'node:test';

import { applyRecordedActionEdits, choosePreviewActions } from './recordedSourceModel';
import type { Source } from '../../recorderTypes';

function sourceWithActions(actions: string[]): Source {
  return {
    isRecorded: true,
    id: 'playwright-test',
    label: 'Playwright Test',
    text: actions.join('\n'),
    language: 'javascript',
    highlight: [],
    actions,
  };
}

test('applies action text overrides before deletion compacts recorded action indexes', () => {
  const sources = [sourceWithActions([
    "await page.getByText('Cancel').click();",
    "await expect(page.getByLabel('Email')).toHaveValue('old@example.com');",
  ])];
  const [deletedAction, editedAction] = choosePreviewActions(sources, new Set());
  const overrides = new Map([[editedAction.instructionId, "await expect(page.getByLabel('Email')).toHaveValue(\"new@example.com\");"]]);

  const editedSources = applyRecordedActionEdits(sources, new Set([deletedAction.key]), overrides);

  assert.deepEqual(editedSources[0].actions, [
    "await expect(page.getByLabel('Email')).toHaveValue(\"new@example.com\");",
  ]);
});
