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

import { RECORDING_SESSION_NAME, truncateOperationSource } from './formatting';
import type { OperationBlockGenerator } from './types';

export const selectOptionsAssertionBlockGenerator: OperationBlockGenerator = {
  name: 'select-options-assertion',
  canBuild: context => context.assertion?.assertionKind === 'toHaveSelectOptions'
    && context.assertion.assertionArgumentText !== null,
  build: context => {
    const assertion = context.assertion;
    if (!assertion || assertion.assertionArgumentText === null)
      throw new Error('selectOptionsAssertionBlockGenerator requires a parsed select options assertion.');

    return `const ${context.targetVariable} = ${assertion.targetExpression};
await ${RECORDING_SESSION_NAME}.assertSelectOptions({
  index: ${context.index},
  locator: ${context.targetVariable},
  expected: ${assertion.assertionArgumentText},
  source: ${JSON.stringify(truncateOperationSource(context.rewrittenActionText))},
  evidence: {
    overlay: true,
  },
});`;
  },
};
