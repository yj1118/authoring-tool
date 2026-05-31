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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildFullSelector } from './recorderUtils';
import { ProgressController } from '../progress';

import type { BrowserContext } from '../browserContext';
import type { Page } from '../page';
import type { RecordingLaunchContext, RecordingUploadAssetsApplyRequest, RecordingUploadAssetsApplyResult } from '@recorder/recorderTypes';

const uploadApplyTimeoutMs = 30_000;

type MaterializedUploadAsset = {
  assetPath: string;
  localPath: string;
};

export async function applyUploadAssetsToCurrentInput(input: {
  inspectedContext: BrowserContext;
  launchContext: RecordingLaunchContext | null;
  request: RecordingUploadAssetsApplyRequest;
}): Promise<RecordingUploadAssetsApplyResult> {
  const launchContext = input.launchContext;
  if (!launchContext)
    throw new Error('Recorder launch context is missing.');

  const action = input.request.actionContext.action;
  if (!('selector' in action))
    throw new Error('Upload target action does not contain a selector.');
  if (action.name !== 'uploadFiles' && action.name !== 'setInputFiles')
    throw new Error(`Upload target action must target a file input, received ${action.name}.`);
  if (action.name === 'uploadFiles' && action.acceptsMultiple === false && input.request.assetPaths.length > 1)
    throw new Error('This file input accepts one file, but multiple upload assets were selected.');
  if (!input.request.assetPaths.length)
    throw new Error('No upload assets were selected.');

  const materializedAssets = await materializeUploadAssets({
    launchContext,
    assetPaths: input.request.assetPaths,
  });
  const page = findPageByGuid(input.inspectedContext, input.request.actionContext.frame.pageGuid);
  if (!page)
    throw new Error('The browser page that owns the upload target is no longer available.');

  const selector = buildFullSelector(input.request.actionContext.frame.framePath, action.selector);
  const controller = new ProgressController();
  await controller.run(async progress => {
    await page.mainFrame().setInputFiles(progress, selector, {
      selector,
      localPaths: materializedAssets.map(asset => asset.localPath),
      strict: true,
    });
  }, uploadApplyTimeoutMs);

  return {
    ok: true,
    appliedAssetPaths: materializedAssets.map(asset => asset.assetPath),
  };
}

async function materializeUploadAssets(input: {
  launchContext: RecordingLaunchContext;
  assetPaths: string[];
}): Promise<MaterializedUploadAsset[]> {
  const assetOptionsByPath = new Map((input.launchContext.availableUploadAssets ?? []).map(asset => [asset.assetPath, asset]));
  const targetDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'testbot-recorder-upload-'));
  const usedFileNames = new Set<string>();
  const materializedAssets: MaterializedUploadAsset[] = [];

  for (const assetPath of input.assetPaths) {
    const asset = assetOptionsByPath.get(assetPath);
    if (!asset)
      throw new Error(`Upload asset is not available for this recording target: ${assetPath}`);
    const bytes = await downloadUploadAsset({
      launchContext: input.launchContext,
      assetPath,
    });
    const fileName = uniqueFileName(sanitizeFileName(asset.displayName || fileNameFromAssetPath(asset.assetPath)), usedFileNames);
    const localPath = path.join(targetDir, fileName);
    await fs.promises.writeFile(localPath, bytes);
    materializedAssets.push({
      assetPath: asset.assetPath,
      localPath,
    });
  }

  return materializedAssets;
}

async function downloadUploadAsset(input: {
  launchContext: RecordingLaunchContext;
  assetPath: string;
}): Promise<Buffer> {
  const request = buildUploadAssetDownloadRequest(input);
  let response: Response;
  try {
    response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
    });
  } catch (error) {
    throw new Error(`Failed to download upload asset ${input.assetPath}: ${describeError(error)}`);
  }
  if (!response.ok)
    throw new Error(`Failed to download upload asset ${input.assetPath}: ${response.status} ${await readResponseError(response)}`);
  return Buffer.from(await response.arrayBuffer());
}

function buildUploadAssetDownloadRequest(input: {
  launchContext: RecordingLaunchContext;
  assetPath: string;
}): { url: string; headers: Record<string, string> } {
  const { launchContext } = input;
  if (launchContext.recordingBridgeBaseUrl && launchContext.recordingBridgeToken && launchContext.target.kind === 'execution_task') {
    const target = launchContext.target;
    const url = new URL(
        `/api/cases/${encodeURIComponent(target.caseId)}/versions/${encodeURIComponent(target.caseVersionId)}/tasks/${encodeURIComponent(target.taskId)}/execution-package/bridge/upload-assets/download`,
        launchContext.recordingBridgeBaseUrl,
    );
    url.searchParams.set('path', input.assetPath);
    for (const sourceStepId of target.sourceStepIds)
      url.searchParams.append('sourceStepId', sourceStepId);
    url.searchParams.set('instructionHash', target.instructionHash);
    url.searchParams.set('planVersion', target.planVersion);
    return {
      url: url.toString(),
      headers: {
        authorization: `Bearer ${launchContext.recordingBridgeToken}`,
      },
    };
  }

  if (launchContext.orchestratorBaseUrl) {
    const url = new URL(`/cases/${encodeURIComponent(launchContext.caseId)}/upload-assets/download`, launchContext.orchestratorBaseUrl);
    url.searchParams.set('path', input.assetPath);
    return {
      url: url.toString(),
      headers: launchContext.orchestratorHeaders ?? {},
    };
  }

  throw new Error('Recorder launch context cannot download upload assets.');
}

function findPageByGuid(context: BrowserContext, guid: string): Page | undefined {
  return context.pages().find(page => page.guid === guid);
}

function fileNameFromAssetPath(assetPath: string): string {
  return assetPath.split(/[\\/]/u).filter(Boolean).pop() || 'upload.bin';
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').trim();
  return sanitized || 'upload.bin';
}

function uniqueFileName(fileName: string, usedFileNames: Set<string>): string {
  if (!usedFileNames.has(fileName)) {
    usedFileNames.add(fileName);
    return fileName;
  }
  const extension = path.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!usedFileNames.has(candidate)) {
      usedFileNames.add(candidate);
      return candidate;
    }
  }
}

async function readResponseError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    const payload = await response.json().catch(() => null) as { detail?: unknown; message?: unknown; title?: unknown } | null;
    const detail = readErrorText(payload?.detail) || readErrorText(payload?.message) || readErrorText(payload?.title);
    if (detail)
      return detail;
  }
  const text = await response.text().catch(() => '');
  return text.trim() || response.statusText;
}

function readErrorText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : String(error);
}
