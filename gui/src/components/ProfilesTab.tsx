import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Play, 
  Download, 
  RefreshCw, 
  Settings, 
  X, 
  Check, 
  AlertCircle,
  User,
  Key,
  Edit3,
  Trash2,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileInfo {
  name: string;
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
}

interface GameInstallRequest {
  profile_name: string;
  branch: string;
  manifest_id?: string;
  username?: string;
  password?: string;
}

interface SteamCredentials {
  username: string;
  password: string;
}

function ProfilesTab() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // ゲームインストール用の状態
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [installBranch, setInstallBranch] = useState('release');
  const [manifestId, setManifestId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Steamクレデンシャル管理用の状態
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');

  useEffect(() => {
    loadProfiles();
    loadSavedCredentials();

    // インストール完了イベントをリッスン
    const unlistenCompleted = listen('installation-completed', (event) => {
      const data = event.payload as {
        profile_name: string;
        branch: string;
        success: boolean;
        message: string;
      };
      
      if (data.success) {
        toast.success(data.message);
        loadProfiles();
      } else {
        toast.error(data.message);
      }
    });

    // インストールステータス更新イベントをリッスン
    const unlistenStatus = listen('installation-status', (event) => {
      const data = event.payload as {
        profile_name: string;
        branch: string;
        message: string;
        is_complete: boolean;
      };
      
      if (!data.is_complete) {
        toast.loading(data.message, { duration: 2000 });
      }
    });

    // クリーンアップ
    return () => {
      unlistenCompleted.then(f => f());
      unlistenStatus.then(f => f());
    };
  }, []);

  const loadProfiles = async () => {
    try {
      const profileList = await invoke<ProfileInfo[]>('get_profiles');
      setProfiles(profileList);
    } catch (err) {
      toast.error(`プロファイルの取得に失敗しました: ${err}`);
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error('プロファイル名を入力してください');
      return;
    }

    try {
      setIsLoading(true);
      const result = await invoke<string>('create_profile', {
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
      });
      
      toast.success(result);
      setNewProfileName('');
      setNewProfileDescription('');
      await loadProfiles();
    } catch (err) {
      toast.error(`プロファイルの作成に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const launchProfile = async (profileName: string) => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('launch_resonite', {
        profileName,
      });
      
      toast.success(result);
    } catch (err) {
      toast.error(`起動に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openInstallModal = (profileName: string) => {
    setSelectedProfile(profileName);
    setInstallBranch('release');
    setManifestId('');
    setUsername(savedCredentials?.username || '');
    setPassword(savedCredentials?.password || '');
    setShowInstallModal(true);
  };

  const closeInstallModal = () => {
    setShowInstallModal(false);
    setSelectedProfile('');
  };

  const installGame = async () => {
    if (!selectedProfile) return;

    try {
      setIsLoading(true);
      const request: GameInstallRequest = {
        profile_name: selectedProfile,
        branch: installBranch,
        manifest_id: manifestId || undefined,
        username: username || undefined,
        password: password || undefined,
      };

      const result = await invoke<string>('install_game_to_profile_interactive', { request });
      toast.success(result);
      closeInstallModal();
    } catch (err) {
      toast.error(`ゲームのインストールに失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateGame = async (profileName: string) => {
    const profile = profiles.find(p => p.name === profileName);
    if (!profile || !profile.has_game) return;

    try {
      setIsLoading(true);
      const request: GameInstallRequest = {
        profile_name: profileName,
        branch: profile.branch || 'release',
        manifest_id: profile.manifest_id,
        username: savedCredentials?.username || undefined,
        password: savedCredentials?.password || undefined,
      };

      const result = await invoke<string>('update_profile_game_interactive', { request });
      toast.success(result);
    } catch (err) {
      toast.error(`ゲームの更新に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="space-y-8">
      {/* Steam Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-6 h-6 text-resonite-blue" />
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
      </motion.div>

      {/* Create Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Plus className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">新規プロファイル作成</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              プロファイル名 *
            </label>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="例: メインプロファイル"
              className="input-primary w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              説明（オプション）
            </label>
            <input
              type="text"
              value={newProfileDescription}
              onChange={(e) => setNewProfileDescription(e.target.value)}
              placeholder="例: 日常使用のプロファイル"
              className="input-primary w-full"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center space-x-2"
            onClick={createProfile}
            disabled={isLoading || !newProfileName.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>プロファイルを作成</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Profiles List Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <User className="w-6 h-6 text-resonite-blue" />
            <h2 className="text-2xl font-bold text-white">プロファイル一覧</h2>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center space-x-2"
            onClick={loadProfiles}
          >
            <RefreshCw className="w-4 h-4" />
            <span>更新</span>
          </motion.button>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">プロファイルがありません</p>
            <p className="text-gray-500">新規作成してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6 hover:border-resonite-blue/30 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {profile.name}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {profile.description || '説明なし'}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {profile.has_game ? (
                      <span className="status-success">
                        ✓ ゲーム済
                      </span>
                    ) : (
                      <span className="status-error">
                        未インストール
                      </span>
                    )}
                  </div>
                </div>

                {profile.has_game && (
                  <div className="mb-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">ブランチ:</span>
                      <span className="text-white">{profile.branch}</span>
                    </div>
                    {profile.version && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">バージョン:</span>
                        <span className="text-white">v{profile.version}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex space-x-2">
                  {profile.has_game ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-primary flex-1 flex items-center justify-center space-x-2"
                        onClick={() => launchProfile(profile.name)}
                        disabled={isLoading}
                      >
                        <Play className="w-4 h-4" />
                        <span>起動</span>
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-secondary flex items-center space-x-2"
                        onClick={() => updateGame(profile.name)}
                        disabled={isLoading}
                        title="ゲームを最新版に更新"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>更新</span>
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary w-full flex items-center justify-center space-x-2"
                      onClick={() => openInstallModal(profile.name)}
                      disabled={isLoading}
                    >
                      <Download className="w-4 h-4" />
                      <span>ゲームをインストール</span>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Install Game Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeInstallModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  ゲームインストール
                </h3>
                <button
                  onClick={closeInstallModal}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    プロファイル: {selectedProfile}
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ブランチ
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="release"
                        checked={installBranch === 'release'}
                        onChange={(e) => setInstallBranch(e.target.value)}
                        className="text-resonite-blue"
                      />
                      <span className="text-white">リリース版</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="prerelease"
                        checked={installBranch === 'prerelease'}
                        onChange={(e) => setInstallBranch(e.target.value)}
                        className="text-resonite-blue"
                      />
                      <span className="text-white">プレリリース版</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    マニフェストID（オプション）
                  </label>
                  <input
                    type="text"
                    value={manifestId}
                    onChange={(e) => setManifestId(e.target.value)}
                    placeholder="特定バージョンを指定"
                    className="input-primary w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Steamユーザー名（オプション）
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Steamユーザー名"
                    className="input-primary w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Steamパスワード（オプション）
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Steamパスワード"
                    className="input-primary w-full"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  className="btn-secondary flex-1"
                  onClick={closeInstallModal}
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  onClick={installGame}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>インストール</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Steam Credentials Modal */}
      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
}

export default ProfilesTab;