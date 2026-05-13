export const recordingReasonCodes = {
  launchFailed: 'recording_launch_failed',
  pageLoadFailed: 'recording_page_load_failed',
  recordStartFailed: 'recording_record_start_failed',
  recordStopFailed: 'recording_record_stop_failed',
  codegenFailed: 'recording_codegen_failed',
  scriptValidationFailed: 'recording_script_validation_failed',
  uploadGrantUnavailable: 'recording_upload_grant_unavailable',
  uploadFailed: 'recording_upload_failed',
  commitFailed: 'recording_commit_failed',
  userCanceled: 'recording_user_canceled',
} as const;

export type RecordingReasonCode = typeof recordingReasonCodes[keyof typeof recordingReasonCodes];

export class RecordingAuthoringError extends Error {
  readonly reasonCode: RecordingReasonCode;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    reasonCode: RecordingReasonCode;
    message: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'RecordingAuthoringError';
    this.reasonCode = input.reasonCode;
    this.details = input.details;
  }
}

export function createRecordingAuthoringError(input: {
  reasonCode: RecordingReasonCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}): RecordingAuthoringError {
  return new RecordingAuthoringError(input);
}

export function normalizeRecordingAuthoringError(error: unknown, fallbackReasonCode: RecordingReasonCode): RecordingAuthoringError {
  if (error instanceof RecordingAuthoringError)
    return error;
  const reflectedReasonCode = typeof error === 'object' && error !== null
    ? (error as { reasonCode?: unknown }).reasonCode
    : undefined;
  const reasonCode = typeof reflectedReasonCode === 'string' && Object.values(recordingReasonCodes).includes(reflectedReasonCode as RecordingReasonCode)
    ? reflectedReasonCode as RecordingReasonCode
    : fallbackReasonCode;
  return new RecordingAuthoringError({
    reasonCode,
    message: error instanceof Error && error.message.trim().length ? error.message : 'Recording authoring failed.',
    cause: error,
  });
}
