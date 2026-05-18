import type { Source } from '../../recorderTypes';
import { createRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { validateGeneratedModuleHandlerScript, validateRecordedActionBlock } from './moduleHandlerScriptValidation';
import {
  RECORDING_EXPECT_CALL_NAME,
  RECORDING_EXPECT_FACTORY_NAME,
  RECORDING_EXPECT_RUNTIME_SOURCE,
} from './runtime/recordingExpectRuntime';

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

function rewriteRecordedActionBlockForRuntime(actionText: string): string {
  return actionText.replace(/(^|[^\w$.])expect\s*\(/gu, `$1${RECORDING_EXPECT_CALL_NAME}(`);
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
  const actionBlocks = actions
      .map(rewriteRecordedActionBlockForRuntime)
      .map(action => indentBlock(action, 2))
      .join('\n\n');

  const scriptText = `${RECORDING_EXPECT_RUNTIME_SOURCE}

export default async function recording(page, context) {
  const recordingAssertions = [];
  const ${RECORDING_EXPECT_CALL_NAME} = locator => ${RECORDING_EXPECT_FACTORY_NAME}(locator, false, recordingAssertions);
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
      assertions: recordingAssertions,
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
