import assert from 'node:assert/strict';
import test from 'node:test';

import { assertDisabledInstructionDefinition } from './assertDisabledInstruction';

test('parses and edits disabled assertions', () => {
  const disabled = assertDisabledInstructionDefinition.parse("await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();");
  assert.deepEqual(disabled, {
    targetExpression: "page.getByRole('button', { name: 'Next' })",
    disabled: true,
  });
  assert.equal(
      assertDisabledInstructionDefinition.createActionText('', { targetExpression: "page.getByRole('button', { name: 'Next' })", disabled: false }),
      "await expect(page.getByRole('button', { name: 'Next' })).not.toBeDisabled();",
  );

  const enabled = assertDisabledInstructionDefinition.parse("await expect(page.getByRole('button', { name: 'Next' })).not.toBeDisabled();");
  assert.deepEqual(enabled, {
    targetExpression: "page.getByRole('button', { name: 'Next' })",
    disabled: false,
  });
  assert.equal(
      assertDisabledInstructionDefinition.createActionText('', { targetExpression: "page.getByRole('button', { name: 'Next' })", disabled: true }),
      "await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();",
  );
});
