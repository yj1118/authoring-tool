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

import { createPlaywrightAssertionAction, parsePlaywrightAssertionCall, parseStringArgument, quoteRegexLiteral } from './playwrightAssertion';

test('parses assertion target with nested locator arguments', () => {
  const call = parsePlaywrightAssertionCall("await expect(page.getByRole('button', { name: 'Save (draft)' })).toHaveText('Ready');");

  assert.equal(call?.targetExpression, "page.getByRole('button', { name: 'Save (draft)' })");
  assert.equal(call?.matcher, 'toHaveText');
  assert.equal(call?.argumentText, "'Ready'");
  assert.equal(call?.negated, false);
});

test('parses simple string assertion arguments', () => {
  assert.equal(parseStringArgument("'Line\\nTwo'"), 'Line\nTwo');
  assert.equal(parseStringArgument('"quoted"'), 'quoted');
});

test('creates assertion action text from edited config', () => {
  assert.equal(
      createPlaywrightAssertionAction("page.getByLabel('Email')", 'toHaveValue', 'test@example.com'),
      'await expect(page.getByLabel(\'Email\')).toHaveValue("test@example.com");',
  );
  assert.equal(
      createPlaywrightAssertionAction("page.getByLabel('Email')", 'toBeEmpty'),
      'await expect(page.getByLabel(\'Email\')).toBeEmpty();',
  );
});

test('quotes contains-value text as a safe regex literal', () => {
  assert.equal(quoteRegexLiteral('a+b/c'), '/a\\+b\\/c/');
  assert.equal(quoteRegexLiteral('line 1\nline 2'), '/line 1\\nline 2/');
});
