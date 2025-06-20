import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FolderOpen, FileText, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FileDestination {
  path: string;
  description: string;
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
  download_count?: number;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
}

export interface MultiFileInstallRequest {
  assets: GitHubAsset[];
  available_destinations: FileDestination[];
  releases: GitHubRelease[];
  selected_version: string;
}

export interface FileInstallChoice {
  asset_name: string;
  destination_path: string;
}

interface MultiFileInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (choices: FileInstallChoice[], version: string) => void;
  onVersionChange: (version: string) => void;
  installRequest: MultiFileInstallRequest | null;
}

export default function MultiFileInstallModal({
  isOpen,
  onClose,
  onConfirm,
  onVersionChange,
  installRequest,
}: MultiFileInstallModalProps) {
  const { t } = useTranslation();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [enabledFiles, setEnabledFiles] = useState<Record<string, boolean>>({});

  // モーダルが開かれたときに初期選択を設定
  useEffect(() => {
    if (isOpen && installRequest && installRequest.assets.length > 0) {
      const defaultDestination = installRequest.available_destinations[0]?.path;
      if (defaultDestination) {
        const initialChoices: Record<string, string> = {};
        const initialEnabled: Record<string, boolean> = {};
        installRequest.assets.forEach(asset => {
          // DLLとnupkgファイルはデフォルトで有効、その他は無効
          const isDefaultEnabled = asset.name.toLowerCase().endsWith('.dll') || 
                                  asset.name.toLowerCase().endsWith('.nupkg');
          initialChoices[asset.name] = isDefaultEnabled ? defaultDestination : 'skip';
          initialEnabled[asset.name] = isDefaultEnabled;
        });
        setChoices(initialChoices);
        setEnabledFiles(initialEnabled);
      }
    }
  }, [isOpen, installRequest]);

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setChoices({});
      setEnabledFiles({});
    }
  }, [isOpen]);

  const handleDestinationChange = (assetName: string, destination: string) => {
    setChoices(prev => ({
      ...prev,
      [assetName]: destination,
    }));
  };

  const handleFileToggle = (assetName: string, enabled: boolean) => {
    setEnabledFiles(prev => ({
      ...prev,
      [assetName]: enabled,
    }));
    
    // ファイルが無効になった場合は'skip'に設定、有効になった場合はデフォルトの配置先に設定
    if (!enabled) {
      setChoices(prev => ({
        ...prev,
        [assetName]: 'skip',
      }));
    } else if (installRequest) {
      const defaultDestination = installRequest.available_destinations[0]?.path;
      if (defaultDestination) {
        setChoices(prev => ({
          ...prev,
          [assetName]: defaultDestination,
        }));
      }
    }
  };

  const handleConfirm = () => {
    if (!installRequest) return;

    const fileChoices: FileInstallChoice[] = installRequest.assets.map(asset => ({
      asset_name: asset.name,
      destination_path: choices[asset.name] || installRequest.available_destinations[0].path,
    }));

    onConfirm(fileChoices, installRequest.selected_version);
    setChoices({});
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const nameLower = fileName.toLowerCase();
    if (nameLower.endsWith('.dll')) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    if (nameLower.endsWith('.nupkg')) {
      return <Package className="w-4 h-4 text-green-400" />;
    }
    if (nameLower.endsWith('.exe')) {
      return <FileText className="w-4 h-4 text-red-400" />;
    }
    if (nameLower.endsWith('.txt') || nameLower.endsWith('.md') || nameLower.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-yellow-400" />;
    }
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  if (!installRequest) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-dark-900 border border-resonite-blue/30 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Download className="w-6 h-6 text-resonite-blue" />
                <h2 className="text-xl font-semibold text-white">
                  複数ファイルの配置先選択
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-dark-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-200">
                このMODには複数のファイルが含まれています。インストールするファイルにチェックを入れ、それぞれの配置先フォルダを選択してください。
              </p>
            </div>

            {/* Version Selection */}
            <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300 mb-0">
                  バージョン選択:
                </label>
                <select
                  value={installRequest.selected_version}
                  onChange={(e) => onVersionChange(e.target.value)}
                  className="bg-dark-700 border border-dark-600 text-white rounded-md px-3 py-1 text-sm min-w-0 max-w-xs"
                >
                  {installRequest.releases.map((release) => (
                    <option key={release.tag_name} value={release.tag_name}>
                      {release.tag_name}
                      {release.prerelease && ' (プレリリース)'}
                      {release.draft && ' (ドラフト)'}
                    </option>
                  ))}
                </select>
              </div>
              {installRequest.releases.find(r => r.tag_name === installRequest.selected_version)?.body && (
                <div className="mt-3 text-xs text-gray-400 max-h-20 overflow-y-auto">
                  {installRequest.releases.find(r => r.tag_name === installRequest.selected_version)?.body}
                </div>
              )}
            </div>

            {/* File List */}
            <div className="space-y-4 mb-6">
              {installRequest.assets.map((asset) => (
                <div
                  key={asset.name}
                  className="bg-dark-800/50 border border-dark-600/30 rounded-lg p-4"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getFileIcon(asset.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabledFiles[asset.name] || false}
                              onChange={(e) => handleFileToggle(asset.name, e.target.checked)}
                              className="rounded border-gray-600 text-resonite-blue focus:ring-resonite-blue focus:ring-offset-0"
                            />
                            <span className="text-sm text-gray-300">インストール</span>
                          </label>
                          <h3 className="text-white font-medium truncate">
                            {asset.name}
                          </h3>
                        </div>
                        {asset.size && (
                          <span className="text-sm text-gray-400 ml-2">
                            {formatFileSize(asset.size)}
                          </span>
                        )}
                      </div>
                      
                      {/* Destination Selection - チェックボックスがオンの時のみ表示 */}
                      {enabledFiles[asset.name] && (
                        <div className="space-y-2">
                          <label className="block text-sm text-gray-300">
                            配置先フォルダ:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {installRequest.available_destinations
                              .filter(dest => dest.path !== 'skip') // "インストールしない"選択肢を除外
                              .map((destination) => (
                              <label
                                key={destination.path}
                                className="flex items-center space-x-2 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`destination-${asset.name}`}
                                  value={destination.path}
                                  checked={choices[asset.name] === destination.path}
                                  onChange={(e) => handleDestinationChange(asset.name, e.target.value)}
                                  className="text-resonite-blue focus:ring-resonite-blue"
                                />
                                <div className="flex items-center space-x-2">
                                  <FolderOpen className="w-4 h-4 text-yellow-400" />
                                  <span className="text-sm text-white">
                                    {destination.description}
                                  </span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* インストールしない場合の説明 */}
                      {!enabledFiles[asset.name] && (
                        <div className="text-sm text-gray-400 italic">
                          このファイルはインストールされません
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="btn-secondary"
              >
                キャンセル
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className="btn-primary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>インストール</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}