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

import type { CallLog, Mode, RecordingLaunchContext, RecordingSaveResult, RecorderBackend, RecorderFrontend, Source } from './recorderTypes';
import * as React from 'react';
import './recorder.css';
import { createRecorderBackend } from './recorderBackend';
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

const windowTitle = 'Recorder Authoring Tool';

export const RecorderAuthoringApp: React.FC = () => {
  const backend = React.useMemo(createRecorderBackend, []);
  const [mode, setMode] = React.useState<Mode>('none');
  const [sources, setSources] = React.useState<Source[]>([]);
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [launchContext, setLaunchContext] = React.useState<RecordingLaunchContext | null>(null);
  const [status, setStatus] = React.useState<RecorderStatus>({ kind: 'idle' });

  React.useEffect(() => {
    document.title = pageUrl ? `${windowTitle} - ${pageUrl}` : windowTitle;
  }, [pageUrl]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      localeChanged: () => {},
      modeChanged: ({ mode }) => {
        setMode(mode);
        if (mode === 'recording')
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

  const generatedSummary = React.useMemo(() => {
    try {
      const generated = generateModuleHandlerScriptFromSources(sources);
      return {
        ok: true as const,
        actionCount: generated.actionCount,
        assertionCount: generated.assertionCount,
        sourceId: generated.sourceId,
      };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [sources]);

  const isRecording = mode === 'recording';
  const canSave = generatedSummary.ok && status.kind !== 'generating' && status.kind !== 'uploading' && status.kind !== 'committing';

  const setRecorderMode = React.useCallback((nextMode: Mode) => {
    backend.setMode({ mode: nextMode }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(
          error,
          nextMode === 'recording' ? recordingReasonCodes.recordStartFailed : recordingReasonCodes.recordStopFailed,
      );
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    });
  }, [backend]);

  const clear = React.useCallback(() => {
    backend.clear().then(() => {
      setSources([]);
      setStatus({ kind: 'idle' });
    }).catch(error => {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.codegenFailed);
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    });
  }, [backend]);

  const save = React.useCallback(async () => {
    try {
      setStatus({ kind: 'generating' });
      const generated = generateModuleHandlerScriptFromSources(sources);
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
        throw new Error(result.message || 'Recording save failed.');
      setStatus({ kind: 'saved', result });
    } catch (error) {
      const normalized = normalizeRecordingAuthoringError(error, recordingReasonCodes.uploadFailed);
      setStatus({ kind: 'failed', reasonCode: normalized.reasonCode, message: normalized.message });
    }
  }, [backend, launchContext?.startUrl, pageUrl, sources]);

  const statusLabel = status.kind === 'saved'
    ? `Saved ${status.result.recordingId ?? ''}`.trim()
    : status.kind === 'failed'
      ? `${status.reasonCode}: ${status.message}`
      : status.kind;

  return <div className='recorder'>
    <div className='recorder-authoring-main'>
      <div className='recorder-authoring-toolbar'>
        <button
          className={`selector-authoring-primary-button ${isRecording ? 'toggled' : ''}`}
          onClick={() => setRecorderMode(isRecording ? 'standby' : 'recording')}
          type='button'
        >
          {isRecording ? 'Stop' : 'Record'}
        </button>
        <button className='selector-authoring-secondary-button' onClick={() => setRecorderMode('assertingVisibility')} type='button'>Visible</button>
        <button className='selector-authoring-secondary-button' onClick={() => setRecorderMode('assertingText')} type='button'>Text</button>
        <button className='selector-authoring-secondary-button' onClick={() => setRecorderMode('assertingValue')} type='button'>Value</button>
        <button className='selector-authoring-secondary-button' onClick={() => setRecorderMode('assertingSnapshot')} type='button'>ARIA</button>
        <button className='selector-authoring-secondary-button' disabled={!sources.length} onClick={clear} type='button'>Clear</button>
        <button className='selector-authoring-primary-button' disabled={!canSave} onClick={() => void save()} type='button'>Save</button>
      </div>

      <div className='recorder-authoring-status'>
        <span>{statusLabel}</span>
        <span>{launchContext ? `${launchContext.caseId} / ${launchContext.stepId}` : 'No launch context'}</span>
        <span>{generatedSummary.ok ? `${generatedSummary.actionCount} actions, ${generatedSummary.assertionCount} assertions` : generatedSummary.message}</span>
      </div>

      <div className='recorder-authoring-source-panel'>
        {generatedSummary.ok ? (
          <div className='recorder-authoring-action-list'>
            {choosePreviewActions(sources).map((action, index) => (
              <div className='recorder-authoring-action-row' key={`${index}-${action}`}>
                <span>{index + 1}</span>
                <code>{action}</code>
              </div>
            ))}
          </div>
        ) : (
          <div className='selector-authoring-empty'>
            <div className='selector-authoring-empty-title'>No recorded actions yet</div>
          </div>
        )}
      </div>
    </div>
  </div>;
};

function choosePreviewActions(sources: Source[]): string[] {
  const source = sources.find(candidate => candidate.isRecorded && candidate.id === 'playwright-test')
    ?? sources.find(candidate => candidate.isRecorded && candidate.actions?.length);
  return (source?.actions ?? [])
      .map(action => action.trim().split('\n').find(line => line.trim().length > 0)?.trim() ?? '')
      .filter(Boolean);
}
