/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

export type ParsedAssertionOperation = {
  targetExpression: string;
  assertionInvocation: string;
  assertionKind: string;
  assertionArgumentText: string | null;
};

export type ParsedActionOperation = {
  targetExpression: string;
  invocation: string;
  actionKind: string;
  kind: 'action' | 'scroll';
};

function readActionKindFromMethod(methodName: string): string {
  if (methodName === 'evaluate')
    return 'script';
  if (methodName === 'selectOption')
    return 'select';
  if (methodName === 'fill' || methodName === 'type')
    return 'enter_text';
  return methodName;
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

function parseAssertionInvocation(invocation: string): { matcher: string; argumentText: string } | null {
  const match = /^\.([A-Za-z_$][\w$]*)\s*\(/u.exec(invocation);
  if (!match)
    return null;
  const openIndex = invocation.indexOf('(', match[0].length - 1);
  if (openIndex < 0)
    return null;
  const closeIndex = findMatchingParen(invocation, openIndex);
  if (closeIndex < 0 || invocation.slice(closeIndex + 1).trim())
    return null;
  return {
    matcher: match[1],
    argumentText: invocation.slice(openIndex + 1, closeIndex).trim(),
  };
}

export function parseAssertionOperation(actionText: string): ParsedAssertionOperation | null {
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
  const parsedInvocation = parseAssertionInvocation(assertionInvocation);
  const assertionKind = parsedInvocation?.matcher ?? /\.([A-Za-z_$][\w$]*)\s*\(/gu.exec(assertionInvocation)?.[1] ?? 'assertion';
  if (!targetExpression || !assertionInvocation)
    return null;

  return {
    targetExpression,
    assertionInvocation,
    assertionKind,
    assertionArgumentText: parsedInvocation?.argumentText ?? null,
  };
}

export function parseActionOperation(actionText: string): ParsedActionOperation | null {
  const normalized = stripAwaitStatement(actionText);
  if (normalized.includes('\n'))
    return null;
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
