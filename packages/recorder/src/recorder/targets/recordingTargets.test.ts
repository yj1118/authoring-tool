import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DraftScriptStore,
  parseRecordingTargetFromPayload,
  recordingTargetKey,
  recordingTargetViewModel,
  RecordingTargetCatalog,
} from './recordingTargets';

test('recording target parser keeps existing case step launch payloads working', () => {
  const target = parseRecordingTargetFromPayload({
    caseId: 'case-1',
    stepId: 'step-1',
    stepIndex: 2,
    stepText: 'Fill the password field.',
    moduleKind: 'recording.script',
  });

  assert.deepEqual(target, {
    kind: 'case_step',
    caseId: 'case-1',
    stepId: 'step-1',
    stepIndex: 2,
    stepText: 'Fill the password field.',
    moduleKind: 'recording.script',
  });
});

test('recording target parser accepts execution task targets', () => {
  const target = parseRecordingTargetFromPayload({
    target: {
      kind: 'execution_task',
      caseId: 'case-1',
      caseVersionId: 'version-1',
      taskId: 'task-1',
      sourceStepIds: ['step-1', ' step-2 '],
      instructionHash: 'hash-1',
      planVersion: 'execution_plan@0.1',
      title: 'Task 2',
      instruction: 'Run the grouped steps.',
    },
  });

  assert.deepEqual(target, {
    kind: 'execution_task',
    caseId: 'case-1',
    caseVersionId: 'version-1',
    taskId: 'task-1',
    sourceStepIds: ['step-1', 'step-2'],
    instructionHash: 'hash-1',
    planVersion: 'execution_plan@0.1',
    title: 'Task 2',
    instruction: 'Run the grouped steps.',
  });
  assert.equal(recordingTargetKey(target!), 'execution_task:case-1:version-1:task-1:hash-1:step-1%2Cstep-2');
});

test('recording target catalog upserts and activates targets by stable key', () => {
  const catalog = new RecordingTargetCatalog();
  const stepKey = catalog.upsert({
    kind: 'case_step',
    caseId: 'case-1',
    stepId: 'step-1',
    stepIndex: 1,
  });
  const taskKey = catalog.upsert({
    kind: 'execution_task',
    caseId: 'case-1',
    caseVersionId: 'version-1',
    taskId: 'task-1',
    sourceStepIds: ['step-1'],
    instructionHash: 'hash-1',
    planVersion: 'execution_plan@0.1',
    title: 'Task 1',
  });

  assert.equal(catalog.activeTarget()?.kind, 'execution_task');
  assert.equal(catalog.activate(stepKey)?.kind, 'case_step');
  assert.equal(catalog.activate('missing'), null);
  assert.deepEqual(catalog.viewModels('en').map(model => model.key), [stepKey, taskKey]);
});

test('draft script store keeps per-target drafts isolated', () => {
  const store = new DraftScriptStore<string>();
  store.save('target-a', {
    sources: ['source-a'],
    deletedActionKeys: ['action-a'],
  });

  assert.equal(store.hasDirtyDraft('target-a'), true);
  assert.equal(store.hasDirtyDraft('target-b'), false);
  assert.deepEqual(store.read('target-a'), {
    sources: ['source-a'],
    deletedActionKeys: ['action-a'],
  });
  store.clear('target-a');
  assert.equal(store.read('target-a'), null);
});

test('recording target view model separates title and body', () => {
  const model = recordingTargetViewModel({
    kind: 'execution_task',
    caseId: 'case-1',
    caseVersionId: 'version-1',
    taskId: 'task-1',
    sourceStepIds: ['step-1'],
    instructionHash: 'hash-1',
    planVersion: 'execution_plan@0.1',
    title: 'Task 1',
    instruction: 'Line one\nLine two',
  }, 'en');

  assert.equal(model.title, 'Task 1');
  assert.equal(model.body, 'Line one\nLine two');
});
