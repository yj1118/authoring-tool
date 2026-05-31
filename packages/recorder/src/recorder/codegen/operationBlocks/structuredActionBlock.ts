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

import {
  buildOperationInputLiteral,
  indentBlock,
  RECORDING_SESSION_NAME,
} from './formatting';
import type { OperationBlockGenerator, OperationBlockKind } from './types';
import type * as actions from '../../../actions';

function actionKindFor(action: actions.Action): string {
  if (action.name === 'fill')
    return 'enter_text';
  if (action.name === 'select')
    return 'select';
  if (action.name === 'scroll')
    return 'scroll';
  return action.name;
}

function operationKindFor(action: actions.Action): OperationBlockKind {
  return action.name === 'scroll' ? 'scroll' : 'action';
}

export const structuredActionBlockGenerator: OperationBlockGenerator = {
  name: 'structured-action',
  canBuild: context => Boolean(context.actionContext && context.actionTargetExpression),
  build: context => {
    const actionInContext = context.actionContext;
    if (!actionInContext || !context.actionTargetExpression)
      throw new Error('structuredActionBlockGenerator requires a structured selector action.');

    return `const ${context.targetVariable} = ${context.actionTargetExpression};
await ${RECORDING_SESSION_NAME}.runOperation(${buildOperationInputLiteral({
  index: context.index,
  kind: operationKindFor(actionInContext.action),
  actionKind: actionKindFor(actionInContext.action),
  targetVariable: context.targetVariable,
  source: context.rewrittenActionText,
})}, async () => {
${indentBlock(context.rewrittenActionText, 2)}
});`;
  },
};
