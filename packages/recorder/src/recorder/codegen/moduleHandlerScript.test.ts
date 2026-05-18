import assert from 'node:assert/strict';
import test from 'node:test';

import type { Source } from '../../recorderTypes';
import { RecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { generateModuleHandlerScriptFromSources } from './moduleHandlerScript';
import { RECORDING_EXPECT_CALL_NAME, RECORDING_EXPECT_RUNTIME_SOURCE } from './runtime/recordingExpectRuntime';

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

test('generates a Playwright Page recording script from Playwright actions and assertions', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await page.getByText('Submit').click();",
      "await expect(page.getByRole('button', { name: 'OK' })).toBeVisible();",
      "await expect(page.getByRole('button', { name: 'Next' })).not.toBeDisabled();",
      "await page.locator('body').evaluate((element, position) => { element.scrollTo(position.x, position.y); }, { x: 0, y: 400 });",
    ]),
  ]);

  assert.match(generated.scriptText, /export default async function recording\(page, context\)/u);
  assert.doesNotMatch(generated.scriptText, /context\.playwright\.page/u);
  assert.doesNotMatch(generated.scriptText, /\btest\s*\(/u);
  assert.doesNotMatch(generated.scriptText, /\b(?:browser|context)\.newPage\s*\(/u);
  assert.ok(generated.scriptText.startsWith(RECORDING_EXPECT_RUNTIME_SOURCE));
  assert.match(generated.scriptText, /createRecordingExpect/u);
  assert.match(generated.scriptText, new RegExp(`const ${RECORDING_EXPECT_CALL_NAME} = locator => createRecordingExpect\\(locator, false, recordingAssertions\\)`, 'u'));
  assert.match(generated.scriptText, /assertions: recordingAssertions/u);
  assert.match(generated.scriptText, new RegExp(`await ${RECORDING_EXPECT_CALL_NAME}\\(page\\.getByRole`, 'u'));
  assert.doesNotMatch(generated.scriptText, /await expect\s*\(/u);
  assert.match(generated.scriptText, /scrollTo\(position\.x, position\.y\)/u);
  assert.match(generated.scriptText, /toBeDisabled/u);
  assert.equal(generated.actionCount, 4);
  assert.equal(generated.assertionCount, 2);
  assert.equal(generated.sourceId, 'playwright-test');
});

test('rejects generated recording scripts that still contain Playwright Test wrappers', () => {
  assert.throws(
      () => generateModuleHandlerScriptFromSources([
        sourceWithActions([
          "test('wrapped', async ({ page }) => { await page.getByText('Submit').click(); });",
        ]),
      ]),
      (error) => {
        assert.ok(error instanceof RecordingAuthoringError);
        assert.equal(error.reasonCode, recordingReasonCodes.scriptValidationFailed);
        assert.match(error.message, /Playwright Test wrapper/u);
        return true;
      },
  );
});

test('rejects local file upload actions until recording assets can model uploaded files', () => {
  assert.throws(
      () => generateModuleHandlerScriptFromSources([
        sourceWithActions([
          "await page.getByLabel('Attachment').setInputFiles('C:/Users/example/report.pdf');",
        ]),
      ]),
      (error) => {
        assert.ok(error instanceof RecordingAuthoringError);
        assert.equal(error.reasonCode, recordingReasonCodes.scriptValidationFailed);
        assert.match(error.message, /local file upload path/u);
        return true;
      },
  );
});
