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

const UPLOAD_ASSETS_METHOD = 'testbotUploadAssets';

export type UploadAssetsActionArgument = {
  acceptsMultiple: boolean | null;
  assetPaths: string[];
};

export type ParsedUploadAssetsAction = {
  targetExpression: string;
  argument: UploadAssetsActionArgument;
};

export function parseUploadAssetsActionText(actionText: string): ParsedUploadAssetsAction | null {
  const normalized = stripAwaitStatement(actionText);
  const methodCall = findUploadAssetsMethodCall(normalized);
  if (!methodCall)
    return null;

  const targetExpression = normalized.slice(0, methodCall.dotIndex).trim();
  if (!targetExpression)
    return null;

  const openIndex = normalized.indexOf('(', methodCall.dotIndex);
  if (openIndex < 0)
    return null;
  const closeIndex = findMatchingParen(normalized, openIndex);
  if (closeIndex < 0 || normalized.slice(closeIndex + 1).trim())
    return null;

  return {
    targetExpression,
    argument: parseUploadAssetsArgument(normalized.slice(openIndex + 1, closeIndex).trim()),
  };
}

export function createUploadAssetsActionText(targetExpression: string, argument: UploadAssetsActionArgument): string {
  return `await ${targetExpression}.${UPLOAD_ASSETS_METHOD}(${JSON.stringify({
    acceptsMultiple: argument.acceptsMultiple,
    assetPaths: normalizeAssetPaths(argument.assetPaths),
  })});`;
}

function parseUploadAssetsArgument(argumentText: string): UploadAssetsActionArgument {
  if (!argumentText) {
    return {
      acceptsMultiple: null,
      assetPaths: [],
    };
  }

  try {
    const parsed = JSON.parse(argumentText) as { acceptsMultiple?: unknown; assetPaths?: unknown };
    return {
      acceptsMultiple: typeof parsed.acceptsMultiple === 'boolean' ? parsed.acceptsMultiple : null,
      assetPaths: normalizeAssetPaths(parsed.assetPaths),
    };
  } catch {
    return {
      acceptsMultiple: null,
      assetPaths: [],
    };
  }
}

function normalizeAssetPaths(value: unknown): string[] {
  if (!Array.isArray(value))
    return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string')
      continue;
    const assetPath = item.trim();
    if (!assetPath || seen.has(assetPath))
      continue;
    seen.add(assetPath);
    normalized.push(assetPath);
  }
  return normalized;
}

function stripAwaitStatement(actionText: string): string {
  return actionText
      .trim()
      .replace(/^await\s+/u, '')
      .replace(/;\s*$/u, '');
}

function findUploadAssetsMethodCall(expression: string): { dotIndex: number } | null {
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
    if (rest.startsWith(`${UPLOAD_ASSETS_METHOD}(`) || new RegExp(`^${UPLOAD_ASSETS_METHOD}\\s*\\(`, 'u').test(rest))
      return { dotIndex: index };
  }
  return null;
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
