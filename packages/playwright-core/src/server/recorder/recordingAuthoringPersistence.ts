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

import type { RecordingLaunchContext, RecordingSaveRequest, RecordingSaveResult } from '@recorder/recorderTypes';
import { createRecordingAuthoringError, recordingReasonCodes, type RecordingReasonCode } from '@recorder/recorder/errors/recordingErrors';

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeFetchError(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error && error.message.trim())
    parts.push(error.message.trim());

  const cause = isRecord(error) && error.cause instanceof Error ? error.cause : null;
  if (cause?.message?.trim() && !parts.includes(cause.message.trim()))
    parts.push(cause.message.trim());

  return parts.length ? parts.join(': ') : 'network request failed';
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value))
    return undefined;
  const headers: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = normalizeOptionalString(key);
    const normalizedValue = normalizeOptionalString(rawValue);
    if (normalizedKey && normalizedValue)
      headers[normalizedKey] = normalizedValue;
  }
  return Object.keys(headers).length ? headers : undefined;
}

function readLaunchContextFromEnv(): RecordingLaunchContext | null {
  const raw = normalizeOptionalString(process.env.AUTHORING_TOOL_RECORDING_LAUNCH_PAYLOAD_JSON);
  if (!raw)
    return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed))
    return null;

  const caseId = normalizeOptionalString(parsed.caseId);
  const stepId = normalizeOptionalString(parsed.stepId);
  const startUrl = normalizeOptionalString(parsed.startUrl);
  if (!caseId || !stepId || !startUrl)
    return null;

  return {
    caseId,
    stepId,
    startUrl,
    source: normalizeOptionalString(parsed.source) ?? 'client.manual',
    moduleKind: normalizeOptionalString(parsed.moduleKind) ?? 'manual.replay',
    clientBaseUrl: normalizeOptionalString(parsed.clientBaseUrl) ?? normalizeOptionalString(process.env.AUTHORING_TOOL_CLIENT_BASE_URL),
    orchestratorBaseUrl: normalizeOptionalString(parsed.orchestratorBaseUrl),
    orchestratorHeaders: normalizeHeaders(parsed.orchestratorHeaders),
    recordingBridgeBaseUrl: normalizeOptionalString(parsed.recordingBridgeBaseUrl),
    recordingBridgeToken: normalizeOptionalString(parsed.recordingBridgeToken),
  };
}

async function readJsonResponse(response: Response, action: string): Promise<unknown> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
  }
  if (!response.ok) {
    const detail = isRecord(payload)
      ? normalizeOptionalString(payload.detail) ?? normalizeOptionalString(payload.message) ?? normalizeOptionalString(payload.title)
      : undefined;
    const reasonCode = isRecord(payload)
      ? normalizeOptionalString(payload.reasonCode)
      : undefined;
    throw createRecordingAuthoringError({
      reasonCode: mapClientReasonCode(reasonCode),
      message: `${action} failed (${response.status}): ${detail ?? response.statusText}`,
      details: {
        status: response.status,
        ...(reasonCode ? { clientReasonCode: reasonCode } : {}),
      },
    });
  }
  return payload;
}

function mapClientReasonCode(reasonCode: string | undefined): RecordingReasonCode {
  if (!reasonCode)
    return recordingReasonCodes.uploadFailed;
  if (reasonCode.includes('script_validation'))
    return recordingReasonCodes.scriptValidationFailed;
  if (reasonCode.includes('upload_grant'))
    return recordingReasonCodes.uploadGrantUnavailable;
  if (reasonCode.includes('upload'))
    return recordingReasonCodes.uploadFailed;
  if (reasonCode.includes('commit'))
    return recordingReasonCodes.commitFailed;
  return recordingReasonCodes.uploadFailed;
}

export function getRecordingLaunchContext(): RecordingLaunchContext | null {
  return readLaunchContextFromEnv();
}

export async function saveRecordingThroughClient(request: RecordingSaveRequest): Promise<RecordingSaveResult> {
  const launchContext = readLaunchContextFromEnv();
  if (!launchContext?.clientBaseUrl)
    throw new Error('Recorder launch context is missing clientBaseUrl.');
  if (!launchContext.orchestratorBaseUrl && (!launchContext.recordingBridgeBaseUrl || !launchContext.recordingBridgeToken))
    throw new Error('Recorder launch context is missing recording persistence target.');

  const clientSaveUrl = new URL('/api/v1/recording/save', launchContext.clientBaseUrl).toString();
  let response: Response;
  try {
    response = await fetch(clientSaveUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        caseId: launchContext.caseId,
        stepId: launchContext.stepId,
        orchestratorBaseUrl: launchContext.orchestratorBaseUrl,
        orchestratorHeaders: launchContext.orchestratorHeaders,
        recordingBridgeBaseUrl: launchContext.recordingBridgeBaseUrl,
        recordingBridgeToken: launchContext.recordingBridgeToken,
        startUrl: request.startUrl ?? launchContext.startUrl,
        scriptText: request.scriptText,
        actionCount: request.actionCount,
        assertionCount: request.assertionCount,
        sourceId: request.sourceId,
        timeoutMs: request.timeoutMs,
      }),
    });
  } catch (error) {
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.uploadFailed,
      message: `Local Client is unreachable at ${launchContext.clientBaseUrl}. Keep the Client running and retry. ${describeFetchError(error)}`,
      details: {
        clientBaseUrl: launchContext.clientBaseUrl,
        clientSaveUrl,
      },
      cause: error,
    });
  }

  return await readJsonResponse(response, 'recording save') as RecordingSaveResult;
}
