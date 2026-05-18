import type { Mode, RecordingLaunchContext, RecorderBackend, Source } from '../../recorderTypes';
import { generateModuleHandlerScriptFromSources } from '../codegen/moduleHandlerScript';
import { normalizeRecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';
import { failedStatus, isRecorderCaptureMode, type RecorderStatus } from '../state/recorderStatus';
import { applyDeletedActionKeys } from '../sources/recordedSourceModel';

type SetState<T> = (value: T | ((current: T) => T)) => void;

export async function saveRecordingWorkflow(input: {
  backend: RecorderBackend;
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
    const generated = generateModuleHandlerScriptFromSources(applyDeletedActionKeys(latestSources, input.deletedActionKeys));
    input.setStatus({ kind: 'uploading' });
    const result = await input.backend.saveRecording({
      scriptText: generated.scriptText,
      actionCount: generated.actionCount,
      assertionCount: generated.assertionCount,
      sourceId: generated.sourceId,
      startUrl: input.launchContext?.startUrl ?? input.pageUrl,
      finalUrl: input.pageUrl,
      timeoutMs: generated.timeoutMs,
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
