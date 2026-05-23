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

import type { CallLog, Mode, RecordingLaunchContext, RecorderFrontend, RecorderLocale, Source } from './recorderTypes';
import * as React from 'react';
import './recorder.css';
import { createRecorderBackend } from './recorderBackend';
import { getRecorderAuthoringMessages, normalizeRecorderLocale } from './messages';
import { generateModuleHandlerScriptFromSources } from './recorder/codegen/moduleHandlerScript';
import { hydrateRecordingAuthoringModel } from './recorder/authoringModel/authoringModelHydrator';
import { normalizeRecordingAuthoringError, recordingReasonCodes } from './recorder/errors/recordingErrors';
import { recorderInstructionLabels } from './recorder/instructions/labels';
import {
  buildRecorderInstructionActionTextOverrides,
  hasUnconfirmedRecorderInstructions,
  reconcileRecorderInstructionDrafts,
  RecorderInstructionPanel,
} from './recorder/instructions/recorderInstructionRegistry';
import type { RecorderInstructionDraft, RecorderInstructionDraftMap } from './recorder/instructions/types';
import { saveRecordingWorkflow } from './recorder/save/saveRecordingWorkflow';
import { applyRecordedActionEdits, choosePreviewActions } from './recorder/sources/recordedSourceModel';
import {
  failedStatus,
  isRecorderCaptureMode,
  isSavingStatus,
  launchReadyStatus,
  launchStartedStatus,
  modeChangedStatus,
  pageNavigatedStatus,
  type RecorderStatus,
  type RecorderStatusKey,
} from './recorder/state/recorderStatus';
import {
  buildActionModeButtons,
  buildAssertionModeButtons,
  type RecorderModeButton,
} from './recorder/toolbar/recorderToolCatalog';
import {
  recordingTargetKey,
  recordingTargetViewModel,
} from './recorder/targets/recordingTargets';

const launchContextTimeoutMs = 8000;

export const RecorderAuthoringApp: React.FC = () => {
  const backend = React.useMemo(createRecorderBackend, []);
  const [locale, setLocale] = React.useState<RecorderLocale>(() => normalizeRecorderLocale(window.navigator.language));
  const i18n = React.useMemo(() => getRecorderAuthoringMessages(locale), [locale]);
  const instructionLabels = React.useMemo(() => recorderInstructionLabels(locale), [locale]);
  const launchContextTimeoutMessageRef = React.useRef(i18n.launchContextTimeout);
  const [mode, setMode] = React.useState<Mode>('none');
  const [sources, setSources] = React.useState<Source[]>([]);
  const [deletedActionKeys, setDeletedActionKeys] = React.useState<Set<string>>(() => new Set());
  const [instructionDrafts, setInstructionDrafts] = React.useState<RecorderInstructionDraftMap>(() => new Map());
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [launchContext, setLaunchContext] = React.useState<RecordingLaunchContext | null>(null);
  const [status, setStatus] = React.useState<RecorderStatus>({ kind: 'idle' });
  const [positionActionRecordingEnabled, setPositionActionRecordingEnabledState] = React.useState(false);
  const saveInFlightRef = React.useRef(false);

  const activateLaunchContext = React.useCallback((context: RecordingLaunchContext) => {
    const hydrated = hydrateRecordingAuthoringModel(context.initialAuthoringModel);
    setLaunchContext(context);
    setMode('standby');
    setPositionActionRecordingEnabledState(false);
    setSources(hydrated.sources);
    setDeletedActionKeys(new Set());
    setInstructionDrafts(hydrated.instructionDrafts);
    setStatus({ kind: 'ready' });
  }, []);

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
        if (diagnostic?.severity === 'error')
          setStatus(failedStatus(recordingReasonCodes.pageLoadFailed, diagnostic.message));
      },
      recordingLaunchContextChanged: ({ launchContext }) => {
        activateLaunchContext(launchContext);
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method]?.call(dispatcher, data.params);
    };
  }, [activateLaunchContext]);

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
      if (context)
        activateLaunchContext(context);
      else
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

  const basePreviewActions = React.useMemo(() => choosePreviewActions(sources, deletedActionKeys), [deletedActionKeys, sources]);

  React.useEffect(() => {
    setInstructionDrafts(current => reconcileRecorderInstructionDrafts(basePreviewActions, current));
  }, [basePreviewActions]);

  const instructionActionTextOverrides = React.useMemo(() => {
    return buildRecorderInstructionActionTextOverrides(basePreviewActions, instructionDrafts);
  }, [basePreviewActions, instructionDrafts]);

  const editableSources = React.useMemo(() => {
    return applyRecordedActionEdits(sources, deletedActionKeys, instructionActionTextOverrides);
  }, [deletedActionKeys, instructionActionTextOverrides, sources]);

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
  const hasUnconfirmedInstructions = React.useMemo(() => {
    return hasUnconfirmedRecorderInstructions(basePreviewActions, instructionDrafts);
  }, [basePreviewActions, instructionDrafts]);
  const canSave = generatedSummary.ok && !isSaving && !hasUnconfirmedInstructions;
  const previewActions = React.useMemo(() => {
    return choosePreviewActions(sources, deletedActionKeys, instructionActionTextOverrides);
  }, [deletedActionKeys, instructionActionTextOverrides, sources]);
  const generatedSummaryMessage = generatedSummary.ok
    ? hasUnconfirmedInstructions
      ? instructionLabels.confirmBeforeSave
      : i18n.countSummary(generatedSummary.actionCount, generatedSummary.assertionCount)
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

  const activeTargetKey = launchContext ? recordingTargetKey(launchContext.target) : undefined;
  const targetItems = React.useMemo(() => {
    return launchContext
      ? [{ context: launchContext, viewModel: recordingTargetViewModel(launchContext.target, locale) }]
      : [];
  }, [launchContext, locale]);

  const switchTarget = React.useCallback((nextContext: RecordingLaunchContext) => {
    if (isSaving)
      return;
    const nextTargetKey = recordingTargetKey(nextContext.target);
    if (nextTargetKey === activeTargetKey)
      return;
    void (async () => {
      try {
        await disablePositionActionRecordingIfNeeded();
        await backend.switchRecordingLaunchContext({ launchContext: nextContext });
      } catch (error) {
        const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.launchFailed);
        setStatus(failedStatus(normalized.reasonCode, normalized.message));
      }
    })();
  }, [activeTargetKey, backend, disablePositionActionRecordingIfNeeded, isSaving]);

  const actionModeButtons = React.useMemo<RecorderModeButton[]>(() => buildActionModeButtons(i18n), [i18n]);

  const assertionModeButtons = React.useMemo<RecorderModeButton[]>(() => buildAssertionModeButtons(i18n), [i18n]);

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
        setInstructionDrafts(new Map());
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

  const updateInstructionDraft = React.useCallback((instructionId: string, draft: RecorderInstructionDraft) => {
    if (isSaving)
      return;
    setInstructionDrafts(current => {
      const next = new Map(current);
      next.set(instructionId, draft);
      return next;
    });
  }, [isSaving]);

  const save = React.useCallback(async () => {
    if (saveInFlightRef.current || !generatedSummary.ok || hasUnconfirmedInstructions)
      return;
    saveInFlightRef.current = true;
    try {
      await saveRecordingWorkflow({
        actionTextOverrides: instructionActionTextOverrides,
        backend,
        deletedActionKeys,
        disablePositionActionRecordingIfNeeded,
        instructionDrafts,
        launchContext,
        mode,
        pageUrl,
        saveFailedMessage: i18n.saveFailed,
        setMode,
        setSources,
        setStatus,
      });
    } finally {
      saveInFlightRef.current = false;
    }
  }, [backend, deletedActionKeys, disablePositionActionRecordingIfNeeded, generatedSummary.ok, hasUnconfirmedInstructions, i18n.saveFailed, instructionActionTextOverrides, instructionDrafts, launchContext, mode, pageUrl]);

  const hasGeneratedError = !generatedSummary.ok && previewActions.length > 0;
  const statusTone = status.kind === 'saved'
    ? 'success'
    : status.kind === 'failed' || hasGeneratedError
      ? 'danger'
      : hasUnconfirmedInstructions
        ? 'warning'
        : 'normal';
  const statusLabel = status.kind === 'saved'
    ? i18n.saved()
    : status.kind === 'failed'
      ? status.message
      : i18n.status[status.kind as RecorderStatusKey];
  const failureAdvice = status.kind === 'failed' ? buildFailureAdvice(status.reasonCode, status.message, i18n) : null;

  return <div className='recorder'>
    <div className='recorder-authoring-main' aria-busy={isSaving}>
      <div className='recorder-authoring-target-panel'>
        <div className='recorder-authoring-target-list' role='listbox' aria-label={i18n.targets}>
          {targetItems.length ? targetItems.map(item => {
            const isActiveTarget = item.viewModel.key === activeTargetKey;
            return <button
              aria-selected={isActiveTarget}
              className={`recorder-authoring-target-item ${isActiveTarget ? 'active' : ''}`}
              disabled={isSaving}
              key={item.viewModel.key}
              onClick={() => switchTarget(item.context)}
              role='option'
              title={item.viewModel.body ? `${item.viewModel.title}\n${item.viewModel.body}` : item.viewModel.title}
              type='button'
            >
              <span className='recorder-authoring-target-title'>{item.viewModel.title}</span>
              {item.viewModel.body ? <span className='recorder-authoring-target-body'>{item.viewModel.body}</span> : null}
            </button>;
          }) : (
            <div className='recorder-authoring-step-context' title={i18n.noLaunchContext}>
              {i18n.noLaunchContext}
            </div>
          )}
        </div>
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
          <button className='selector-authoring-primary-button recorder-authoring-save-button' disabled={!canSave} onClick={() => void save()} title={hasUnconfirmedInstructions ? instructionLabels.confirmBeforeSave : generatedSummary.ok ? i18n.tooltip.save : generatedSummaryMessage} type='button'>{i18n.save}</button>
        </div>
        <div className='recorder-authoring-toolbar-row recorder-authoring-toolbar-row-assertions' aria-label={`${i18n.assertVisible} / ${i18n.assertDisabled} / ${i18n.assertChecked} / ${i18n.assertText} / ${i18n.assertValue} / ${i18n.assertPasswordInput} / ${i18n.assertSelectOptions} / ${i18n.assertAria}`}>
          {assertionModeButtons.map(renderModeButton)}
        </div>
      </div>

      <div className={`recorder-authoring-status recorder-authoring-status-${statusTone}`}>
        <span className='recorder-authoring-status-message'>{statusLabel}</span>
        <span className={`recorder-authoring-status-summary ${hasUnconfirmedInstructions ? 'recorder-authoring-status-summary-warning' : ''}`}>
          {hasUnconfirmedInstructions ? <span className='recorder-authoring-status-warning-icon' aria-hidden='true'>!</span> : null}
          <span>{generatedSummaryMessage}</span>
        </span>
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
                <RecorderInstructionPanel
                  disabled={isSaving}
                  draft={instructionDrafts.get(action.instructionId)}
                  entry={action}
                  labels={instructionLabels}
                  onChange={updateInstructionDraft}
                />
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
