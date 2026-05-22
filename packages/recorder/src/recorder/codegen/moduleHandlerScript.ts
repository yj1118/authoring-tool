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
const MAX_OPERATION_SOURCE_LENGTH = 500;
const PLAYWRIGHT_ACTION_METHODS = new Set([
  'check',
  'click',
  'dblclick',
  'dispatchEvent',
  'dragTo',
  'evaluate',
  'fill',
  'focus',
  'hover',
  'press',
  'selectOption',
  'setChecked',
  'tap',
  'type',
  'uncheck',
]);

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

function truncateOperationSource(actionText: string): string {
  return actionText.length <= MAX_OPERATION_SOURCE_LENGTH
    ? actionText
    : `${actionText.slice(0, MAX_OPERATION_SOURCE_LENGTH)}...`;
}

function readActionKindFromMethod(methodName: string): string {
  if (methodName === 'evaluate')
    return 'script';
  if (methodName === 'selectOption')
    return 'select';
  if (methodName === 'fill' || methodName === 'type')
    return 'enter_text';
  return methodName;
}

function buildOperationInputLiteral(input: {
  index: number;
  kind: 'action' | 'assertion' | 'scroll';
  actionKind?: string;
  assertionKind?: string;
  targetVariable?: string;
  source: string;
}): string {
  const lines = [
    `index: ${input.index},`,
    `kind: ${JSON.stringify(input.kind)},`,
  ];
  if (input.actionKind)
    lines.push(`actionKind: ${JSON.stringify(input.actionKind)},`);
  if (input.assertionKind)
    lines.push(`assertionKind: ${JSON.stringify(input.assertionKind)},`);
  if (input.targetVariable)
    lines.push(`target: ${input.targetVariable},`);
  lines.push(`source: ${JSON.stringify(truncateOperationSource(input.source))},`);
  return `{\n${indentBlock(lines.join('\n'), 4)}\n  }`;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote)
        quote = null;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0)
        return index;
    }
  }
  return -1;
}

function stripAwaitStatement(actionText: string): string {
  return actionText
      .trim()
      .replace(/^await\s+/u, '')
      .replace(/;\s*$/u, '');
}

function findTopLevelMethodCall(expression: string): { dotIndex: number; methodName: string } | null {
  let roundDepth = 0;
  let squareDepth = 0;
  let braceDepth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote)
        quote = null;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      roundDepth += 1;
      continue;
    }
    if (char === ')') {
      roundDepth -= 1;
      continue;
    }
    if (char === '[') {
      squareDepth += 1;
      continue;
    }
    if (char === ']') {
      squareDepth -= 1;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      continue;
    }
    if (char !== '.' || roundDepth !== 0 || squareDepth !== 0 || braceDepth !== 0)
      continue;

    const rest = expression.slice(index + 1);
    const match = /^([A-Za-z_$][\w$]*)\s*\(/u.exec(rest);
    if (!match || !PLAYWRIGHT_ACTION_METHODS.has(match[1]))
      continue;
    return {
      dotIndex: index,
      methodName: match[1],
    };
  }

  return null;
}

function parseAssertionOperation(actionText: string): {
  targetExpression: string;
  assertionInvocation: string;
  assertionKind: string;
} | null {
  const normalized = stripAwaitStatement(actionText);
  const expectMatch = /^expect\s*\(/u.exec(normalized);
  if (!expectMatch)
    return null;

  const openIndex = normalized.indexOf('(', expectMatch.index);
  const closeIndex = findMatchingParen(normalized, openIndex);
  if (closeIndex < 0)
    return null;

  const targetExpression = normalized.slice(openIndex + 1, closeIndex).trim();
  const assertionInvocation = normalized.slice(closeIndex + 1).trim();
  const assertionKind = /\.([A-Za-z_$][\w$]*)\s*\(/gu.exec(assertionInvocation)?.[1] ?? 'assertion';
  if (!targetExpression || !assertionInvocation)
    return null;

  return {
    targetExpression,
    assertionInvocation,
    assertionKind,
  };
}

function parseActionOperation(actionText: string): {
  targetExpression: string;
  invocation: string;
  actionKind: string;
  kind: 'action' | 'scroll';
} | null {
  const normalized = stripAwaitStatement(actionText);
  const methodCall = findTopLevelMethodCall(normalized);
  if (!methodCall)
    return null;

  const targetExpression = normalized.slice(0, methodCall.dotIndex).trim();
  const invocation = normalized.slice(methodCall.dotIndex).trim();
  if (!targetExpression || !invocation)
    return null;

  const actionKind = readActionKindFromMethod(methodCall.methodName);
  return {
    targetExpression,
    invocation,
    actionKind,
    kind: actionKind === 'script' && /scroll(?:To|By|IntoView)?\s*\(/u.test(actionText) ? 'scroll' : 'action',
  };
}

function buildRunOperationBlock(actionText: string, index: number): string {
  const rewritten = rewriteRecordedActionBlockForRuntime(actionText);
  const targetVariable = `operation${index}Target`;
  const assertion = parseAssertionOperation(actionText);
  if (assertion) {
    return `const ${targetVariable} = ${assertion.targetExpression};
await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
  index,
  kind: 'assertion',
  assertionKind: assertion.assertionKind,
  targetVariable,
  source: rewritten,
})}, async () => {
${indentBlock(`await ${RECORDING_SESSION_NAME}.expect(${targetVariable})${assertion.assertionInvocation};`, 2)}
});`;
  }

  const action = parseActionOperation(actionText);
  if (action) {
    return `const ${targetVariable} = ${action.targetExpression};
await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
  index,
  kind: action.kind,
  actionKind: action.actionKind,
  targetVariable,
  source: rewritten,
})}, async () => {
${indentBlock(`await ${targetVariable}${action.invocation};`, 2)}
});`;
  }

  return `await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
    index,
    kind: isAssertionAction(actionText) ? 'assertion' : 'action',
    source: rewritten,
  })}, async () => {
${indentBlock(rewritten, 2)}
});`;
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
