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

import { buildOperationInputLiteral, indentBlock, RECORDING_SESSION_NAME } from './formatting';
import type { OperationBlockGenerator } from './types';

export const genericAssertionBlockGenerator: OperationBlockGenerator = {
  name: 'generic-assertion',
  canBuild: context => Boolean(context.assertion),
  build: context => {
    const assertion = context.assertion;
    if (!assertion)
      throw new Error('genericAssertionBlockGenerator requires a parsed assertion.');

    return `const ${context.targetVariable} = ${assertion.targetExpression};
await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
  index: context.index,
  kind: 'assertion',
  assertionKind: assertion.assertionKind,
  targetVariable: context.targetVariable,
  source: context.rewrittenActionText,
})}, async () => {
${indentBlock(`await ${RECORDING_SESSION_NAME}.expect(${context.targetVariable})${assertion.assertionInvocation};`, 2)}
});`;
  },
};
