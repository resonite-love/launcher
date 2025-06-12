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
                  ゲームアップデート
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
              <h4 className="text-white font-medium mb-2">プロファイル情報</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">プロファイル:</span>
                  <span className="text-white">{profileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ブランチ:</span>
                  <span className="text-white">{currentBranch}</span>
                </div>
                {currentVersion && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">現在のバージョン:</span>
                    <span className="text-white">v{currentVersion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* アップデート方法選択 */}
            <div className="space-y-4 mb-6">
              <h4 className="text-white font-medium">アップデート方法</h4>
              
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
                      <span className="text-white font-medium">最新版にアップデート</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {currentBranch}ブランチの最新バージョンにアップデートします
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
                      <span className="text-white font-medium">特定バージョンを指定</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      マニフェストIDを指定してアップグレード/ダウングレードします
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
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      マニフェストID
                    </label>
                    <input
                      type="text"
                      value={manifestId}
                      onChange={(e) => setManifestId(e.target.value)}
                      placeholder="例: 1234567890123456789"
                      className="input-primary w-full"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-blue-400 font-medium mb-1">マニフェストIDについて</p>
                        <ul className="text-blue-200 space-y-1">
                          <li>• SteamDBなどで特定のバージョンのIDを確認できます</li>
                          <li>• 古いバージョンへのダウングレードも可能です</li>
                          <li>• 無効なIDの場合はエラーになります</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 警告 */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium mb-1">注意事項</p>
                  <ul className="text-yellow-200 space-y-1">
                    <li>• アップデート中はゲームを起動しないでください</li>
                    <li>• ダウングレード時は互換性の問題が発生する可能性があります</li>
                    <li>• プロファイルデータのバックアップを推奨します</li>
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
                キャンセル
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
                  {updateType === 'latest' ? 'アップデート' : '適用'}
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