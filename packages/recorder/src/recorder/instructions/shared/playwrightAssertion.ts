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

export type PlaywrightAssertionCall = {
  targetExpression: string;
  matcher: string;
  negated: boolean;
  argumentText: string | undefined;
};

export function parsePlaywrightAssertionCall(actionText: string): PlaywrightAssertionCall | null {
  const text = actionText.trim();
  const expectIndex = text.indexOf('expect(');
  if (expectIndex < 0)
    return null;
  if (text.slice(0, expectIndex).trim() !== 'await')
    return null;
  const expectArgumentsStart = expectIndex + 'expect'.length;
  const expectArgumentsEnd = findMatchingParenthesis(text, expectArgumentsStart);
  if (expectArgumentsEnd < 0)
    return null;

  let suffix = text.slice(expectArgumentsEnd + 1).trim();
  if (suffix.endsWith(';'))
    suffix = suffix.slice(0, -1).trim();
  let negated = false;
  if (suffix.startsWith('.not.')) {
    negated = true;
    suffix = `.${suffix.slice('.not.'.length)}`;
  }
  if (!suffix.startsWith('.'))
    return null;

  const matcherMatch = /^\.([a-zA-Z_$][\w$]*)\s*(?:\(([\s\S]*)\))$/u.exec(suffix);
  if (!matcherMatch)
    return null;
  const argumentText = matcherMatch[2]?.trim();
  return {
    targetExpression: text.slice(expectArgumentsStart + 1, expectArgumentsEnd).trim(),
    matcher: matcherMatch[1],
    negated,
    argumentText: argumentText || undefined,
  };
}

export function parseStringArgument(argumentText: string | undefined): string | null {
  if (!argumentText)
    return null;
  const trimmed = argumentText.trim();
  if (!trimmed)
    return null;
  const quote = trimmed[0];
  if ((quote !== '\'' && quote !== '"') || trimmed[trimmed.length - 1] !== quote)
    return null;
  let result = '';
  for (let i = 1; i < trimmed.length - 1; i++) {
    const char = trimmed[i];
    if (char !== '\\') {
      result += char;
      continue;
    }
    i++;
    if (i >= trimmed.length - 1)
      return null;
    const escaped = trimmed[i];
    if (escaped === 'n')
      result += '\n';
    else if (escaped === 'r')
      result += '\r';
    else if (escaped === 't')
      result += '\t';
    else
      result += escaped;
  }
  return result;
}

export function createPlaywrightAssertionAction(targetExpression: string, matcher: string, expectedText?: string): string {
  const argument = expectedText === undefined ? '' : quoteString(expectedText);
  return createPlaywrightAssertionActionWithArgument(targetExpression, matcher, argument);
}

export function createPlaywrightAssertionActionWithArgument(targetExpression: string, matcher: string, argument: string): string {
  return `await expect(${targetExpression}).${matcher}(${argument});`;
}

export function quoteRegexLiteral(value: string): string {
  if (!value)
    return '/(?:)/';
  const escaped = value
      .replace(/[\\^$.*+?()[\]{}|/]/gu, '\\$&')
      .replace(/\n/gu, '\\n')
      .replace(/\r/gu, '\\r')
      .replace(/\t/gu, '\\t');
  return `/${escaped}/`;
}

function quoteString(value: string): string {
  return JSON.stringify(value);
}

function findMatchingParenthesis(text: string, openIndex: number): number {
  if (text[openIndex] !== '(')
    return -1;
  let depth = 0;
  let quote: string | undefined;
  for (let i = openIndex; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === '\\') {
        i++;
        continue;
      }
      if (char === quote)
        quote = undefined;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char !== ')')
      continue;
    depth--;
    if (!depth)
      return i;
  }
  return -1;
}
