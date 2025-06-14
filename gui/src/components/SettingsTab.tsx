import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Check, 
  AlertCircle,
  Key,
  Edit3,
  Trash2,
  Loader2,
  X,
  Download,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppUpdate, type AppUpdateInfo, type UpdateAsset } from '../hooks/useQueries';
import { shell } from '@tauri-apps/api';

interface SteamCredentials {
  username: string;
  password: string;
}

function SettingsTab() {
  const [isLoading, setIsLoading] = useState(false);
  
  // Steamクレデンシャル管理用の状態
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');
  
  // アップデートチェック
  const { data: updateInfo, isLoading: updateLoading, refetch: checkUpdate } = useAppUpdate();

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Steamクレデンシャル関連の関数
  const loadSavedCredentials = async () => {
    try {
      const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
      setSavedCredentials(credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  const openCredentialsModal = () => {
    setCredentialsUsername(savedCredentials?.username || '');
    setCredentialsPassword(savedCredentials?.password || '');
    setShowCredentialsModal(true);
  };

  const closeCredentialsModal = () => {
    setShowCredentialsModal(false);
    setCredentialsUsername('');
    setCredentialsPassword('');
  };

  const saveCredentials = async () => {
    if (!credentialsUsername.trim()) {
      toast.error('Steamユーザー名を入力してください');
      return;
    }

    try {
      setIsLoading(true);
      const credentials: SteamCredentials = {
        username: credentialsUsername.trim(),
        password: credentialsPassword,
      };

      await invoke<string>('save_steam_credentials', { credentials });
      toast.success('Steamクレデンシャルが保存されました');
      setSavedCredentials(credentials);
      closeCredentialsModal();
    } catch (err) {
      toast.error(`クレデンシャルの保存に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCredentials = async () => {
    try {
      setIsLoading(true);
      await invoke<string>('clear_steam_credentials');
      toast.success('Steamクレデンシャルが削除されました');
      setSavedCredentials(null);
    } catch (err) {
      toast.error(`クレデンシャルの削除に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-4 h-full overflow-y-scroll">
      {/* Steam Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Key className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">Steam設定</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
          <div className="flex items-center space-x-3">
            {savedCredentials ? (
              <>
                <Check className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-white font-medium">
                    ユーザー名: {savedCredentials.username}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Steamクレデンシャルが設定されています
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-white font-medium">Steam設定が必要</p>
                  <p className="text-gray-400 text-sm">
                    ゲームのインストール・更新にはSteamアカウントが必要です
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary flex items-center space-x-2"
              onClick={openCredentialsModal}
              disabled={isLoading}
            >
              <Edit3 className="w-4 h-4" />
              <span>{savedCredentials ? '編集' : '設定'}</span>
            </motion.button>
            
            {savedCredentials && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-danger flex items-center space-x-2"
                onClick={clearCredentials}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
                <span>削除</span>
              </motion.button>
            )}
          </div>
        </div>

        <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">💡 Steam設定について</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Steamアカウントはゲームのダウンロードに必要です</li>
            <li>• 認証情報はローカルに暗号化して保存されます</li>
            <li>• 2段階認証が有効な場合、初回ログイン時に認証コードが必要です</li>
            <li>• パスワードは空欄でも保存可能（手動認証時に入力）</li>
          </ul>
        </div>
      </motion.div>

      {/* Application Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">アプリケーション設定</h2>
        </div>

        {/* アップデート情報 */}
        {updateLoading ? (
          <div className="bg-dark-800/30 rounded-lg p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-resonite-blue mr-3" />
            <span className="text-gray-300">アップデート情報を確認中...</span>
          </div>
        ) : updateInfo ? (
          <div className="space-y-4">
            {updateInfo.update_available ? (
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Download className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        新しいバージョンが利用可能です！
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400">現在のバージョン:</span>
                          <span className="font-mono text-gray-300">v{updateInfo.current_version}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400">最新バージョン:</span>
                          <span className="font-mono text-green-400">v{updateInfo.latest_version}</span>
                        </div>
                      </div>
                      
                      {/* リリースノート */}
                      {updateInfo.release_notes && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">変更内容:</h4>
                          <div className="bg-dark-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                              {updateInfo.release_notes}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* ダウンロードアセット */}
                      {updateInfo.assets && updateInfo.assets.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">ダウンロード:</h4>
                          <div className="space-y-2">
                            {updateInfo.assets.map((asset, index) => (
                              <motion.button
                                key={index}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition-colors"
                                onClick={() => shell.open(asset.download_url)}
                              >
                                <div className="flex items-center space-x-3">
                                  <Download className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-300">{asset.name}</span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {(asset.size / 1024 / 1024).toFixed(1)} MB
                                </span>
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn-primary flex items-center space-x-2"
                    onClick={() => shell.open(updateInfo.download_url)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>リリースページ</span>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="bg-dark-800/30 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-white font-medium">最新版を使用しています</p>
                      <p className="text-gray-400 text-sm">
                        現在のバージョン: v{updateInfo.current_version}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-secondary flex items-center space-x-2"
                    onClick={() => checkUpdate()}
                    disabled={updateLoading}
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>再チェック</span>
                  </motion.button>
                </div>
              </div>
            )}
            
            {/* アップデート情報のフッター */}
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span>
                最終チェック: {new Date().toLocaleString('ja-JP')}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-400">アップデート情報を取得できませんでした</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center space-x-2"
                onClick={() => checkUpdate()}
                disabled={updateLoading}
              >
                <RefreshCw className="w-4 h-4" />
                <span>再試行</span>
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Steam Credentials Modal */}
      {showCredentialsModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeCredentialsModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Key className="w-6 h-6 text-resonite-blue" />
                <h3 className="text-xl font-bold text-white">
                  Steamクレデンシャル設定
                </h3>
              </div>
              <button
                onClick={closeCredentialsModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-dark-800/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                🔒 認証情報はローカルに暗号化保存され、ゲームのインストール・更新時に自動使用されます
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Steamユーザー名 *
                </label>
                <input
                  type="text"
                  value={credentialsUsername}
                  onChange={(e) => setCredentialsUsername(e.target.value)}
                  placeholder="Steamユーザー名"
                  className="input-primary w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Steamパスワード
                </label>
                <input
                  type="password"
                  value={credentialsPassword}
                  onChange={(e) => setCredentialsPassword(e.target.value)}
                  placeholder="Steamパスワード"
                  className="input-primary w-full"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={closeCredentialsModal}
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
                onClick={saveCredentials}
                disabled={isLoading || !credentialsUsername.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>保存</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default SettingsTab;