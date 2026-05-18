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

import type { CallLog, Mode, RecordingLaunchContext, RecorderBackend, RecorderFrontend, RecorderLocale, Source } from './recorderTypes';
import * as React from 'react';
import './recorder.css';
import { createRecorderBackend } from './recorderBackend';
import { getRecorderAuthoringMessages, normalizeRecorderLocale } from './messages';
import { generateModuleHandlerScriptFromSources } from './recorder/codegen/moduleHandlerScript';
import { normalizeRecordingAuthoringError, recordingReasonCodes } from './recorder/errors/recordingErrors';
import {
  failedStatus,
  isRecorderCaptureMode,
  isSavingStatus,
  launchReadyStatus,
  launchStartedStatus,
  modeChangedStatus,
  pageNavigatedStatus,
  type RecorderCaptureMode,
  type RecorderStatus,
  type RecorderStatusKey,
} from './recorder/state/recorderStatus';

const launchContextTimeoutMs = 8000;

type ActionPreviewEntry = {
  key: string;
  text: string;
};

type RecorderModeButton = {
  mode: RecorderCaptureMode;
  label: string;
  tooltip: string;
};

export const RecorderAuthoringApp: React.FC = () => {
  const backend = React.useMemo(createRecorderBackend, []);
  const [locale, setLocale] = React.useState<RecorderLocale>(() => normalizeRecorderLocale(window.navigator.language));
  const i18n = React.useMemo(() => getRecorderAuthoringMessages(locale), [locale]);
  const launchContextTimeoutMessageRef = React.useRef(i18n.launchContextTimeout);
  const [mode, setMode] = React.useState<Mode>('none');
  const [sources, setSources] = React.useState<Source[]>([]);
  const [deletedActionKeys, setDeletedActionKeys] = React.useState<Set<string>>(() => new Set());
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [launchContext, setLaunchContext] = React.useState<RecordingLaunchContext | null>(null);
  const [status, setStatus] = React.useState<RecorderStatus>({ kind: 'idle' });
  const [positionActionRecordingEnabled, setPositionActionRecordingEnabledState] = React.useState(false);
  const saveInFlightRef = React.useRef(false);

  React.useEffect(() => {
    document.title = pageUrl ? `${i18n.windowTitle} - ${pageUrl}` : i18n.windowTitle;
  }, [i18n.windowTitle, pageUrl]);

  React.useEffect(() => {
    launchContextTimeoutMessageRef.current = i18n.launchContextTimeout;
  }, [i18n.launchContextTimeout]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      localeChanged: ({ locale }) => setLocale(locale),
      modeChanged: ({ mode }) => {
        setMode(mode);
        setStatus(current => modeChangedStatus(current, mode));
      },
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => {
        setPageUrl(url);
        setStatus(current => pageNavigatedStatus(current));
      },
      pauseStateChanged: () => {},
      callLogsUpdated: (_params: { callLogs: CallLog[] }) => {},
      sourceRevealRequested: () => {},
      elementPicked: () => {},
      selectorAuthoringDiagnosticChanged: ({ diagnostic }) => {
        if (diagnostic?.severity === 'error') {
          setStatus(failedStatus(recordingReasonCodes.pageLoadFailed, diagnostic.message));
        }
      },
      recordingLaunchContextChanged: ({ launchContext }) => {
        setLaunchContext(launchContext);
        setMode('standby');
        setPositionActionRecordingEnabledState(false);
        setSources([]);
        setDeletedActionKeys(new Set());
        setStatus({ kind: 'ready' });
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method]?.call(dispatcher, data.params);
    };
  }, []);

  React.useEffect(() => {
    let disposed = false;
    setStatus(current => launchStartedStatus(current));
    rejectAfter(
        backend.getRecordingLaunchContext(),
        launchContextTimeoutMs,
        launchContextTimeoutMessageRef.current,
    ).then(context => {
      if (disposed)
        return;
      setLaunchContext(context);
      setStatus(current => launchReadyStatus(current));
    }).catch(error => {
      if (disposed)
        return;
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.launchFailed);
      setStatus(failedStatus(normalized.reasonCode, normalized.message));
    });
    return () => {
      disposed = true;
    };
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

  const isSaving = isSavingStatus(status);
  const canSave = generatedSummary.ok && !isSaving;
  const previewActions = React.useMemo(() => choosePreviewActions(sources, deletedActionKeys), [deletedActionKeys, sources]);
  const generatedSummaryMessage = generatedSummary.ok
    ? i18n.countSummary(generatedSummary.actionCount, generatedSummary.assertionCount)
    : previewActions.length
      ? generatedSummary.message
      : i18n.recordAtLeastOneActionOrAssertion;

  const setRecorderMode = React.useCallback((nextMode: Mode) => {
    if (isSaving)
      return;
    backend.setMode({ mode: nextMode }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(
          error,
          isRecorderCaptureMode(nextMode) ? recordingReasonCodes.recordStartFailed : recordingReasonCodes.recordStopFailed,
      );
      setStatus(failedStatus(normalized.reasonCode, normalized.message));
    });
  }, [backend, isSaving]);

  const applyPositionActionRecordingEnabled = React.useCallback(async (enabled: boolean) => {
    await backend.setPositionActionRecordingEnabled({ enabled });
    setPositionActionRecordingEnabledState(enabled);
  }, [backend]);

  const setPositionActionRecordingEnabled = React.useCallback((enabled: boolean) => {
    if (isSaving)
      return;
    applyPositionActionRecordingEnabled(enabled).catch(error => {
      const normalized = normalizeRecordingAuthoringError(
          error,
          enabled ? recordingReasonCodes.recordStartFailed : recordingReasonCodes.recordStopFailed,
      );
      setStatus(failedStatus(normalized.reasonCode, normalized.message));
    });
  }, [applyPositionActionRecordingEnabled, isSaving]);

  const disablePositionActionRecordingIfNeeded = React.useCallback(async () => {
    if (!positionActionRecordingEnabled)
      return;
    await applyPositionActionRecordingEnabled(false);
  }, [applyPositionActionRecordingEnabled, positionActionRecordingEnabled]);

  const actionModeButtons = React.useMemo<RecorderModeButton[]>(() => [
    { mode: 'recording', label: i18n.record, tooltip: i18n.tooltip.record },
    { mode: 'scrollIntoView', label: i18n.locate, tooltip: i18n.tooltip.locate },
  ], [i18n]);

  const assertionModeButtons = React.useMemo<RecorderModeButton[]>(() => [
    { mode: 'assertingVisibility', label: i18n.assertVisible, tooltip: i18n.tooltip.assertVisible },
    { mode: 'assertingDisabled', label: i18n.assertDisabled, tooltip: i18n.tooltip.assertDisabled },
    { mode: 'assertingNotDisabled', label: i18n.assertNotDisabled, tooltip: i18n.tooltip.assertNotDisabled },
    { mode: 'assertingText', label: i18n.assertText, tooltip: i18n.tooltip.assertText },
    { mode: 'assertingValue', label: i18n.assertValue, tooltip: i18n.tooltip.assertValue },
    { mode: 'assertingSnapshot', label: i18n.assertAria, tooltip: i18n.tooltip.assertAria },
  ], [i18n]);

  const renderModeButton = React.useCallback((button: RecorderModeButton) => {
    const isActive = mode === button.mode;
    return <button
      className={`selector-authoring-secondary-button ${isActive ? 'toggled' : ''}`}
      disabled={isSaving}
      key={button.mode}
      onClick={() => setRecorderMode(isActive ? 'standby' : button.mode)}
      title={isActive ? i18n.tooltip.stop : button.tooltip}
      type='button'
    >
      {isActive ? i18n.stop : button.label}
    </button>;
  }, [i18n.stop, i18n.tooltip.stop, isSaving, mode, setRecorderMode]);

  const clear = React.useCallback(() => {
    if (isSaving)
      return;
    void (async () => {
      try {
        await disablePositionActionRecordingIfNeeded();
        await backend.clear();
        setSources([]);
        setDeletedActionKeys(new Set());
        setStatus({ kind: 'idle' });
      } catch (error) {
        const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.codegenFailed);
        setStatus(failedStatus(normalized.reasonCode, normalized.message));
      }
    })();
  }, [backend, disablePositionActionRecordingIfNeeded, isSaving]);

  const deleteAction = React.useCallback((key: string) => {
    if (isSaving)
      return;
    setDeletedActionKeys(current => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, [isSaving]);

  const save = React.useCallback(async () => {
    if (saveInFlightRef.current)
      return;
    saveInFlightRef.current = true;
    try {
      setStatus({ kind: 'generating' });
      if (isRecorderCaptureMode(mode)) {
        try {
          await backend.setMode({ mode: 'standby' });
          setMode('standby');
        } catch (error) {
          throw normalizeRecordingAuthoringError(error, recordingReasonCodes.recordStopFailed);
        }
      }
      await disablePositionActionRecordingIfNeeded();
      const latestSources = await backend.prepareRecordingSources();
      setSources(latestSources);
      const generated = generateModuleHandlerScriptFromSources(applyDeletedActionKeys(latestSources, deletedActionKeys));
      setStatus({ kind: 'uploading' });
      const result = await backend.saveRecording({
        scriptText: generated.scriptText,
        actionCount: generated.actionCount,
        assertionCount: generated.assertionCount,
        sourceId: generated.sourceId,
        startUrl: launchContext?.startUrl ?? pageUrl,
        finalUrl: pageUrl,
        timeoutMs: generated.timeoutMs,
      });
      setStatus({ kind: 'committing' });
      if (result.ok !== true)
        throw new Error(result.message || i18n.saveFailed);
      setStatus({ kind: 'saved', result });
    } catch (error) {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.uploadFailed);
      setStatus(failedStatus(normalized.reasonCode, normalized.message));
    } finally {
      saveInFlightRef.current = false;
    }
  }, [backend, deletedActionKeys, disablePositionActionRecordingIfNeeded, i18n.saveFailed, launchContext?.startUrl, mode, pageUrl]);

  const hasGeneratedError = !generatedSummary.ok && previewActions.length > 0;
  const statusTone = status.kind === 'saved'
    ? 'success'
    : status.kind === 'failed' || hasGeneratedError
      ? 'danger'
      : 'normal';
  const statusLabel = status.kind === 'saved'
    ? i18n.saved()
    : status.kind === 'failed'
      ? status.message
      : i18n.status[status.kind as RecorderStatusKey];
  const failureAdvice = status.kind === 'failed' ? buildFailureAdvice(status.reasonCode, status.message, i18n) : null;
  const stepContextLabel = formatStepContextLabel(launchContext, locale, i18n.noLaunchContext);

  return <div className='recorder'>
    <div className='recorder-authoring-main' aria-busy={isSaving}>
      <div className='recorder-authoring-step-context' title={stepContextLabel}>
        {stepContextLabel}
      </div>

      <div className='recorder-authoring-toolbar'>
        <div className='recorder-authoring-toolbar-row' aria-label={`${i18n.record} / ${i18n.locate}`}>
          {actionModeButtons.map(renderModeButton)}
          <button
            className={`selector-authoring-secondary-button ${positionActionRecordingEnabled ? 'toggled' : ''}`}
            disabled={isSaving}
            onClick={() => setPositionActionRecordingEnabled(!positionActionRecordingEnabled)}
            title={i18n.tooltip.recordScroll}
            type='button'
          >
            {i18n.recordScroll}
          </button>
          <button className='selector-authoring-secondary-button' disabled={!sources.length || isSaving} onClick={clear} title={i18n.tooltip.clear} type='button'>{i18n.clear}</button>
          <button className='selector-authoring-primary-button recorder-authoring-save-button' disabled={!canSave} onClick={() => void save()} title={generatedSummary.ok ? i18n.tooltip.save : generatedSummaryMessage} type='button'>{i18n.save}</button>
        </div>
        <div className='recorder-authoring-toolbar-row recorder-authoring-toolbar-row-assertions' aria-label={`${i18n.assertVisible} / ${i18n.assertDisabled} / ${i18n.assertNotDisabled} / ${i18n.assertText} / ${i18n.assertValue} / ${i18n.assertAria}`}>
          {assertionModeButtons.map(renderModeButton)}
        </div>
      </div>

      <div className={`recorder-authoring-status recorder-authoring-status-${statusTone}`}>
        <span className='recorder-authoring-status-message'>{statusLabel}</span>
        <span className='recorder-authoring-status-summary'>{generatedSummaryMessage}</span>
        {failureAdvice ? <span className='recorder-authoring-status-advice'>{failureAdvice}</span> : null}
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
                  disabled={isSaving}
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
    {isSaving ? <div className='recorder-saving-overlay' role='status' aria-live='polite' aria-busy='true'>
      <div className='recorder-saving-dialog'>
        <div className='recorder-saving-spinner' aria-hidden='true' />
        <div className='recorder-saving-title'>{i18n.savingOverlayTitle}</div>
        <div className='recorder-saving-stage'>{statusLabel}</div>
        <div className='recorder-saving-description'>{i18n.savingOverlayDescription}</div>
      </div>
    </div> : null}
  </div>;
};

function formatStepContextLabel(launchContext: RecordingLaunchContext | null, locale: RecorderLocale, fallback: string): string {
  if (!launchContext)
    return fallback;
  const stepIndex = typeof launchContext.stepIndex === 'number' && Number.isFinite(launchContext.stepIndex) && launchContext.stepIndex > 0
    ? Math.floor(launchContext.stepIndex)
    : undefined;
  const stepText = launchContext.stepText?.trim();
  if (locale === 'ja-JP') {
    if (stepIndex && stepText)
      return `ステップ ${stepIndex} ${stepText}`;
    if (stepIndex)
      return `ステップ ${stepIndex}`;
    if (stepText)
      return `現在のステップ ${stepText}`;
  }
  if (locale === 'en') {
    if (stepIndex && stepText)
      return `Step ${stepIndex}: ${stepText}`;
    if (stepIndex)
      return `Step ${stepIndex}`;
    if (stepText)
      return `Current step: ${stepText}`;
  }
  if (stepIndex && stepText)
    return `步骤 ${stepIndex} ${stepText}`;
  if (stepIndex)
    return `步骤 ${stepIndex}`;
  if (stepText)
    return `当前步骤 ${stepText}`;
  return launchContext.stepId || fallback;
}

function buildFailureAdvice(reasonCode: string, message: string, i18n: ReturnType<typeof getRecorderAuthoringMessages>): string {
  const normalizedReason = reasonCode.toLowerCase();
  const normalizedMessage = message.toLowerCase();
  if (normalizedReason.includes('script_validation') || normalizedReason.includes('codegen'))
    return `${i18n.failureAdvice.checkScript} ${i18n.failureAdvice.rerecord}`;
  if (normalizedReason.includes('upload_grant') || normalizedMessage.includes('s3') || normalizedMessage.includes('minio'))
    return `${i18n.failureAdvice.checkStorage} ${i18n.failureAdvice.retrySave}`;
  if (normalizedReason.includes('commit'))
    return `${i18n.failureAdvice.checkServer} ${i18n.failureAdvice.retrySave}`;
  if (normalizedReason.includes('launch') || normalizedReason.includes('page_load') || normalizedMessage.includes('client'))
    return `${i18n.failureAdvice.checkClient} ${i18n.failureAdvice.retrySave}`;
  if (normalizedReason.includes('upload'))
    return `${i18n.failureAdvice.checkStorage} ${i18n.failureAdvice.retrySave}`;
  return i18n.failureAdvice.retrySave;
}

function rejectAfter<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId)
      clearTimeout(timeoutId);
  });
}

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
