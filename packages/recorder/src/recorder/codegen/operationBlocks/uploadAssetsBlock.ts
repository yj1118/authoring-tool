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

import { parseUploadAssetsActionText } from '../../instructions/uploadAssets/uploadAssetsAction';
import { indentBlock, RECORDING_SESSION_NAME, truncateOperationSource } from './formatting';
import type { OperationBlockGenerator } from './types';

export const uploadAssetsBlockGenerator: OperationBlockGenerator = {
  name: 'upload-assets',
  canBuild: context => Boolean(parseUploadAssetsActionText(context.rewrittenActionText)),
  build: context => {
    const parsed = parseUploadAssetsActionText(context.rewrittenActionText);
    if (!parsed)
      throw new Error('uploadAssetsBlockGenerator requires a parsed upload assets action.');

    return `const ${context.targetVariable} = ${parsed.targetExpression};
await ${RECORDING_SESSION_NAME}.uploadFiles({
${indentBlock(`index: ${context.index},
locator: ${context.targetVariable},
assetPaths: ${JSON.stringify(parsed.argument.assetPaths)},
acceptsMultiple: ${JSON.stringify(parsed.argument.acceptsMultiple)},
source: ${JSON.stringify(truncateOperationSource(context.rewrittenActionText))},`, 2)}
});`;
  },
};
