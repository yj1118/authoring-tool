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

import type { SelectorAuthoringResult } from '@recorder/recorderTypes';

const kEnabledEnv = 'TEST_BOT_SELECTOR_AUTHORING_ENABLED';
const kRequestIdEnv = 'TEST_BOT_SELECTOR_AUTHORING_REQUEST_ID';
const kResultSubmitUrlEnv = 'TEST_BOT_SELECTOR_RESULT_SUBMIT_URL';

type FetchLike = typeof fetch;

type SelectorAuthoringBridgeConfig = {
  requestId: string;
  resultSubmitUrl: string;
};

export class SelectorAuthoringResultBridge {
  private readonly _config: SelectorAuthoringBridgeConfig | null;
  private readonly _fetch: FetchLike;

  constructor(config: SelectorAuthoringBridgeConfig | null, fetchImpl: FetchLike = fetch) {
    this._config = config;
    this._fetch = fetchImpl;
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env, fetchImpl: FetchLike = fetch): SelectorAuthoringResultBridge {
    return new SelectorAuthoringResultBridge(resolveSelectorAuthoringBridgeConfig(env), fetchImpl);
  }

  isEnabled(): boolean {
    return this._config !== null;
  }

  async submitResult(result: SelectorAuthoringResult): Promise<void> {
    if (!this._config)
      return;

    const response = await this._fetch(this._config.resultSubmitUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (response.ok)
      return;

    const detail = await safeReadResponseText(response);
    throw new Error(`Selector authoring result submit failed for ${this._config.requestId}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
  }
}

function resolveSelectorAuthoringBridgeConfig(env: NodeJS.ProcessEnv): SelectorAuthoringBridgeConfig | null {
  if (env[kEnabledEnv] !== '1')
    return null;

  const requestId = env[kRequestIdEnv]?.trim();
  const resultSubmitUrl = env[kResultSubmitUrlEnv]?.trim();
  if (!requestId || !resultSubmitUrl)
    return null;

  return {
    requestId,
    resultSubmitUrl,
  };
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}
