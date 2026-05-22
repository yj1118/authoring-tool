import type { Source } from '../../recorderTypes';
import { createRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import {
  buildRunOperationBlock,
  indentBlock,
  isAssertionAction,
  normalizeActionBlock,
  RECORDING_SESSION_NAME,
} from './operationBlocks';
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

function chooseRecordedSource(sources: Source[]): Source | null {
  return sources.find(source => source.isRecorded && source.id === 'playwright-test')
    ?? sources.find(source => source.isRecorded && source.actions?.length)
    ?? null;
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
      .map((action, index) => buildRunOperationBlock(action, index + 1))
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
