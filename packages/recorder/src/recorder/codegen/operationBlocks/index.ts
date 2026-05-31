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
  indentBlock,
  isAssertionAction,
  normalizeActionBlock,
  RECORDING_SESSION_NAME,
  rewriteRecordedActionBlockForRuntime,
} from './formatting';
import { fallbackOperationBlockGenerator } from './fallbackOperationBlock';
import { genericAssertionBlockGenerator } from './genericAssertionBlock';
import { parseActionOperation, parseAssertionOperation } from './parsing';
import { passwordInputAssertionBlockGenerator } from './passwordInputAssertionBlock';
import { playwrightActionBlockGenerator } from './playwrightActionBlock';
import { selectOptionsAssertionBlockGenerator } from './selectOptionsAssertionBlock';
import { structuredActionBlockGenerator } from './structuredActionBlock';
import { uploadAssetsBlockGenerator } from './uploadAssetsBlock';
import type { OperationBlockContext, OperationBlockGenerator } from './types';
import type * as actions from '../../../actions';

export {
  indentBlock,
  isAssertionAction,
  normalizeActionBlock,
  RECORDING_SESSION_NAME,
};

const OPERATION_BLOCK_GENERATORS: OperationBlockGenerator[] = [
  selectOptionsAssertionBlockGenerator,
  passwordInputAssertionBlockGenerator,
  genericAssertionBlockGenerator,
  uploadAssetsBlockGenerator,
  structuredActionBlockGenerator,
  playwrightActionBlockGenerator,
  fallbackOperationBlockGenerator,
];

function createOperationBlockContext(actionText: string, index: number, actionContext?: actions.ActionInContext, actionTargetExpression?: string): OperationBlockContext {
  return {
    actionText,
    rewrittenActionText: rewriteRecordedActionBlockForRuntime(actionText),
    index,
    targetVariable: `operation${index}Target`,
    assertion: parseAssertionOperation(actionText),
    action: parseActionOperation(actionText),
    actionContext,
    actionTargetExpression,
  };
}

export function buildRunOperationBlock(actionText: string, index: number, actionContext?: actions.ActionInContext, actionTargetExpression?: string): string {
  const context = createOperationBlockContext(actionText, index, actionContext, actionTargetExpression);
  const generator = OPERATION_BLOCK_GENERATORS.find(candidate => candidate.canBuild(context));
  if (!generator)
    throw new Error('No operation block generator registered.');
  return generator.build(context);
}
