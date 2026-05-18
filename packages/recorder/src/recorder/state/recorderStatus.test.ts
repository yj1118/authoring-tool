import assert from 'node:assert/strict';
import test from 'node:test';

import {
  failedStatus,
  isSavingStatus,
  launchReadyStatus,
  launchStartedStatus,
  modeChangedStatus,
  pageNavigatedStatus,
  type RecorderStatus,
} from './recorderStatus';

test('recorder status follows the happy path from launch to saved', () => {
  let status: RecorderStatus = { kind: 'idle' };

  status = launchStartedStatus(status);
  assert.equal(status.kind, 'loadingPage');

  status = pageNavigatedStatus(status);
  assert.equal(status.kind, 'ready');

  status = modeChangedStatus(status, 'recording');
  assert.equal(status.kind, 'recording');

  status = modeChangedStatus(status, 'standby');
  assert.equal(status.kind, 'stopped');

  status = { kind: 'generating' };
  assert.equal(isSavingStatus(status), true);
  status = { kind: 'uploading' };
  assert.equal(isSavingStatus(status), true);
  status = { kind: 'committing' };
  assert.equal(isSavingStatus(status), true);

  status = {
    kind: 'saved',
    result: {
      ok: true,
      recordingId: 'recording-1',
      caseId: 'case-1',
      stepId: 'step-1',
      status: 'active',
    },
  };
  assert.equal(status.kind, 'saved');
  assert.equal(isSavingStatus(status), false);
});

test('recorder status can fail from launch or save without being considered saving', () => {
  let status: RecorderStatus = { kind: 'idle' };

  status = launchStartedStatus(status);
  assert.equal(status.kind, 'loadingPage');

  status = failedStatus('recording_launch_failed', 'launch failed');
  assert.equal(status.kind, 'failed');
  assert.equal(status.reasonCode, 'recording_launch_failed');
  assert.equal(isSavingStatus(status), false);

  status = { kind: 'uploading' };
  assert.equal(isSavingStatus(status), true);

  status = failedStatus('recording_upload_failed', 'upload failed');
  assert.equal(status.kind, 'failed');
  assert.equal(status.reasonCode, 'recording_upload_failed');
  assert.equal(isSavingStatus(status), false);
});

test('recorder status preserves active recording state during unrelated navigation events', () => {
  let status: RecorderStatus = modeChangedStatus({ kind: 'ready' }, 'assertingVisibility');
  assert.equal(status.kind, 'recording');

  status = pageNavigatedStatus(status);
  assert.equal(status.kind, 'recording');

  status = launchReadyStatus(status);
  assert.equal(status.kind, 'recording');

  status = modeChangedStatus({ kind: 'ready' }, 'assertingNotDisabled');
  assert.equal(status.kind, 'recording');

  status = modeChangedStatus({ kind: 'ready' }, 'assertingChecked');
  assert.equal(status.kind, 'recording');

  status = modeChangedStatus({ kind: 'ready' }, 'assertingUnchecked');
  assert.equal(status.kind, 'recording');
});
