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

import http from 'http';

import { test, expect } from './inspectorTest';

test('should submit selector authoring result after copy selector', async ({ openRecorder }) => {
  const originalEnv = {
    enabled: process.env.TEST_BOT_SELECTOR_AUTHORING_ENABLED,
    requestId: process.env.TEST_BOT_SELECTOR_AUTHORING_REQUEST_ID,
    resultSubmitUrl: process.env.TEST_BOT_SELECTOR_RESULT_SUBMIT_URL,
  };
  const { receivedResult, server } = await startSelectorResultServer();

  try {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<button>Submit</button>`);

    await recorder.recorderPage.getByRole('button', { name: 'Pick selector' }).click();
    const button = page.getByRole('button', { name: 'Submit' });
    const box = await button.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    await expect(recorder.recorderPage.getByRole('button', { name: 'Copy selector' })).toBeEnabled();
    await recorder.recorderPage.getByRole('button', { name: 'Copy selector' }).click();

    const result = await receivedResult;
    expect(result).toMatchObject({
      selector: expect.stringContaining(`getByRole('button'`),
      clipboard: {
        attempted: true,
        ok: expect.any(Boolean),
      },
      meta: {
        strategy: expect.any(String),
        url: 'about:blank',
      },
    });
    expect(Number.isNaN(Date.parse(result.selectedAt))).toBe(false);
  } finally {
    if (server.listening)
      await closeServer(server);

    if (originalEnv.enabled === undefined)
      delete process.env.TEST_BOT_SELECTOR_AUTHORING_ENABLED;
    else
      process.env.TEST_BOT_SELECTOR_AUTHORING_ENABLED = originalEnv.enabled;

    if (originalEnv.requestId === undefined)
      delete process.env.TEST_BOT_SELECTOR_AUTHORING_REQUEST_ID;
    else
      process.env.TEST_BOT_SELECTOR_AUTHORING_REQUEST_ID = originalEnv.requestId;

    if (originalEnv.resultSubmitUrl === undefined)
      delete process.env.TEST_BOT_SELECTOR_RESULT_SUBMIT_URL;
    else
      process.env.TEST_BOT_SELECTOR_RESULT_SUBMIT_URL = originalEnv.resultSubmitUrl;
  }
});

type SubmittedSelectorAuthoringResult = {
  selector: string;
  selectedAt: string;
  clipboard: {
    attempted: true;
    ok: boolean;
    errorMessage?: string;
  };
  meta?: {
    strategy?: string;
    url?: string;
  };
};

async function startSelectorResultServer(): Promise<{
  receivedResult: Promise<SubmittedSelectorAuthoringResult>;
  server: http.Server;
}> {
  let resolveResult!: (result: SubmittedSelectorAuthoringResult) => void;
  let rejectResult!: (error: Error) => void;
  const receivedResult = new Promise<SubmittedSelectorAuthoringResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const server = http.createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/requests/test-request/result') {
      response.statusCode = 404;
      response.end();
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, requestId: 'test-request', status: 'completed' }));
      try {
        resolveResult(JSON.parse(body) as SubmittedSelectorAuthoringResult);
      } catch (error) {
        rejectResult(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });

  server.once('error', error => {
    rejectResult(error instanceof Error ? error : new Error(String(error)));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to acquire a server address'));
        return;
      }

      process.env.TEST_BOT_SELECTOR_AUTHORING_ENABLED = '1';
      process.env.TEST_BOT_SELECTOR_AUTHORING_REQUEST_ID = 'test-request';
      process.env.TEST_BOT_SELECTOR_RESULT_SUBMIT_URL = `http://127.0.0.1:${address.port}/requests/test-request/result`;
      resolve();
    });
    server.once('error', reject);
  });

  return { receivedResult, server };
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
