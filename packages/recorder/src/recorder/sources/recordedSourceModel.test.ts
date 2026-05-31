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

function sourceWithActions(actions: string[], actionContexts?: Source['actionContexts'], actionTargetExpressions?: Source['actionTargetExpressions']): Source {
  return {
    isRecorded: true,
    id: 'playwright-test',
    label: 'Playwright Test',
    text: actions.join('\n'),
    language: 'javascript',
    highlight: [],
    actions,
    ...(actionContexts ? { actionContexts } : {}),
    ...(actionTargetExpressions ? { actionTargetExpressions } : {}),
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

test('uses structured action metadata as the summary for multiline recorded actions', () => {
  const multilineAction = `const download1Promise = page.waitForEvent('download');
await page.getByRole('button', { name: 'CSV出力' }).click();
const download1 = await download1Promise;`;
  const sources = [sourceWithActions([multilineAction], [{
    frame: {
      pageGuid: 'page@1',
      pageAlias: 'page',
      framePath: [],
    },
    startTime: 0,
    action: {
      name: 'click',
      selector: 'internal:role=button[name="CSV出力"i]',
      button: 'left',
      modifiers: 0,
      clickCount: 1,
      signals: [{ name: 'download', downloadAlias: '1' }],
    },
  }], ["page.getByRole('button', { name: 'CSV出力' })"])];

  const [entry] = choosePreviewActions(sources, new Set());

  assert.equal(entry.text, "await page.getByRole('button', { name: 'CSV出力' }).click();");
  assert.equal(entry.detailText, multilineAction);
  assert.equal(entry.isMultiline, true);
  assert.deepEqual(entry.signalNames, ['download']);
});

test('keeps single line recorded action summaries unchanged', () => {
  const actionText = "await page.getByRole('link', { name: 'ユーザ管理' }).click();";
  const sources = [sourceWithActions([actionText])];

  const [entry] = choosePreviewActions(sources, new Set());

  assert.equal(entry.text, actionText);
  assert.equal(entry.detailText, actionText);
  assert.equal(entry.isMultiline, false);
  assert.deepEqual(entry.signalNames, []);
});
