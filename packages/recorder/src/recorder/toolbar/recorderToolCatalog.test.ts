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

import { buildAssertionModeButtons } from './recorderToolCatalog';

const i18n = {
  assertVisible: 'visible',
  assertDisabled: 'disabled',
  assertChecked: 'checked',
  assertText: 'text',
  assertValue: 'value',
  assertPasswordInput: 'password',
  assertSelectOptions: 'select options',
  assertAria: 'aria',
  tooltip: {
    assertVisible: 'visible tip',
    assertDisabled: 'disabled tip',
    assertChecked: 'checked tip',
    assertText: 'text tip',
    assertValue: 'value tip',
    assertPasswordInput: 'password tip',
    assertSelectOptions: 'select options tip',
    assertAria: 'aria tip',
  },
};

test('assertion toolbar exposes merged assertion modes', () => {
  const buttons = buildAssertionModeButtons(i18n);

  assert.deepEqual(buttons.map(button => button.mode), [
    'assertingVisibility',
    'assertingDisabled',
    'assertingChecked',
    'assertingText',
    'assertingValue',
    'assertingPasswordInput',
    'assertingSelectOptions',
    'assertingSnapshot',
  ]);
  assert.equal(buttons.find(button => button.mode === 'assertingChecked')?.label, 'checked');
  assert.equal(buttons.filter(button => button.mode === 'assertingChecked').length, 1);
});
