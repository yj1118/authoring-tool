import type { Source } from '../../recorderTypes';
import { createRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { validateGeneratedModuleHandlerScript, validateRecordedActionBlock } from './moduleHandlerScriptValidation';

export type GeneratedModuleHandlerScript = {
  scriptText: string;
  actionCount: number;
  assertionCount: number;
  sourceId: string;
  timeoutMs: number;
};

export const DEFAULT_RECORDING_SCRIPT_TIMEOUT_MS = 120_000;

function chooseRecordedSource(sources: Source[]): Source | null {
  return sources.find(source => source.isRecorded && source.id === 'playwright-test')
    ?? sources.find(source => source.isRecorded && source.actions?.length)
    ?? null;
}

function normalizeActionBlock(actionText: string): string {
  return actionText
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
}

function indentBlock(block: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return block
      .split('\n')
      .map(line => line.trim().length ? `${indent}${line}` : '')
      .join('\n');
}

function isAssertionAction(actionText: string): boolean {
  return /\bexpect\s*\(/u.test(actionText);
}

export function generateModuleHandlerScriptFromSources(sources: Source[]): GeneratedModuleHandlerScript {
  const source = chooseRecordedSource(sources);
  if (!source) {
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.codegenFailed,
      message: 'No recorded Playwright source is available yet.',
    });
  }

  const actions = (source.actions ?? [])
      .map(normalizeActionBlock)
      .filter(Boolean);
  if (!actions.length) {
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.codegenFailed,
      message: 'Record at least one action or assertion before saving.',
    });
  }

  for (const action of actions)
    validateRecordedActionBlock(action);

  const assertionCount = actions.filter(isAssertionAction).length;
  const actionBlocks = actions.map(action => indentBlock(action, 2)).join('\n\n');

  const scriptText = `function createRecordingExpect(locator, negated = false) {
  function fail(message) {
    throw new Error(negated ? \`Assertion unexpectedly passed: \${message}\` : \`Assertion failed: \${message}\`);
  }
  function check(condition, message) {
    if (negated ? condition : !condition)
      fail(message);
  }
  async function readText() {
    return (await locator.textContent()) ?? '';
  }
  return {
    get not() {
      return createRecordingExpect(locator, !negated);
    },
    async toBeVisible() {
      check(await locator.isVisible(), 'locator should be visible');
    },
    async toBeChecked() {
      check(await locator.isChecked(), 'locator should be checked');
    },
    async toHaveText(expected) {
      const actual = (await readText()).trim();
      check(actual === String(expected), \`expected text "\${String(expected)}" but got "\${actual}"\`);
    },
    async toContainText(expected) {
      const actual = await readText();
      check(actual.includes(String(expected)), \`expected text to contain "\${String(expected)}" but got "\${actual}"\`);
    },
    async toHaveValue(expected) {
      const actual = await locator.inputValue();
      check(actual === String(expected), \`expected value "\${String(expected)}" but got "\${actual}"\`);
    },
    async toBeEmpty() {
      let actual = '';
      try {
        actual = await locator.inputValue();
      } catch {
        actual = await readText();
      }
      check(actual.length === 0, \`expected empty value/text but got "\${actual}"\`);
    },
    async toMatchAriaSnapshot(expected) {
      if (typeof locator.ariaSnapshot !== 'function')
        throw new Error('Assertion failed: locator.ariaSnapshot is not available in this runtime');
      const actual = await locator.ariaSnapshot();
      check(String(actual).trim() === String(expected).trim(), 'ARIA snapshot did not match the recorded snapshot');
    },
  };
}

export default async function recording(page, context) {
  const expect = createRecordingExpect;
  const recordingTimeoutMs = ${DEFAULT_RECORDING_SCRIPT_TIMEOUT_MS};
  page.setDefaultTimeout?.(recordingTimeoutMs);
  page.setDefaultNavigationTimeout?.(recordingTimeoutMs);

${actionBlocks}

  return {
    status: 'ok',
    diagnostics: {
      sourceId: ${JSON.stringify(source.id)},
      actionCount: ${actions.length},
      assertionCount: ${assertionCount},
    },
  };
}
`;

  validateGeneratedModuleHandlerScript(scriptText);

  return {
    scriptText,
    actionCount: actions.length,
    assertionCount,
    sourceId: source.id,
    timeoutMs: DEFAULT_RECORDING_SCRIPT_TIMEOUT_MS,
  };
}
