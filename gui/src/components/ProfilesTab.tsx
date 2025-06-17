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
import ProfileEditModal from './ProfileEditModal';
import ProfileEditPage from './ProfileEditPage';
import ModRiskWarningModal from './ModRiskWarningModal';
import GameUpdateModal from './GameUpdateModal';
import GameVersionSelector from './GameVersionSelector';
import { useAppStore } from '../store/useAppStore';
import { useProfiles, useCreateProfile } from '../hooks/useQueries';
import { BranchInfo } from './ProfileEditPage';

interface ProfileInfo {
  id: string;
  display_name: string;
  name?: string; // 互換性のため
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
  has_mod_loader: boolean;
  mod_loader_type?: 'ResoniteModLoader' | 'MonkeyLoader';
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

interface ProfileConfig {
  name: string;
  description: string;
  args: string[];
}

function ProfilesTab() {
  const { 
    profilesPage, 
    editingProfileName, 
    navigateToProfileEdit, 
    navigateToProfileList,
    isProfileInstalling
  } = useAppStore();
  
  // React Query hooks
  const { data: profiles = [], isLoading: profilesLoading, refetch: refetchProfiles } = useProfiles();
  const createProfileMutation = useCreateProfile();
  
  // ローカルローディング状態（ゲームインストールなど）
  const [isLoading, setIsLoading] = useState(false);
  
  // プロファイル作成モーダル用の状態
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [createWithGame, setCreateWithGame] = useState(false);
  const [createGameBranch, setCreateGameBranch] = useState('release');
  const [createManifestId, setCreateManifestId] = useState('');
  const [createWithModLoader, setCreateWithModLoader] = useState(false);
  const [createModLoaderType, setCreateModLoaderType] = useState<'ResoniteModLoader' | 'MonkeyLoader'>('ResoniteModLoader');
  
  // ゲームインストール用の状態
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [installBranch, setInstallBranch] = useState('release');
  const [manifestId, setManifestId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Steamクレデンシャル管理用の状態
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  
  // プロファイル編集用の状態
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileConfig | null>(null);
  
  // MODリスク警告モーダル用の状態
  const [showModRiskModal, setShowModRiskModal] = useState(false);
  const [pendingProfileData, setPendingProfileData] = useState<{
    name: string;
    description: string;
    withGame: boolean;
    branch: string;
    manifestId: string;
    withModLoader: boolean;
    modLoaderType: 'ResoniteModLoader' | 'MonkeyLoader';
  } | null>(null);
  
  // ゲームアップデートモーダル用の状態
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdateProfile, setSelectedUpdateProfile] = useState<ProfileInfo | null>(null);
  
  // バージョン情報管理
  const [gameVersions, setGameVersions] = useState<BranchInfo>({});
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
    loadGameVersions();

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
        refetchProfiles(); // React Query を使用
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
  }, [refetchProfiles]);

  
  const loadGameVersions = async () => {
    try {
      setLoadingVersions(true);
      const versions = await invoke<any>('get_game_versions');
      setGameVersions(versions);
    } catch (err) {
      console.error('Failed to load game versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const openCreateProfileModal = () => {
    setNewProfileName('');
    setNewProfileDescription('');
    setCreateWithGame(false);
    setCreateGameBranch('release');
    setCreateManifestId('');
    setCreateWithModLoader(false);
    setCreateModLoaderType('ResoniteModLoader');
    setShowCreateProfileModal(true);
  };

  const closeCreateProfileModal = () => {
    setShowCreateProfileModal(false);
    setNewProfileName('');
    setNewProfileDescription('');
    setCreateWithGame(false);
    setCreateGameBranch('release');
    setCreateManifestId('');
    setCreateWithModLoader(false);
    setCreateModLoaderType('ResoniteModLoader');
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error('プロファイル名を入力してください');
      return;
    }

    // MODローダーをインストールする場合は警告モーダルを表示
    if (createWithGame && createWithModLoader) {
      setPendingProfileData({
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
        withGame: createWithGame,
        branch: createGameBranch,
        manifestId: createManifestId,
        withModLoader: createWithModLoader,
        modLoaderType: createModLoaderType
      });
      setShowModRiskModal(true);
      return;
    }

    // MODローダーなしの場合は直接作成
    await executeProfileCreation({
      name: newProfileName.trim(),
      description: newProfileDescription.trim(),
      withGame: createWithGame,
      branch: createGameBranch,
      manifestId: createManifestId,
      withModLoader: false,
      modLoaderType: createModLoaderType
    });
  };

  const executeProfileCreation = async (
    profileData: {
      name: string;
      description: string;
      withGame: boolean;
      branch: string;
      manifestId: string;
      withModLoader: boolean;
      modLoaderType: 'ResoniteModLoader' | 'MonkeyLoader';
    }
  ) => {
    try {
      setIsLoading(true);
      
      // React Queryのミューテーションを使用してプロファイルを作成
      await createProfileMutation.mutateAsync({
        name: profileData.name,
        description: profileData.description,
      });
      
      // ゲームもインストールする場合
      if (profileData.withGame) {
        const request: GameInstallRequest = {
          profile_name: profileData.name,
          branch: profileData.branch,
          manifest_id: profileData.manifestId || undefined,
          username: savedCredentials?.username || undefined,
          password: savedCredentials?.password || undefined,
        };

        try {
          const installResult = await invoke<string>('install_game_to_profile_interactive', { request });
          toast.success(installResult);
          
          // MODローダーもインストールする場合
          if (profileData.withModLoader) {
            try {
              const modLoaderResult = await invoke<string>('install_mod_loader', { 
                profileName: profileData.name,
                loaderType: profileData.modLoaderType
              });
              toast.success(modLoaderResult);
            } catch (modErr) {
              toast.error(`MODローダーのインストールに失敗しました: ${modErr}`);
            }
          }
        } catch (installErr) {
          toast.error(`ゲームのインストールに失敗しました: ${installErr}`);
        }
      }
      
      closeCreateProfileModal();
    } catch (err) {
      toast.error(`プロファイルの作成に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModRiskConfirm = async () => {
    setShowModRiskModal(false);
    if (pendingProfileData) {
      await executeProfileCreation(pendingProfileData);
      setPendingProfileData(null);
    }
  };

  const handleModRiskCancel = () => {
    setShowModRiskModal(false);
    setPendingProfileData(null);
  };
  
  // 新しいバージョンが利用可能かチェック
  const hasNewerVersion = (profile: ProfileInfo): boolean => {
    if (!gameVersions || !profile.has_game || !profile.branch) {
      return false;
    }
    
    const branchVersions = gameVersions[profile.branch];
    if (!branchVersions || branchVersions.length === 0) {
      return false;
    }
    
    // 特定のマニフェストIDが指定されている場合はマニフェストIDで比較
    if (profile.manifest_id) {
      const latestVersion = branchVersions[0];
      return latestVersion && latestVersion.manifestId !== profile.manifest_id;
    }
    
    if (!profile.version) {
      return false;
    }
    
    // プロファイルの現在のバージョンに対応するエントリを探す
    const currentVersionEntry = branchVersions.find(v => v.gameVersion === profile.version);
    if (!currentVersionEntry) {
      // 現在のバージョンが見つからない場合は更新なしと判断（古すぎるか無効）
      return false;
    }
    
    // タイムスタンプでソートして最新のバージョンを取得
    const sortedVersions = [...branchVersions].sort((a, b) => {
      const timestampA = new Date(a.timestamp).getTime();
      const timestampB = new Date(b.timestamp).getTime();
      return timestampB - timestampA; // 降順（新しい順）
    });
    
    const latestVersion = sortedVersions[0];
    if (!latestVersion) {
      return false;
    }
    
    // 現在のバージョンが最新バージョンと同じ場合は更新なし
    if (currentVersionEntry.manifestId === latestVersion.manifestId) {
      return false;
    }
    
    // タイムスタンプで比較
    const currentTimestamp = new Date(currentVersionEntry.timestamp).getTime();
    const latestTimestamp = new Date(latestVersion.timestamp).getTime();
    
    return latestTimestamp > currentTimestamp;
  };
  
  // 最新バージョン情報を取得
  const getLatestVersionInfo = (profile: ProfileInfo) => {
    if (!gameVersions || !profile.branch) {
      return null;
    }
    
    const branchVersions = gameVersions[profile.branch];
    if (!branchVersions || branchVersions.length === 0) {
      return null;
    }
    
    // タイムスタンプでソートして最新のバージョンを取得
    const sortedVersions = [...branchVersions].sort((a, b) => {
      const timestampA = new Date(a.timestamp).getTime();
      const timestampB = new Date(b.timestamp).getTime();
      return timestampB - timestampA; // 降順（新しい順）
    });
    
    return sortedVersions[0];
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

  const openUpdateModal = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile || !profile.has_game) return;
    
    setSelectedUpdateProfile(profile);
    setShowUpdateModal(true);
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedUpdateProfile(null);
  };

  const updateGame = async (manifestId?: string) => {
    if (!selectedUpdateProfile) return;

    try {
      setIsLoading(true);
      const request: GameInstallRequest = {
        profile_name: selectedUpdateProfile.id,
        branch: selectedUpdateProfile.branch || 'release',
        manifest_id: manifestId || selectedUpdateProfile.manifest_id,
        username: savedCredentials?.username || undefined,
        password: savedCredentials?.password || undefined,
      };

      const result = await invoke<string>('update_profile_game_interactive', { request });
      toast.success(result);
      closeUpdateModal();
      await refetchProfiles(); // プロファイル一覧を更新
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

  // プロファイル編集関連の関数
  const openEditModal = async (profileName: string) => {
    try {
      setIsLoading(true);
      const profile = await invoke<ProfileConfig>('get_profile_config', { profileName });
      setEditingProfile(profile);
      setShowEditModal(true);
    } catch (err) {
      toast.error(`プロファイル設定の取得に失敗しました: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingProfile(null);
  };

  const saveProfile = async (config: ProfileConfig) => {
    try {
      const result = await invoke<string>('update_profile_config', { profile: config });
      toast.success(result);
      await refetchProfiles();
    } catch (err) {
      toast.error(`プロファイルの更新に失敗しました: ${err}`);
      throw err;
    }
  };

  // プロファイル編集ページの表示
  if (profilesPage === 'edit' && editingProfileName) {
    return (
      <ProfileEditPage
        profileName={editingProfileName}
        onBack={navigateToProfileList}
      />
    );
  }

  return (
    <div className="space-y-8 p-4 h-full overflow-y-scroll"> { /*  scrollbar-hide */ }


      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center space-x-3">
          <User className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">プロファイル一覧</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center space-x-2"
            onClick={openCreateProfileModal}
          >
            <Plus className="w-4 h-4" />
            <span>新規作成</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center space-x-2"
            onClick={() => refetchProfiles()}
            disabled={profilesLoading}
          >
            <RefreshCw className={`w-4 h-4 ${profilesLoading ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-12"
        >
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">プロファイルがありません</p>
          <p className="text-gray-500">新規作成してください</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6 hover:border-resonite-blue/30 transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {profile.display_name}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {profile.description || '説明なし'}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {profile.has_game ? (
                    <span className="status-success">
                      ✓ インストール済
                    </span>
                  ) : (
                    <span className="status-error">
                      未インストール
                    </span>
                  )}
                  
                  {profile.has_game && hasNewerVersion(profile) && (
                    <span className="status-info text-xs flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                      <span>更新可能</span>
                    </span>
                  )}
                  
                  {profile.has_game && profile.has_mod_loader && (
                    <span 
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        profile.mod_loader_type === 'MonkeyLoader' 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}
                      title={profile.mod_loader_type === 'MonkeyLoader' ? 'MonkeyLoader' : 'Resonite Mod Loader'}
                    >
                      {profile.mod_loader_type === 'MonkeyLoader' ? 'ML' : 'RML'}
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
                      <div className="flex items-center space-x-2">
                        <span className="text-white">v{profile.version}</span>
                        {hasNewerVersion(profile) && (() => {
                          const latestVersion = getLatestVersionInfo(profile);
                          return latestVersion && (
                            <span className="text-blue-300 text-xs">
                              → v{latestVersion.gameVersion}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {hasNewerVersion(profile) && (
                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                        <span className="text-blue-300">
                          新しいバージョンが利用可能です
                        </span>
                      </div>
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
                      className={`btn-primary flex-1 flex items-center justify-center space-x-2 ${
                        isProfileInstalling(profile.id) ? 'opacity-50' : ''
                      }`}
                      onClick={() => launchProfile(profile.id)}
                      disabled={isLoading || isProfileInstalling(profile.id)}
                    >
                      {isProfileInstalling(profile.id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>インストール中</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>起動</span>
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center space-x-2 ${
                        hasNewerVersion(profile)
                          ? 'btn-primary border-blue-500/50 shadow-blue-500/20'
                          : 'btn-secondary'
                      } ${isProfileInstalling(profile.id) ? 'opacity-50' : ''}`}
                      onClick={() => openUpdateModal(profile.id)}
                      disabled={isLoading || isProfileInstalling(profile.id)}
                      title={isProfileInstalling(profile.id) 
                        ? 'インストール中です' 
                        : hasNewerVersion(profile) 
                          ? '新しいバージョンが利用可能です' 
                          : 'ゲームを最新版に更新'
                      }
                    >
                      {isProfileInstalling(profile.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className={`w-4 h-4 ${hasNewerVersion(profile) ? 'text-white' : ''}`} />
                      )}
                      <span>{isProfileInstalling(profile.id) ? 'インストール中' : '更新'}</span>
                      {hasNewerVersion(profile) && !isProfileInstalling(profile.id) && (
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      )}
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`btn-primary flex-1 flex items-center justify-center space-x-2 ${
                      isProfileInstalling(profile.id) ? 'opacity-50' : ''
                    }`}
                    onClick={() => openInstallModal(profile.id)}
                    disabled={isLoading || isProfileInstalling(profile.id)}
                  >
                    {isProfileInstalling(profile.id) ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>インストール中</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>ゲームをインストール</span>
                      </>
                    )}
                  </motion.button>
                )}
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-secondary flex items-center space-x-2"
                  onClick={() => navigateToProfileEdit(profile.id)}
                  disabled={isLoading}
                  title="プロファイル設定を編集"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>編集</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

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

                <GameVersionSelector
                  branch={installBranch}
                  selectedVersion={manifestId || null}
                  onVersionSelect={(version) => setManifestId(version || '')}
                  disabled={isLoading}
                />

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


      {/* Create Profile Modal */}
      <AnimatePresence>
        {showCreateProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeCreateProfileModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <Plus className="w-6 h-6 text-resonite-blue" />
                  <h3 className="text-xl font-bold text-white">
                    新規プロファイル作成
                  </h3>
                </div>
                <button
                  onClick={closeCreateProfileModal}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
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

                <div className="border-t border-dark-600 pt-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <input
                      type="checkbox"
                      id="createWithGame"
                      checked={createWithGame}
                      onChange={(e) => setCreateWithGame(e.target.checked)}
                      className="w-4 h-4 text-resonite-blue bg-dark-800 border-dark-600 rounded focus:ring-resonite-blue focus:ring-2"
                    />
                    <label htmlFor="createWithGame" className="text-white font-medium">
                      ゲームも同時にインストールする
                    </label>
                  </div>

                  {createWithGame && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 ml-7"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          ブランチ
                        </label>
                        <div className="flex space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              value="release"
                              checked={createGameBranch === 'release'}
                              onChange={(e) => setCreateGameBranch(e.target.value)}
                              className="text-resonite-blue"
                            />
                            <span className="text-white">リリース版</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              value="prerelease"
                              checked={createGameBranch === 'prerelease'}
                              onChange={(e) => setCreateGameBranch(e.target.value)}
                              className="text-resonite-blue"
                            />
                            <span className="text-white">プレリリース版</span>
                          </label>
                        </div>
                      </div>

                      <GameVersionSelector
                        branch={createGameBranch}
                        selectedVersion={createManifestId || null}
                        onVersionSelect={(version) => setCreateManifestId(version || '')}
                        disabled={isLoading}
                      />

                      <div>
                        <div className="space-y-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="createWithModLoader"
                              checked={createWithModLoader}
                              onChange={(e) => setCreateWithModLoader(e.target.checked)}
                              className="w-4 h-4 text-resonite-blue bg-dark-800 border-dark-600 rounded focus:ring-resonite-blue focus:ring-2"
                            />
                            <label htmlFor="createWithModLoader" className="text-white font-medium">
                              MODローダーもインストールする
                            </label>
                          </div>
                          
                          {createWithModLoader && (
                            <div className="ml-7 space-y-3">
                              <div className="flex space-x-4">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="createModLoaderType"
                                    value="ResoniteModLoader"
                                    checked={createModLoaderType === 'ResoniteModLoader'}
                                    onChange={(e) => setCreateModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader')}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-gray-300">Resonite Mod Loader (RML)</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="createModLoaderType"
                                    value="MonkeyLoader"
                                    checked={createModLoaderType === 'MonkeyLoader'}
                                    onChange={(e) => setCreateModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader')}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-gray-300">MonkeyLoader</span>
                                </label>
                              </div>
                              
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                <p className="text-sm text-blue-400">
                                  📝 {createModLoaderType === 'MonkeyLoader' 
                                    ? 'MonkeyLoaderがゲームと同時にインストールされ、MODを使用できるようになります。' 
                                    : 'ResoniteModLoaderがゲームと同時にインストールされ、MODを使用できるようになります。'}
                                </p>
                                <p className="text-xs text-blue-300 mt-1">
                                  {createModLoaderType === 'MonkeyLoader' 
                                    ? 'MonkeyLoaderは新しいMODローダーで、より高度な機能を提供します。' 
                                    : 'RMLは従来のMODローダーで、多くのMODが対応しています。'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {!savedCredentials && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                          <p className="text-sm text-yellow-400">
                            ⚠️ Steamクレデンシャルが設定されていません。ゲームのインストールが失敗する可能性があります。
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  className="btn-secondary flex-1"
                  onClick={closeCreateProfileModal}
                  disabled={createProfileMutation.isPending || isLoading}
                >
                  キャンセル
                </button>
                <button
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  onClick={createProfile}
                  disabled={createProfileMutation.isPending || isLoading || !newProfileName.trim()}
                >
                  {(createProfileMutation.isPending || isLoading) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    {(createProfileMutation.isPending || isLoading) ? (
                      createWithGame && createWithModLoader 
                        ? 'インストール中...'
                        : createWithGame 
                        ? 'インストール中...' 
                        : '作成中...'
                    ) : (
                      createWithGame && createWithModLoader 
                        ? `プロファイル作成＆ゲーム＆${createModLoaderType === 'MonkeyLoader' ? 'MonkeyLoader' : 'RML'}インストール`
                        : createWithGame 
                        ? 'プロファイル作成＆ゲームインストール' 
                        : 'プロファイル作成'
                    )}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={showEditModal}
        profile={editingProfile}
        onClose={closeEditModal}
        onSave={saveProfile}
      />
      
      {/* MOD Risk Warning Modal */}
      <ModRiskWarningModal
        isOpen={showModRiskModal}
        onClose={handleModRiskCancel}
        onConfirm={handleModRiskConfirm}
        title={`${pendingProfileData?.modLoaderType === 'MonkeyLoader' ? 'MonkeyLoader' : 'ResoniteModLoader'}付きプロファイル作成`}
      />
      
      {/* Game Update Modal */}
      <GameUpdateModal
        isOpen={showUpdateModal}
        onClose={closeUpdateModal}
        onUpdate={updateGame}
        profileName={selectedUpdateProfile?.display_name || ''}
        currentVersion={selectedUpdateProfile?.version}
        currentBranch={selectedUpdateProfile?.branch}
        isLoading={isLoading}
      />
    </div>
  );
}

export default ProfilesTab;