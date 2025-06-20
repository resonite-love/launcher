import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  X, 
  Download,
  ArrowUp,
  ArrowDown,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GameVersionSelector from './GameVersionSelector';

interface GameUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (manifestId?: string) => void;
  profileName: string;
  currentVersion?: string;
  currentBranch?: string;
  isLoading?: boolean;
}

function GameUpdateModal({ 
  isOpen, 
  onClose, 
  onUpdate, 
  profileName,
  currentVersion,
  currentBranch = 'release',
  isLoading = false
}: GameUpdateModalProps) {
  const { t } = useTranslation();
  const [updateType, setUpdateType] = useState<'latest' | 'specific'>('latest');
  const [manifestId, setManifestId] = useState('');

  const handleUpdate = () => {
    if (updateType === 'latest') {
      onUpdate();
    } else {
      if (!manifestId.trim()) {
        return;
      }
      onUpdate(manifestId.trim());
    }
  };

  const resetForm = () => {
    setUpdateType('latest');
    setManifestId('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-6 h-6 text-resonite-blue" />
                <h3 className="text-xl font-bold text-white">
                  {t('profiles.updateModal.title')}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* プロファイル情報 */}
            <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-4 mb-6">
              <h4 className="text-white font-medium mb-2">{t('profiles.updateModal.profileInfo')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('profiles.updateModal.profileLabel')}</span>
                  <span className="text-white">{profileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('profiles.updateModal.branchLabel')}</span>
                  <span className="text-white">{currentBranch}</span>
                </div>
                {currentVersion && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('profiles.updateModal.currentVersion')}</span>
                    <span className="text-white">v{currentVersion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* アップデート方法選択 */}
            <div className="space-y-4 mb-6">
              <h4 className="text-white font-medium">{t('profiles.updateModal.updateMethod')}</h4>
              
              <div className="space-y-3">
                {/* 最新版にアップデート */}
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    value="latest"
                    checked={updateType === 'latest'}
                    onChange={(e) => setUpdateType(e.target.value as 'latest')}
                    className="mt-1 w-4 h-4 text-resonite-blue bg-dark-800 border-dark-600 focus:ring-resonite-blue focus:ring-2"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <ArrowUp className="w-4 h-4 text-green-400" />
                      <span className="text-white font-medium">{t('profiles.updateModal.latestVersion')}</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {t('profiles.updateModal.latestVersionDescription', { branch: currentBranch })}
                    </p>
                  </div>
                </label>

                {/* 特定バージョンを指定 */}
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    value="specific"
                    checked={updateType === 'specific'}
                    onChange={(e) => setUpdateType(e.target.value as 'specific')}
                    className="mt-1 w-4 h-4 text-resonite-blue bg-dark-800 border-dark-600 focus:ring-resonite-blue focus:ring-2"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <ArrowDown className="w-4 h-4 text-yellow-400" />
                      <span className="text-white font-medium">{t('profiles.updateModal.specificVersion')}</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {t('profiles.updateModal.specificVersionDescription')}
                    </p>
                  </div>
                </label>
              </div>

              {/* マニフェストID入力 */}
              {updateType === 'specific' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="ml-7 space-y-3"
                >
                  <GameVersionSelector
                    branch={currentBranch}
                    selectedVersion={manifestId || null}
                    onVersionSelect={(version) => setManifestId(version || '')}
                    disabled={isLoading}
                  />
                </motion.div>
              )}
            </div>

            {/* 警告 */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium mb-1">{t('profiles.updateModal.notes.title')}</p>
                  <ul className="text-yellow-200 space-y-1">
                    <li>{t('profiles.updateModal.notes.noLaunch')}</li>
                    <li>{t('profiles.updateModal.notes.compatibility')}</li>
                    <li>{t('profiles.updateModal.notes.backup')}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex-1"
                onClick={handleClose}
                disabled={isLoading}
              >
                {t('common.cancel')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
                onClick={handleUpdate}
                disabled={isLoading || (updateType === 'specific' && !manifestId.trim())}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {updateType === 'latest' ? t('profiles.updateModal.updateButton') : t('common.apply')}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GameUpdateModal;