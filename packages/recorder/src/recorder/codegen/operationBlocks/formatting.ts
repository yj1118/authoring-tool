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

import type { OperationBlockKind } from './types';

export const RECORDING_SESSION_NAME = 'recording';
const MAX_OPERATION_SOURCE_LENGTH = 500;

export function normalizeActionBlock(actionText: string): string {
  return actionText
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
}

export function indentBlock(block: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return block
      .split('\n')
      .map(line => line.trim().length ? `${indent}${line}` : '')
      .join('\n');
}

export function isAssertionAction(actionText: string): boolean {
  return /\bexpect\s*\(/u.test(actionText);
}

export function rewriteRecordedActionBlockForRuntime(actionText: string): string {
  return actionText.replace(/(^|[^\w$.])expect\s*\(/gu, `$1${RECORDING_SESSION_NAME}.expect(`);
}

export function truncateOperationSource(actionText: string): string {
  return actionText.length <= MAX_OPERATION_SOURCE_LENGTH
    ? actionText
    : `${actionText.slice(0, MAX_OPERATION_SOURCE_LENGTH)}...`;
}

export function buildOperationInputLiteral(input: {
  index: number;
  kind: OperationBlockKind;
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
