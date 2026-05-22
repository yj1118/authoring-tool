import type { Mode, RecordingSaveResult } from '../../recorderTypes';

export type RecorderStatus =
  | { kind: 'idle' }
  | { kind: 'loadingPage' }
  | { kind: 'ready' }
  | { kind: 'recording' }
  | { kind: 'stopped' }
  | { kind: 'generating' }
  | { kind: 'uploading' }
  | { kind: 'committing' }
  | { kind: 'saved'; result: RecordingSaveResult }
  | { kind: 'failed'; reasonCode: string; message: string };

export type RecorderStatusKey = Exclude<RecorderStatus['kind'], 'saved' | 'failed'>;
export type RecorderCaptureMode = 'recording' | 'scrollIntoView' | 'assertingVisibility' | 'assertingDisabled' | 'assertingNotDisabled' | 'assertingChecked' | 'assertingUnchecked' | 'assertingText' | 'assertingValue' | 'assertingSelectInitial' | 'assertingSelectOptions' | 'assertingSnapshot';

export function isRecorderCaptureMode(mode: Mode): mode is RecorderCaptureMode {
  return mode === 'recording'
    || mode === 'scrollIntoView'
    || mode === 'assertingVisibility'
    || mode === 'assertingDisabled'
    || mode === 'assertingNotDisabled'
    || mode === 'assertingChecked'
    || mode === 'assertingUnchecked'
    || mode === 'assertingText'
    || mode === 'assertingValue'
    || mode === 'assertingSelectInitial'
    || mode === 'assertingSelectOptions'
    || mode === 'assertingSnapshot';
}

export function isSavingStatus(status: RecorderStatus): boolean {
  return status.kind === 'generating' || status.kind === 'uploading' || status.kind === 'committing';
}

export function launchStartedStatus(current: RecorderStatus): RecorderStatus {
  return current.kind === 'idle' ? { kind: 'loadingPage' } : current;
}

export function launchReadyStatus(current: RecorderStatus): RecorderStatus {
  return current.kind === 'loadingPage' || current.kind === 'idle' ? { kind: 'ready' } : current;
}

export function pageNavigatedStatus(current: RecorderStatus): RecorderStatus {
  return current.kind === 'loadingPage' ? { kind: 'ready' } : current;
}

export function modeChangedStatus(current: RecorderStatus, mode: Mode): RecorderStatus {
  if (isRecorderCaptureMode(mode))
    return { kind: 'recording' };
  if ((mode === 'standby' || mode === 'none') && current.kind === 'recording')
    return { kind: 'stopped' };
  return current;
}

export function failedStatus(reasonCode: string, message: string): RecorderStatus {
  return { kind: 'failed', reasonCode, message };
}
