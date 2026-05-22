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

export const playwrightActionBlockGenerator: OperationBlockGenerator = {
  name: 'playwright-action',
  canBuild: context => Boolean(context.action),
  build: context => {
    const action = context.action;
    if (!action)
      throw new Error('playwrightActionBlockGenerator requires a parsed action.');

    return `const ${context.targetVariable} = ${action.targetExpression};
await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
  index: context.index,
  kind: action.kind,
  actionKind: action.actionKind,
  targetVariable: context.targetVariable,
  source: context.rewrittenActionText,
})}, async () => {
${indentBlock(`await ${context.targetVariable}${action.invocation};`, 2)}
});`;
  },
};
