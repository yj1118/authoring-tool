/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { RecordingUploadAssetOption } from '../../../recorderTypes';
import type { RecorderInstructionDefinition, RecorderInstructionPanelProps } from '../types';
import * as React from 'react';
import { InstructionCheckbox } from '../shared/InstructionControls';
import { InstructionPanelFrame } from '../shared/InstructionPanelFrame';
import { createUploadAssetsActionText, parseUploadAssetsActionText } from './uploadAssetsAction';

export type UploadAssetsInstructionConfig = {
  targetExpression: string;
  acceptsMultiple: boolean | null;
  selectedAssetPaths: string[];
};

export const uploadAssetsInstructionDefinition: RecorderInstructionDefinition<UploadAssetsInstructionConfig> = {
  typeId: 'upload-assets',
  parse: actionText => {
    const parsed = parseUploadAssetsActionText(actionText);
    if (!parsed)
      return null;
    return {
      targetExpression: parsed.targetExpression,
      acceptsMultiple: parsed.argument.acceptsMultiple,
      selectedAssetPaths: parsed.argument.assetPaths,
    };
  },
  createActionText: (_originalActionText, config) => {
    return createUploadAssetsActionText(config.targetExpression, {
      acceptsMultiple: config.acceptsMultiple,
      assetPaths: config.selectedAssetPaths,
    });
  },
  renderPanel: props => <UploadAssetsInstructionPanel {...props} />,
};

const UploadAssetsInstructionPanel: React.FC<RecorderInstructionPanelProps<UploadAssetsInstructionConfig>> = props => {
  const [applying, setApplying] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const assets = props.launchContext?.availableUploadAssets ?? [];
  const selectedAssetPaths = reconcileSelectedAssetPaths(props.config.selectedAssetPaths, assets);
  const selectedAssetPathSet = new Set(selectedAssetPaths);
  const canSelectMultiple = props.config.acceptsMultiple === true;
  const canConfirm = selectedAssetPaths.length > 0;
  const disabled = props.disabled || applying;

  const setAssetChecked = (assetPath: string, checked: boolean) => {
    setApplyError(null);
    if (checked) {
      props.onChange({
        ...props.config,
        selectedAssetPaths: canSelectMultiple ? [...selectedAssetPaths, assetPath] : [assetPath],
      });
      return;
    }
    props.onChange({
      ...props.config,
      selectedAssetPaths: selectedAssetPaths.filter(current => current !== assetPath),
    });
  };

  const onConfirm = () => {
    if (!canConfirm || applying)
      return;
    void (async () => {
      const nextConfig = { ...props.config, selectedAssetPaths };
      if (!props.actionContext || !props.applyUploadAssetsToCurrentInput) {
        setApplyError(props.labels.uploadAssetApplyFailed);
        return;
      }
      setApplying(true);
      setApplyError(null);
      try {
        await props.applyUploadAssetsToCurrentInput({
          actionContext: props.actionContext,
          assetPaths: selectedAssetPaths,
        });
        props.onConfirm(nextConfig);
      } catch (error) {
        setApplyError(`${props.labels.uploadAssetApplyFailed} ${describeError(error)}`);
      } finally {
        setApplying(false);
      }
    })();
  };

  return <InstructionPanelFrame
    title={props.labels.uploadAssetTitle}
    labels={props.labels}
    disabled={disabled}
    confirmDisabled={!canConfirm || applying}
    expanded={props.expanded}
    confirmed={props.confirmed}
    onConfirm={onConfirm}
    onEdit={props.onEdit}
    onReset={props.onReset}
  >
    <div className='recorder-instruction-help'>
      {props.labels.uploadAssetHelp}
    </div>
    {props.config.acceptsMultiple === false ? <div className='recorder-instruction-help'>
      {props.labels.uploadAssetSingleFileOnly}
    </div> : null}
    {assets.length ? <div className='recorder-instruction-choice-list'>
      {assets.map(asset => <UploadAssetChoice
        asset={asset}
        checked={selectedAssetPathSet.has(asset.assetPath)}
        disabled={disabled}
        key={asset.assetPath}
        onChange={checked => setAssetChecked(asset.assetPath, checked)}
      />)}
    </div> : <div className='recorder-instruction-help'>
      {props.labels.uploadAssetNoBoundAssets}
    </div>}
    {applying ? <div className='recorder-instruction-help'>
      {props.labels.uploadAssetApplying}
    </div> : null}
    {!canConfirm ? <div className='recorder-instruction-help'>
      {props.labels.uploadAssetSelectBeforeConfirm}
    </div> : null}
    {applyError ? <div className='recorder-instruction-help recorder-instruction-help-danger'>
      {applyError}
    </div> : null}
  </InstructionPanelFrame>;
};

const UploadAssetChoice: React.FC<{
  asset: RecordingUploadAssetOption;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}> = ({ asset, checked, disabled, onChange }) => {
  const sizeLabel = typeof asset.sizeBytes === 'number' ? ` (${formatBytes(asset.sizeBytes)})` : '';
  return <div className='recorder-instruction-choice'>
    <InstructionCheckbox
      checked={checked}
      disabled={disabled}
      label={`${asset.displayName}${sizeLabel}`}
      onChange={onChange}
    />
    <code>{asset.assetPath}</code>
  </div>;
};

function reconcileSelectedAssetPaths(selectedAssetPaths: string[], assets: RecordingUploadAssetOption[]): string[] {
  const availableAssetPaths = new Set(assets.map(asset => asset.assetPath));
  const reconciled: string[] = [];
  const seen = new Set<string>();
  for (const assetPath of selectedAssetPaths) {
    if (!availableAssetPaths.has(assetPath) || seen.has(assetPath))
      continue;
    seen.add(assetPath);
    reconciled.push(assetPath);
  }
  return reconciled;
}

function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0)
    return '';
  if (sizeBytes < 1024)
    return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024)
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : String(error);
}
