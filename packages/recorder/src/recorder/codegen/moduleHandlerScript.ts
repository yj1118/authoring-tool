import type { Source } from '../../recorderTypes';
import { createRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { validateGeneratedModuleHandlerScript, validateRecordedActionBlock } from './moduleHandlerScriptValidation';

export type GeneratedModuleHandlerScript = {
  scriptText: string;
  actionCount: number;
  assertionCount: number;
  sourceId: string;
  timeoutMs: number;
  recordingApi: {
    name: string;
    version: number;
  };
};

export const DEFAULT_RECORDING_SCRIPT_TIMEOUT_MS = 120_000;
export const RECORDING_RUNTIME_API_NAME = 'testbot-recording-runtime';
export const RECORDING_RUNTIME_API_VERSION = 1;
const RECORDING_SESSION_NAME = 'recording';

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
  return actionText.replace(/(^|[^\w$.])expect\s*\(/gu, `$1${RECORDING_SESSION_NAME}.expect(`);
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
  const actionCount = actions.length - assertionCount;
  const actionBlocks = actions
      .map(rewriteRecordedActionBlockForRuntime)
      .map(action => indentBlock(action, 2))
      .join('\n\n');

  const scriptText = `export default async function recording(page, context) {
  const ${RECORDING_SESSION_NAME} = context.recording.v1.createSession({
    sourceId: ${JSON.stringify(source.id)},
  });

${actionBlocks}

  return ${RECORDING_SESSION_NAME}.ok({
    actionCount: ${actionCount},
  });
}
`;

  validateGeneratedModuleHandlerScript(scriptText);

  return {
    scriptText,
    actionCount,
    assertionCount,
    sourceId: source.id,
    timeoutMs: DEFAULT_RECORDING_SCRIPT_TIMEOUT_MS,
    recordingApi: {
      name: RECORDING_RUNTIME_API_NAME,
      version: RECORDING_RUNTIME_API_VERSION,
    },
  };
}
