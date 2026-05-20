import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRecordingLaunchClientBaseUrl } from './recordingAuthoringPersistence';

test('resolveRecordingLaunchClientBaseUrl prefers payload value, then env, and never invents a default', () => {
  const previous = process.env.AUTHORING_TOOL_CLIENT_BASE_URL;

  try {
    delete process.env.AUTHORING_TOOL_CLIENT_BASE_URL;
    assert.equal(resolveRecordingLaunchClientBaseUrl({}), undefined);

    process.env.AUTHORING_TOOL_CLIENT_BASE_URL = ' http://127.0.0.1:33140 ';
    assert.equal(resolveRecordingLaunchClientBaseUrl({}), 'http://127.0.0.1:33140');

    assert.equal(
        resolveRecordingLaunchClientBaseUrl({ clientBaseUrl: ' http://127.0.0.1:33141 ' }),
        'http://127.0.0.1:33141',
    );
  } finally {
    if (previous === undefined)
      delete process.env.AUTHORING_TOOL_CLIENT_BASE_URL;
    else
      process.env.AUTHORING_TOOL_CLIENT_BASE_URL = previous;
  }
});
