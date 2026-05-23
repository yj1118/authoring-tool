import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCheckedInstructionDefinition } from './assertCheckedInstruction';

test('parses and edits checked assertions', () => {
  const checked = assertCheckedInstructionDefinition.parse("await expect(page.getByLabel('Agree')).toBeChecked();");
  assert.deepEqual(checked, {
    targetExpression: "page.getByLabel('Agree')",
    checked: true,
  });
  assert.equal(
      assertCheckedInstructionDefinition.createActionText('', { targetExpression: "page.getByLabel('Agree')", checked: false }),
      "await expect(page.getByLabel('Agree')).not.toBeChecked();",
  );

  const unchecked = assertCheckedInstructionDefinition.parse("await expect(page.getByLabel('Agree')).not.toBeChecked();");
  assert.deepEqual(unchecked, {
    targetExpression: "page.getByLabel('Agree')",
    checked: false,
  });
  assert.equal(
      assertCheckedInstructionDefinition.createActionText('', { targetExpression: "page.getByLabel('Agree')", checked: true }),
      "await expect(page.getByLabel('Agree')).toBeChecked();",
  );
});
