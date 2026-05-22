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

import { generateModuleHandlerScriptFromSources } from '../codegen/moduleHandlerScript';
import { normalizeRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { failedStatus, isRecorderCaptureMode } from '../state/recorderStatus';
import { applyRecordedActionEdits } from '../sources/recordedSourceModel';

import type { Mode, RecordingLaunchContext, RecorderBackend, Source } from '../../recorderTypes';
import type { RecorderStatus } from '../state/recorderStatus';

type SetState<T> = (value: T | ((current: T) => T)) => void;

export async function saveRecordingWorkflow(input: {
  backend: RecorderBackend;
  actionTextOverrides: ReadonlyMap<string, string>;
  deletedActionKeys: Set<string>;
  disablePositionActionRecordingIfNeeded: () => Promise<void>;
  launchContext: RecordingLaunchContext | null;
  mode: Mode;
  pageUrl: string | undefined;
  saveFailedMessage: string;
  setMode: SetState<Mode>;
  setSources: SetState<Source[]>;
  setStatus: SetState<RecorderStatus>;
}): Promise<void> {
  try {
    input.setStatus({ kind: 'generating' });
    if (isRecorderCaptureMode(input.mode)) {
      try {
        await input.backend.setMode({ mode: 'standby' });
        input.setMode('standby');
      } catch (error) {
        throw normalizeRecordingAuthoringError(error, recordingReasonCodes.recordStopFailed);
      }
    }
    await input.disablePositionActionRecordingIfNeeded();
    const latestSources = await input.backend.prepareRecordingSources();
    input.setSources(latestSources);
    const generated = generateModuleHandlerScriptFromSources(applyRecordedActionEdits(latestSources, input.deletedActionKeys, input.actionTextOverrides));
    input.setStatus({ kind: 'uploading' });
    const result = await input.backend.saveRecording({
      scriptText: generated.scriptText,
      actionCount: generated.actionCount,
      assertionCount: generated.assertionCount,
      sourceId: generated.sourceId,
      startUrl: input.launchContext?.startUrl ?? input.pageUrl,
      finalUrl: input.pageUrl,
      timeoutMs: generated.timeoutMs,
      recordingApi: generated.recordingApi,
    });
    input.setStatus({ kind: 'committing' });
    if (result.ok !== true)
      throw new Error(result.message || input.saveFailedMessage);
    input.setStatus({ kind: 'saved', result });
  } catch (error) {
    const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.uploadFailed);
    input.setStatus(failedStatus(normalized.reasonCode, normalized.message));
  }
}
