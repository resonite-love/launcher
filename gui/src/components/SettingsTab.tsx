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
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

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

      {/* Application Settings Section (Future expansion) */}
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

        <div className="bg-dark-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-center">
            今後、アプリケーションの設定項目がここに追加される予定です
          </p>
        </div>
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