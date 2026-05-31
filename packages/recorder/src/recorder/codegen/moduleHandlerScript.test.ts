import assert from 'node:assert/strict';
import test from 'node:test';

import type { Source } from '../../recorderTypes';
import { RecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { generateModuleHandlerScriptFromSources } from './moduleHandlerScript';

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

test('generates a Playwright Page recording script from Playwright actions and assertions', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await page.getByText('Submit').click();",
      "await expect(page.getByRole('button', { name: 'OK' })).toBeVisible();",
      "await expect(page.getByRole('button', { name: 'Next' })).not.toBeDisabled();",
      "await expect(page.getByLabel('Agree')).not.toBeChecked();",
      "await page.locator('body').evaluate((element, position) => { element.scrollTo(position.x, position.y); }, { x: 0, y: 400 });",
    ]),
  ]);

  assert.match(generated.scriptText, /export default async function recording\(page, context\)/u);
  assert.doesNotMatch(generated.scriptText, /context\.playwright\.page/u);
  assert.doesNotMatch(generated.scriptText, /\btest\s*\(/u);
  assert.doesNotMatch(generated.scriptText, /\b(?:browser|context)\.newPage\s*\(/u);
  assert.doesNotMatch(generated.scriptText, /createRecordingExpect/u);
  assert.doesNotMatch(generated.scriptText, /recordingAssertions/u);
  assert.match(generated.scriptText, /const recording = context\.recording\.v1\.createSession/u);
  assert.doesNotMatch(generated.scriptText, /recordingTimeoutMs/u);
  assert.doesNotMatch(generated.scriptText, /setDefault(?:Navigation)?Timeout/u);
  assert.match(generated.scriptText, /sourceId: "playwright-test"/u);
  assert.match(generated.scriptText, /await recording\.runOperation\(/u);
  assert.match(generated.scriptText, /const operation1Target = page\.getByText\('Submit'\)/u);
  assert.match(generated.scriptText, /target: operation2Target/u);
  assert.match(generated.scriptText, /await recording\.expect\(operation2Target\)\.toBeVisible/u);
  assert.doesNotMatch(generated.scriptText, /await expect\s*\(/u);
  assert.match(generated.scriptText, /scrollTo\(position\.x, position\.y\)/u);
  assert.match(generated.scriptText, /toBeDisabled/u);
  assert.match(generated.scriptText, /not\.toBeChecked/u);
  assert.match(generated.scriptText, /actionCount: 2/u);
  assert.equal(generated.actionCount, 2);
  assert.equal(generated.assertionCount, 3);
  assert.equal(generated.sourceId, 'playwright-test');
  assert.deepEqual(generated.recordingApi, {
    name: 'testbot-recording-runtime',
    version: 1,
  });
});

test('counts assertion-only recordings separately from browser operations', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await expect(page.getByText('Ready')).toBeVisible();",
      "await expect(page.getByRole('button', { name: 'Submit' })).not.toBeDisabled();",
    ]),
  ]);

  assert.match(generated.scriptText, /actionCount: 0/u);
  assert.doesNotMatch(generated.scriptText, /assertionCount: 2/u);
  assert.equal(generated.actionCount, 0);
  assert.equal(generated.assertionCount, 2);
});

test('generates select option assertions through the evidence-aware recording API', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await expect(page.getByRole('combobox').first()).toHaveSelectOptions({\"matchBy\":[\"text\",\"value\"],\"match\":\"contains\",\"texts\":[\"Option A\",\"Option B\"],\"values\":[\"A\",\"B\"]});",
    ]),
  ]);

  assert.match(generated.scriptText, /await recording\.assertSelectOptions\(\{/u);
  assert.match(generated.scriptText, /locator: operation1Target/u);
  assert.match(generated.scriptText, /expected: \{"matchBy":\["text","value"\],"match":"contains","texts":\["Option A","Option B"\],"values":\["A","B"\]\}/u);
  assert.match(generated.scriptText, /overlay: true/u);
  assert.doesNotMatch(generated.scriptText, /recording\.expect\(operation1Target\)\.toHaveSelectOptions/u);
  assert.equal(generated.actionCount, 0);
  assert.equal(generated.assertionCount, 1);
});

test('generates password input assertions through the dedicated recording API', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await expect(page.getByLabel('Password')).toBePasswordInput({\"assertValue\":true,\"expectedValue\":\"\",\"matchMode\":\"exact\"});",
    ]),
  ]);

  assert.match(generated.scriptText, /await recording\.assertPasswordInput\(\{/u);
  assert.match(generated.scriptText, /locator: operation1Target/u);
  assert.match(generated.scriptText, /expected: \{"assertValue":true,"expectedValue":"","matchMode":"exact"\}/u);
  assert.doesNotMatch(generated.scriptText, /recording\.expect\(operation1Target\)\.toBePasswordInput/u);
  assert.equal(generated.actionCount, 0);
  assert.equal(generated.assertionCount, 1);
});

test('generates upload asset actions through the recording runtime API', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "await page.locator('input[type=\"file\"]').testbotUploadAssets({\"acceptsMultiple\":false,\"assetPaths\":[\"imports/users.csv\"]});",
    ]),
  ]);

  assert.match(generated.scriptText, /await recording\.uploadFiles\(\{/u);
  assert.match(generated.scriptText, /const operation1Target = page\.locator\('input\[type="file"\]'\)/u);
  assert.match(generated.scriptText, /locator: operation1Target/u);
  assert.match(generated.scriptText, /assetPaths: \["imports\/users\.csv"\]/u);
  assert.match(generated.scriptText, /acceptsMultiple: false/u);
  assert.doesNotMatch(generated.scriptText, /setInputFiles/u);
  assert.equal(generated.actionCount, 1);
  assert.equal(generated.assertionCount, 0);
});

test('uses structured recorder action metadata for download-wrapped actions', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "const download1Promise = page.waitForEvent('download');\nawait page.getByRole('button', { name: 'CSV output' }).click();\nconst download1 = await download1Promise;",
    ], [{
      frame: {
        pageGuid: 'page-guid',
        pageAlias: 'page',
        framePath: [],
      },
      action: {
        name: 'click',
        selector: 'internal:role=button[name="CSV output"i]',
        button: 'left',
        modifiers: 0,
        clickCount: 1,
        signals: [{ name: 'download', downloadAlias: '1' }],
      },
      startTime: 0,
    }], ["page.getByRole('button', { name: 'CSV output' })"]),
  ]);

  assert.match(generated.scriptText, /const operation1Target = page\./u);
  assert.match(generated.scriptText, /target: operation1Target/u);
  assert.match(generated.scriptText, /waitForEvent\('download'\)/u);
  assert.doesNotMatch(generated.scriptText, /const operation1Target = const /u);
  assert.equal(generated.actionCount, 1);
});

test('keeps multi-line recorded actions valid when structured metadata is unavailable', () => {
  const generated = generateModuleHandlerScriptFromSources([
    sourceWithActions([
      "const download1Promise = page.waitForEvent('download');\nawait page.getByRole('button', { name: 'CSV output' }).click();\nconst download1 = await download1Promise;",
    ]),
  ]);

  assert.match(generated.scriptText, /waitForEvent\('download'\)/u);
  assert.doesNotMatch(generated.scriptText, /const operation1Target = const /u);
  assert.equal(generated.actionCount, 1);
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
