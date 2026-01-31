import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Package, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { useTranslation } from 'react-i18next';
import { ExportManifest, ImportResult, ModImportResult } from '../types/profile-transfer';

interface SteamCredentials {
  username: string;
  password: string;
}

interface ProfileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'complete';

export default function ProfileImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ProfileImportModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>('select');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectFile = async () => {
    setError(null);
    try {
      const selected = await open({
        filters: [
          {
            name: 'RESO Launcher Profile',
            extensions: ['rlprofile'],
          },
        ],
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        setIsLoading(true);

        // プレビューを取得
        const preview = await invoke<ExportManifest>('preview_profile_import', {
          archivePath: selected,
        });

        setManifest(preview);
        setNewProfileName(`${preview.profile.display_name}_imported`);
        setStep('preview');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!filePath) return;

    setError(null);
    setStep('importing');

    try {
      // 保存済みの Steam 認証情報を取得
      let steamUsername: string | null = null;
      let steamPassword: string | null = null;
      try {
        const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
        if (credentials) {
          steamUsername = credentials.username;
          steamPassword = credentials.password;
        }
      } catch (credErr) {
        console.warn('Failed to load steam credentials:', credErr);
      }

      const result = await invoke<ImportResult>('import_profile', {
        archivePath: filePath,
        newProfileName: newProfileName || null,
        steamUsername,
        steamPassword,
      });

      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(String(err));
      setStep('preview');
    }
  };

  const handleClose = () => {
    if (step === 'complete') {
      onImportComplete();
    }
    // Reset state
    setStep('select');
    setFilePath(null);
    setManifest(null);
    setNewProfileName('');
    setImportResult(null);
    setError(null);
    onClose();
  };

  const getModStatusIcon = (result: ModImportResult) => {
    const status = result.status;
    if (status === 'Success') {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    } else if (status === 'Skipped' || (typeof status === 'object' && 'VersionNotFound' in status)) {
      return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getModStatusText = (result: ModImportResult) => {
    const status = result.status;
    if (status === 'Success') {
      return t('profiles.import.modSuccess', 'Installed');
    } else if (typeof status === 'object' && 'VersionNotFound' in status) {
      const available = status.VersionNotFound.available_version;
      return available
        ? t('profiles.import.modVersionNotFound', 'Version not found (latest: {{version}})', { version: available })
        : t('profiles.import.modVersionNotFoundNoAlt', 'Version not found');
    } else if (status === 'SourceUnavailable') {
      return t('profiles.import.modSourceUnavailable', 'Source unavailable');
    } else if (status === 'FileNotFound') {
      return t('profiles.import.modFileNotFound', 'File not found');
    } else if (status === 'Skipped') {
      return t('profiles.import.modSkipped', 'Skipped');
    }
    return '';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-dark-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-dark-600 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Upload className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold">
                {t('profiles.import.title', 'Import Profile')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step: Select File */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-400">
                {t(
                  'profiles.import.selectFile',
                  'Select a .rlprofile file to import'
                )}
              </p>

              <button
                onClick={handleSelectFile}
                disabled={isLoading}
                className="w-full p-8 border-2 border-dashed border-dark-500 rounded-xl hover:border-blue-500 hover:bg-dark-700/50 transition-all flex flex-col items-center justify-center space-y-2"
              >
                {isLoading ? (
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
                <span className="text-gray-400">
                  {isLoading
                    ? t('profiles.import.loading', 'Loading...')
                    : t('profiles.import.clickToSelect', 'Click to select file')}
                </span>
              </button>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && manifest && (
            <div className="space-y-4">
              {/* Profile Info */}
              <div className="p-4 bg-dark-700 rounded-lg space-y-2">
                <h3 className="font-semibold text-lg">
                  {manifest.profile.display_name}
                </h3>
                {manifest.profile.description && (
                  <p className="text-gray-400 text-sm">
                    {manifest.profile.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-dark-600 rounded">
                    {t('profiles.import.exportedOn', 'Exported')}: {new Date(manifest.export_date).toLocaleDateString()}
                  </span>
                  <span className="px-2 py-1 bg-dark-600 rounded">
                    v{manifest.source_app_version}
                  </span>
                  {manifest.game_info && (
                    <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded">
                      Resonite {manifest.game_info.version || manifest.game_info.branch}
                    </span>
                  )}
                  {manifest.mod_loader && (
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded">
                      {manifest.mod_loader.type}
                    </span>
                  )}
                </div>
              </div>

              {/* New Profile Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {t('profiles.import.newProfileName', 'New Profile Name')}
                </label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder={manifest.profile.display_name}
                />
              </div>

              {/* MOD List */}
              {manifest.mods.length > 0 && (
                <div>
                  <h4 className="text-sm text-gray-400 mb-2 flex items-center space-x-2">
                    <Package className="w-4 h-4" />
                    <span>
                      {t('profiles.import.modsToInstall', 'MODs to install')} ({manifest.mods.length})
                    </span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-dark-700 rounded-lg p-2">
                    {manifest.mods.map((mod, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm p-2 bg-dark-600 rounded"
                      >
                        <span>{mod.name}</span>
                        <span className="text-gray-500 text-xs">
                          {mod.version} ({mod.source})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options Info */}
              {manifest.options.include_config && (
                <div className="text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 inline mr-1 text-green-400" />
                  {t('profiles.import.configIncluded', 'Config files will be restored')}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setStep('select');
                    setManifest(null);
                    setFilePath(null);
                  }}
                  className="btn-secondary px-4 py-2"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleImport}
                  className="btn-primary px-4 py-2 flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('profiles.import.import', 'Import')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              <p className="text-gray-400">
                {t('profiles.import.importing', 'Importing profile...')}
              </p>
              <p className="text-gray-500 text-sm">
                {t(
                  'profiles.import.importingDesc',
                  'Installing MOD loader and downloading MODs'
                )}
              </p>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-green-400">
                <CheckCircle className="w-6 h-6" />
                <span className="font-semibold">
                  {t('profiles.import.complete', 'Import Complete')}
                </span>
              </div>

              <div className="p-4 bg-dark-700 rounded-lg space-y-2">
                <p>
                  <span className="text-gray-400">{t('profiles.import.profileName', 'Profile')}:</span>{' '}
                  <span className="font-semibold">{importResult.profile_name}</span>
                </p>
                {importResult.resonite_installed && (
                  <p>
                    <span className="text-gray-400">{t('profiles.import.resonite', 'Resonite')}:</span>{' '}
                    <span className="text-purple-400">{importResult.resonite_installed}</span>
                  </p>
                )}
                {importResult.mod_loader_installed && (
                  <p>
                    <span className="text-gray-400">{t('profiles.import.modLoader', 'MOD Loader')}:</span>{' '}
                    <span className="text-blue-400">{importResult.mod_loader_installed}</span>
                  </p>
                )}
                {importResult.config_restored && (
                  <p className="text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    {t('profiles.import.configRestored', 'Config files restored')}
                  </p>
                )}
              </div>

              {/* MOD Results */}
              {importResult.mods.length > 0 && (
                <div>
                  <h4 className="text-sm text-gray-400 mb-2">
                    {t('profiles.import.modResults', 'MOD Installation Results')}
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-dark-700 rounded-lg p-2">
                    {importResult.mods.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm p-2 bg-dark-600 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          {getModStatusIcon(result)}
                          <span>{result.name}</span>
                          <span className="text-gray-500 text-xs">{result.version}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {getModStatusText(result)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <button onClick={handleClose} className="btn-primary px-4 py-2">
                  {t('common.close')}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
