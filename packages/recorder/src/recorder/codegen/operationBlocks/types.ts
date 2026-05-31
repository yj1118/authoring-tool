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

import type { ParsedActionOperation, ParsedAssertionOperation } from './parsing';
import type * as actions from '../../../actions';

export type OperationBlockKind = 'action' | 'assertion' | 'scroll';

export type OperationBlockContext = {
  actionText: string;
  rewrittenActionText: string;
  index: number;
  targetVariable: string;
  assertion: ParsedAssertionOperation | null;
  action: ParsedActionOperation | null;
  actionContext?: actions.ActionInContext;
  actionTargetExpression?: string;
};

export type OperationBlockGenerator = {
  name: string;
  canBuild: (context: OperationBlockContext) => boolean;
  build: (context: OperationBlockContext) => string;
};
