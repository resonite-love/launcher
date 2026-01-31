import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Settings, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { useTranslation } from 'react-i18next';

interface ProfileExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
}

export default function ProfileExportModal({
  isOpen,
  onClose,
  profileId,
  profileName,
}: ProfileExportModalProps) {
  const { t } = useTranslation();
  const [includeConfig, setIncludeConfig] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);

    try {
      // ファイル保存ダイアログを開く
      const filePath = await save({
        defaultPath: `${profileName}.rlprofile`,
        filters: [
          {
            name: 'RESO Launcher Profile',
            extensions: ['rlprofile'],
          },
        ],
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      // エクスポート実行
      await invoke('export_profile', {
        profileId,
        outputPath: filePath,
        includeConfig,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-dark-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-dark-600"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Download className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold">
                {t('profiles.export.title', 'Export Profile')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Name */}
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-1">
              {t('profiles.export.profileToExport', 'Profile to export')}
            </p>
            <p className="text-lg font-semibold">{profileName}</p>
          </div>

          {/* Options */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-gray-300">
                {t('profiles.export.options', 'Export Options')}
              </span>
            </div>

            <label className="flex items-center space-x-3 cursor-pointer p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors">
              <input
                type="checkbox"
                checked={includeConfig}
                onChange={(e) => setIncludeConfig(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 bg-dark-800"
              />
              <div>
                <p className="text-sm font-medium">
                  {t('profiles.export.includeConfig', 'Include MOD config files')}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    'profiles.export.includeConfigDesc',
                    'Include BepInEx/config or MonkeyLoader settings'
                  )}
                </p>
              </div>
            </label>
          </div>

          {/* Info */}
          <div className="mb-6 p-3 bg-dark-700 rounded-lg text-sm text-gray-400">
            <p>
              {t(
                'profiles.export.info',
                'The export file will include your launch settings and MOD list. MODs from GitHub/Thunderstore will be downloaded automatically on import.'
              )}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-400 text-sm">
              {t('profiles.export.success', 'Profile exported successfully!')}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="btn-secondary px-4 py-2"
              disabled={isExporting}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleExport}
              className="btn-primary px-4 py-2 flex items-center space-x-2"
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('profiles.export.exporting', 'Exporting...')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{t('profiles.export.export', 'Export')}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
