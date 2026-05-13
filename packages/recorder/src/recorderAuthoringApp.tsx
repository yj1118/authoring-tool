/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, Mode, RecordingLaunchContext, RecordingSaveResult, RecorderBackend, RecorderFrontend, RecorderLocale, Source } from './recorderTypes';
import * as React from 'react';
import './recorder.css';
import { createRecorderBackend } from './recorderBackend';
import { getRecorderAuthoringMessages, normalizeRecorderLocale } from './messages';
import { generateModuleHandlerScriptFromSources } from './recorder/codegen/moduleHandlerScript';
import { normalizeRecordingAuthoringError, recordingReasonCodes } from './recorder/errors/recordingErrors';

type RecorderStatus =
  | { kind: 'idle' }
  | { kind: 'ready' }
  | { kind: 'recording' }
  | { kind: 'stopped' }
  | { kind: 'generating' }
  | { kind: 'uploading' }
  | { kind: 'committing' }
  | { kind: 'saved'; result: RecordingSaveResult }
  | { kind: 'failed'; reasonCode: string; message: string };

type RecorderStatusKey = Exclude<RecorderStatus['kind'], 'saved' | 'failed'>;
type RecorderCaptureMode = 'recording' | 'assertingVisibility' | 'assertingText' | 'assertingValue' | 'assertingSnapshot';
type ActionPreviewEntry = {
  key: string;
  text: string;
};

function isRecorderCaptureMode(mode: Mode): mode is RecorderCaptureMode {
  return mode === 'recording'
    || mode === 'assertingVisibility'
    || mode === 'assertingText'
    || mode === 'assertingValue'
    || mode === 'assertingSnapshot';
}

export const RecorderAuthoringApp: React.FC = () => {
  const backend = React.useMemo(createRecorderBackend, []);
  const [locale, setLocale] = React.useState<RecorderLocale>(() => normalizeRecorderLocale(window.navigator.language));
  const i18n = React.useMemo(() => getRecorderAuthoringMessages(locale), [locale]);
  const [mode, setMode] = React.useState<Mode>('none');
  const [sources, setSources] = React.useState<Source[]>([]);
  const [deletedActionKeys, setDeletedActionKeys] = React.useState<Set<string>>(() => new Set());
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [launchContext, setLaunchContext] = React.useState<RecordingLaunchContext | null>(null);
  const [status, setStatus] = React.useState<RecorderStatus>({ kind: 'idle' });

  React.useEffect(() => {
    document.title = pageUrl ? `${i18n.windowTitle} - ${pageUrl}` : i18n.windowTitle;
  }, [i18n.windowTitle, pageUrl]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      localeChanged: ({ locale }) => setLocale(locale),
      modeChanged: ({ mode }) => {
        setMode(mode);
        if (isRecorderCaptureMode(mode))
          setStatus({ kind: 'recording' });
        else if (mode === 'standby' || mode === 'none')
          setStatus(current => current.kind === 'recording' ? { kind: 'stopped' } : current);
      },
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => setPageUrl(url),
      pauseStateChanged: () => {},
      callLogsUpdated: (_params: { callLogs: CallLog[] }) => {},
      sourceRevealRequested: () => {},
      elementPicked: () => {},
      selectorAuthoringDiagnosticChanged: ({ diagnostic }) => {
        if (diagnostic?.severity === 'error') {
          setStatus({
            kind: 'failed',
            reasonCode: recordingReasonCodes.pageLoadFailed,
            message: diagnostic.message,
          });
        }
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method]?.call(dispatcher, data.params);
    };
  }, []);

  React.useEffect(() => {
    backend.getRecordingLaunchContext().then(context => {
      setLaunchContext(context);
      setStatus({ kind: 'ready' });
    }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.launchFailed);
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    });
  }, [backend]);

  const editableSources = React.useMemo(() => applyDeletedActionKeys(sources, deletedActionKeys), [deletedActionKeys, sources]);

  const generatedSummary = React.useMemo(() => {
    try {
      const generated = generateModuleHandlerScriptFromSources(editableSources);
      return {
        ok: true as const,
        actionCount: generated.actionCount,
        assertionCount: generated.assertionCount,
        sourceId: generated.sourceId,
      };
    } catch (error) {
      return {
        ok: false as const,
        message: normalizeRecordingAuthoringError(error, recordingReasonCodes.codegenFailed).message,
      };
    }
  }, [editableSources]);

  const canSave = generatedSummary.ok && status.kind !== 'generating' && status.kind !== 'uploading' && status.kind !== 'committing';
  const previewActions = React.useMemo(() => choosePreviewActions(sources, deletedActionKeys), [deletedActionKeys, sources]);
  const generatedSummaryMessage = generatedSummary.ok
    ? i18n.countSummary(generatedSummary.actionCount, generatedSummary.assertionCount)
    : previewActions.length
      ? generatedSummary.message
      : i18n.recordAtLeastOneActionOrAssertion;

  const setRecorderMode = React.useCallback((nextMode: Mode) => {
    backend.setMode({ mode: nextMode }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(
          error,
          isRecorderCaptureMode(nextMode) ? recordingReasonCodes.recordStartFailed : recordingReasonCodes.recordStopFailed,
      );
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    });
  }, [backend]);

  const modeButtons = React.useMemo(() => [
    { mode: 'recording' as const, label: i18n.record, tooltip: i18n.tooltip.record },
    { mode: 'assertingVisibility' as const, label: i18n.assertVisible, tooltip: i18n.tooltip.assertVisible },
    { mode: 'assertingText' as const, label: i18n.assertText, tooltip: i18n.tooltip.assertText },
    { mode: 'assertingValue' as const, label: i18n.assertValue, tooltip: i18n.tooltip.assertValue },
    { mode: 'assertingSnapshot' as const, label: i18n.assertAria, tooltip: i18n.tooltip.assertAria },
  ], [i18n]);

  const clear = React.useCallback(() => {
    backend.clear().then(() => {
      setSources([]);
      setDeletedActionKeys(new Set());
      setStatus({ kind: 'idle' });
    }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.codegenFailed);
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    });
  }, [backend]);

  const deleteAction = React.useCallback((key: string) => {
    setDeletedActionKeys(current => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  const save = React.useCallback(async () => {
    try {
      setStatus({ kind: 'generating' });
      const generated = generateModuleHandlerScriptFromSources(editableSources);
      setStatus({ kind: 'uploading' });
      const result = await backend.saveRecording({
        scriptText: generated.scriptText,
        actionCount: generated.actionCount,
        assertionCount: generated.assertionCount,
        sourceId: generated.sourceId,
        startUrl: launchContext?.startUrl ?? pageUrl,
        timeoutMs: generated.timeoutMs,
      });
      setStatus({ kind: 'committing' });
      if (result.ok !== true)
        throw new Error(result.message || i18n.saveFailed);
      setStatus({ kind: 'saved', result });
    } catch (error) {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.uploadFailed);
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    }
  }, [backend, editableSources, i18n.saveFailed, launchContext?.startUrl, pageUrl]);

  const statusLabel = status.kind === 'saved'
    ? i18n.saved(status.result.recordingId)
    : status.kind === 'failed'
      ? `${status.reasonCode}: ${status.message}`
      : i18n.status[status.kind as RecorderStatusKey];

  return <div className='recorder'>
    <div className='recorder-authoring-main'>
      <div className='recorder-authoring-toolbar'>
        {modeButtons.map(button => {
          const isActive = mode === button.mode;
          return <button
            className={`selector-authoring-secondary-button ${isActive ? 'toggled' : ''}`}
            key={button.mode}
            onClick={() => setRecorderMode(isActive ? 'standby' : button.mode)}
            title={isActive ? i18n.tooltip.stop : button.tooltip}
            type='button'
          >
            {isActive ? i18n.stop : button.label}
          </button>;
        })}
        <button className='selector-authoring-secondary-button' disabled={!sources.length} onClick={clear} title={i18n.tooltip.clear} type='button'>{i18n.clear}</button>
        <button className='selector-authoring-primary-button' disabled={!canSave} onClick={() => void save()} title={generatedSummary.ok ? i18n.tooltip.save : generatedSummaryMessage} type='button'>{i18n.save}</button>
      </div>

      <div className='recorder-authoring-status'>
        <span>{statusLabel}</span>
        <span>{launchContext ? `${launchContext.caseId} / ${launchContext.stepId}` : i18n.noLaunchContext}</span>
        <span>{generatedSummaryMessage}</span>
      </div>

      <div className='recorder-authoring-source-panel'>
        {generatedSummary.ok ? (
          <div className='recorder-authoring-action-list'>
            {previewActions.map((action, index) => (
              <div className='recorder-authoring-action-row' key={action.key}>
                <span className='recorder-authoring-action-index'>{index + 1}</span>
                <code>{action.text}</code>
                <button
                  aria-label={i18n.tooltip.deleteAction}
                  className='recorder-authoring-action-delete'
                  onClick={() => deleteAction(action.key)}
                  title={i18n.tooltip.deleteAction}
                  type='button'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className='selector-authoring-empty'>
            <div className='selector-authoring-empty-title'>{previewActions.length ? generatedSummaryMessage : i18n.noRecordedActionsYet}</div>
          </div>
        )}
      </div>
    </div>
  </div>;
};

function chooseRecordedSource(sources: Source[]): Source | undefined {
  return sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? sources.find(candidate => candidate.isRecorded && candidate.actions?.length);
}

function normalizePreviewAction(action: string): string {
  return action.trim().split('\n').find(line => line.trim().length > 0)?.trim() ?? '';
}

function hashActionText(action: string): string {
  let hash = 0;
  for (let i = 0; i < action.length; i++)
    hash = Math.imul(31, hash) + action.charCodeAt(i) | 0;
  return (hash >>> 0).toString(36);
}

function actionKey(source: Source, action: string, index: number): string {
  return `${source.id}:${index}:${hashActionText(action)}`;
}

function applyDeletedActionKeys(sources: Source[], deletedActionKeys: Set<string>): Source[] {
  if (!deletedActionKeys.size)
    return sources;
  return sources.map(source => {
    if (!source.isRecorded || !source.actions?.length)
      return source;
    const actions = source.actions.filter((action, index) => !deletedActionKeys.has(actionKey(source, action, index)));
    return { ...source, actions };
  });
}

function choosePreviewActions(sources: Source[], deletedActionKeys: Set<string>): ActionPreviewEntry[] {
  const source = sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? chooseRecordedSource(sources);
  if (!source)
    return [];
  return (source.actions ?? []).flatMap((action, index) => {
    const key = actionKey(source, action, index);
    if (deletedActionKeys.has(key))
      return [];
    const text = normalizePreviewAction(action);
    return text ? [{ key, text }] : [];
  });
}
