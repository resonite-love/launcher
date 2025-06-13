import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  X, 
  Info,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import GameVersionSelector from './GameVersionSelector';

interface GameInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (branch: string, manifestId?: string) => void;
  profileName: string;
  isLoading?: boolean;
}

function GameInstallModal({ 
  isOpen, 
  onClose, 
  onInstall, 
  profileName,
  isLoading = false
}: GameInstallModalProps) {
  const [branch, setBranch] = useState<'release' | 'prerelease'>('release');
  const [manifestId, setManifestId] = useState<string | null>(null);

  const handleInstall = () => {
    onInstall(branch, manifestId || undefined);
  };

  const resetForm = () => {
    setBranch('release');
    setManifestId(null);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onClose();
    }
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
                <Download className="w-6 h-6 text-resonite-blue" />
                <h3 className="text-xl font-bold text-white">
                  Resoniteインストール
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
              <h4 className="text-white font-medium mb-2">インストール先プロファイル</h4>
              <p className="text-white">{profileName}</p>
            </div>

            {/* インストール設定 */}
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-white font-medium mb-3">ブランチ選択</h4>
                <div className="flex space-x-3">
                  <label className="flex-1">
                    <input
                      type="radio"
                      value="release"
                      checked={branch === 'release'}
                      onChange={(e) => setBranch(e.target.value as 'release')}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      branch === 'release'
                        ? 'border-resonite-blue bg-resonite-blue/20'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}>
                      <div className="font-medium text-white mb-1">リリース版</div>
                      <div className="text-sm text-gray-400">安定版（推奨）</div>
                    </div>
                  </label>
                  
                  <label className="flex-1">
                    <input
                      type="radio"
                      value="prerelease"
                      checked={branch === 'prerelease'}
                      onChange={(e) => setBranch(e.target.value as 'prerelease')}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      branch === 'prerelease'
                        ? 'border-resonite-blue bg-resonite-blue/20'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}>
                      <div className="font-medium text-white mb-1">プレリリース版</div>
                      <div className="text-sm text-gray-400">開発版</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* バージョン選択 */}
              <GameVersionSelector
                branch={branch}
                selectedVersion={manifestId}
                onVersionSelect={setManifestId}
                disabled={isLoading}
              />
            </div>

            {/* 情報 */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium mb-1">インストールについて</p>
                  <ul className="text-blue-200 space-y-1">
                    <li>• インストールには時間がかかる場合があります</li>
                    <li>• Steamアカウントが必要な場合があります</li>
                    <li>• インストール後、MODローダーも追加できます</li>
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
                onClick={handleInstall}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>インストール開始</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GameInstallModal;