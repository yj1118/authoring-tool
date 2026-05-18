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

import { resolveCheckedControlTarget } from './checkedControlResolver';

type FakeElement = {
  nodeName: string;
  type?: string;
  parentElement: FakeElement | null;
  children: FakeElement[];
  control?: FakeElement | null;
  closest(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
};

function element(nodeName: string, children: FakeElement[] = []): FakeElement {
  const fake: FakeElement = {
    nodeName,
    parentElement: null,
    children,
    closest(selector: string) {
      if (selector !== 'label')
        return null;
      let current: FakeElement | null = fake;
      while (current) {
        if (current.nodeName === 'LABEL')
          return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector !== 'input[type=checkbox], input[type=radio]')
        return [];
      const matches: FakeElement[] = [];
      const visit = (candidate: FakeElement) => {
        if (candidate.nodeName === 'INPUT' && (candidate.type === 'checkbox' || candidate.type === 'radio'))
          matches.push(candidate);
        for (const child of candidate.children)
          visit(child);
      };
      for (const child of fake.children)
        visit(child);
      return matches;
    },
  };
  for (const child of children)
    child.parentElement = fake;
  return fake;
}

function input(type: string): FakeElement {
  const fake = element('INPUT');
  fake.type = type;
  return fake;
}

function label(children: FakeElement[], control?: FakeElement | null): FakeElement {
  const fake = element('LABEL', children);
  fake.control = control ?? null;
  return fake;
}

void test('resolves checked controls from direct inputs, labels, and parent containers', () => {
  const checkbox = input('checkbox');
  assert.deepEqual(resolveCheckedControlTarget(checkbox as unknown as Element), {
    ok: true,
    control: checkbox,
    highlightElement: checkbox,
    kind: 'self',
    matchCount: 1,
  });

  const radio = input('radio');
  const text = element('SPAN');
  const radioLabel = label([text], radio);
  const labelResult = resolveCheckedControlTarget(text as unknown as Element);
  assert.equal(labelResult.ok, true);
  assert.equal(labelResult.kind, 'label_control');
  if (labelResult.ok)
    assert.equal(labelResult.highlightElement, radioLabel);

  const nestedCheckbox = input('checkbox');
  const parent = element('DIV', [element('SPAN'), nestedCheckbox]);
  const parentResult = resolveCheckedControlTarget(parent as unknown as Element);
  assert.equal(parentResult.ok, true);
  assert.equal(parentResult.kind, 'descendant');

  const rowText = element('SPAN');
  element('DIV', [rowText, input('checkbox')]);
  const ancestorResult = resolveCheckedControlTarget(rowText as unknown as Element);
  assert.equal(ancestorResult.ok, true);
  assert.equal(ancestorResult.kind, 'ancestor_descendant');
});

void test('does not resolve ambiguous checkbox/radio containers', () => {
  const group = element('DIV', [input('radio'), input('radio')]);
  const result = resolveCheckedControlTarget(group as unknown as Element);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ambiguous');
  assert.equal(result.kind, 'descendant');
  assert.equal(result.matchCount, 2);
});
