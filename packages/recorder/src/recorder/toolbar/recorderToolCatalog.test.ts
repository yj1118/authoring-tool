import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssertionModeButtons } from './recorderToolCatalog';

const i18n = {
  assertVisible: 'visible',
  assertDisabled: 'disabled',
  assertNotDisabled: 'not disabled',
  assertChecked: 'checked',
  assertUnchecked: 'unchecked',
  assertText: 'text',
  assertValue: 'value',
  assertAria: 'aria',
  tooltip: {
    assertVisible: 'visible tip',
    assertDisabled: 'disabled tip',
    assertNotDisabled: 'not disabled tip',
    assertChecked: 'checked tip',
    assertUnchecked: 'unchecked tip',
    assertText: 'text tip',
    assertValue: 'value tip',
    assertAria: 'aria tip',
  },
};

test('assertion toolbar exposes separate checked and unchecked modes', () => {
  const buttons = buildAssertionModeButtons(i18n);

  assert.deepEqual(buttons.map(button => button.mode), [
    'assertingVisibility',
    'assertingDisabled',
    'assertingNotDisabled',
    'assertingChecked',
    'assertingUnchecked',
    'assertingText',
    'assertingValue',
    'assertingSnapshot',
  ]);
  assert.equal(buttons.find(button => button.mode === 'assertingChecked')?.label, 'checked');
  assert.equal(buttons.find(button => button.mode === 'assertingUnchecked')?.label, 'unchecked');
});
