import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Save,
  Settings,
  User,
  Terminal,
  Plus,
  Trash2,
  Loader2,
  Info,
  Package,
  FolderOpen,
  Download,
  ExternalLink,
  Search,
  Github
} from 'lucide-react';
import toast from 'react-hot-toast';
import ModRiskWarningModal from './ModRiskWarningModal';

interface ProfileConfig {
  id: string;
  display_name: string;
  name?: string; // 互換性のため
  description: string;
  args: string[];
}

interface ProfileEditPageProps {
  profileName: string;
  onBack: () => void;
}

interface ModInfo {
  name: string;
  description: string;
  category?: string;
  source_location: string;
  author: string;
  latest_version?: string;
  latest_download_url?: string;
  tags?: string[];
  flags?: string[];
}

interface InstalledMod {
  name: string;
  description: string;
  source_location: string;
  installed_version: string;
  installed_date: string;
  dll_path: string;
}

type TabType = 'info' | 'launch' | 'mods' | 'other';

function ProfileEditPage({ profileName, onBack }: ProfileEditPageProps) {
  const [profile, setProfile] = useState<ProfileConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  
  // フォーム状態
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [args, setArgs] = useState<string[]>([]);
  const [newArg, setNewArg] = useState('');
  
  // MODローダー用の状態
  const [modLoaderInfo, setModLoaderInfo] = useState<any>(null);
  const [isLoadingModLoader, setIsLoadingModLoader] = useState(false);
  const [showModRiskModal, setShowModRiskModal] = useState(false);
  
  // MOD管理用の状態
  const [availableMods, setAvailableMods] = useState<ModInfo[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [isInstallingMod, setIsInstallingMod] = useState<string | null>(null);

  const tabs = [
    { id: 'info' as TabType, label: 'プロファイル情報', icon: User },
    { id: 'launch' as TabType, label: '起動オプション', icon: Terminal },
    { id: 'mods' as TabType, label: 'MOD管理', icon: Package },
    { id: 'other' as TabType, label: 'その他', icon: Settings },
  ];

  useEffect(() => {
    loadProfile();
    loadModLoaderInfo();
    loadInstalledMods();
  }, [profileName]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const profileConfig = await invoke<ProfileConfig>('get_profile_config', { profileName });
      setProfile(profileConfig);
      setDisplayName(profileConfig.display_name);
      setDescription(profileConfig.description);
      setArgs([...profileConfig.args]);
    } catch (err) {
      toast.error(`プロファイル設定の取得に失敗しました: ${err}`);
      onBack();
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;

    try {
      setIsSaving(true);
      const updatedProfile: ProfileConfig = {
        ...profile,
        display_name: displayName,
        description,
        args: [...args]
      };

      await invoke<string>('update_profile_config', { profile: updatedProfile });
      toast.success('プロファイル設定を保存しました');
      setProfile(updatedProfile);
    } catch (err) {
      toast.error(`プロファイルの更新に失敗しました: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addArg = () => {
    if (!newArg.trim()) return;
    
    setArgs([...args, newArg.trim()]);
    setNewArg('');
  };

  const removeArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const updateArg = (index: number, value: string) => {
    const updatedArgs = [...args];
    updatedArgs[index] = value;
    setArgs(updatedArgs);
  };

  const loadModLoaderInfo = async () => {
    try {
      setIsLoadingModLoader(true);
      const info = await invoke<any>('get_mod_loader_status', { profileName });
      setModLoaderInfo(info);
    } catch (err) {
      console.error('Failed to load mod loader info:', err);
      setModLoaderInfo({ installed: false });
    } finally {
      setIsLoadingModLoader(false);
    }
  };

  const showModLoaderInstallWarning = () => {
    setShowModRiskModal(true);
  };

  const installModLoader = async () => {
    try {
      setIsLoadingModLoader(true);
      const result = await invoke<string>('install_mod_loader', { profileName });
      toast.success(result);
      await loadModLoaderInfo();
      await loadProfile(); // 起動引数が更新される可能性がある
    } catch (err) {
      toast.error(`MODローダーのインストールに失敗しました: ${err}`);
    } finally {
      setIsLoadingModLoader(false);
    }
  };

  const handleModRiskConfirm = async () => {
    setShowModRiskModal(false);
    await installModLoader();
  };

  const handleModRiskCancel = () => {
    setShowModRiskModal(false);
  };

  // MOD関連の関数
  const loadAvailableMods = async () => {
    try {
      setIsLoadingMods(true);
      const mods = await invoke<ModInfo[]>('fetch_mod_manifest', { profileName });
      setAvailableMods(mods);
    } catch (err) {
      toast.error(`MOD一覧の取得に失敗しました: ${err}`);
    } finally {
      setIsLoadingMods(false);
    }
  };

  const loadInstalledMods = async () => {
    try {
      const mods = await invoke<InstalledMod[]>('get_installed_mods', { profileName });
      setInstalledMods(mods);
    } catch (err) {
      console.error('Failed to load installed mods:', err);
    }
  };

  const installMod = async (repoUrl: string, version?: string) => {
    try {
      setIsInstallingMod(repoUrl);
      const result = await invoke<InstalledMod>('install_mod_from_github', {
        profileName,
        repoUrl,
        version: version || null
      });
      toast.success(`MOD "${result.name}" をインストールしました`);
      await loadInstalledMods();
    } catch (err) {
      toast.error(`MODのインストールに失敗しました: ${err}`);
    } finally {
      setIsInstallingMod(null);
    }
  };

  const uninstallMod = async (modName: string) => {
    try {
      const result = await invoke<string>('uninstall_mod', {
        profileName,
        modName
      });
      toast.success(result);
      await loadInstalledMods();
    } catch (err) {
      toast.error(`MODのアンインストールに失敗しました: ${err}`);
    }
  };

  const installCustomMod = async () => {
    if (!customRepoUrl.trim()) {
      toast.error('GitHubリポジトリURLを入力してください');
      return;
    }

    if (!customRepoUrl.includes('github.com')) {
      toast.error('有効なGitHubリポジトリURLを入力してください');
      return;
    }

    await installMod(customRepoUrl.trim());
    setCustomRepoUrl('');
  };

  const openProfileFolder = async () => {
    try {
      await invoke('open_profile_folder', { profileName });
      toast.success('プロファイルフォルダを開きました');
    } catch (err) {
      toast.error(`フォルダを開けませんでした: ${err}`);
    }
  };

  const uninstallModLoader = async () => {
    try {
      setIsLoadingModLoader(true);
      const result = await invoke<string>('uninstall_mod_loader', { profileName });
      toast.success(result);
      await loadModLoaderInfo();
      await loadProfile(); // 起動引数が更新される可能性がある
    } catch (err) {
      toast.error(`MODローダーのアンインストールに失敗しました: ${err}`);
    } finally {
      setIsLoadingModLoader(false);
    }
  };

  const hasChanges = profile && (
    displayName !== profile.display_name ||
    description !== profile.description ||
    JSON.stringify(args) !== JSON.stringify(profile.args)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-4"
        >
          <Loader2 className="w-8 h-8 text-resonite-blue animate-spin" />
          <p className="text-gray-300 text-lg">プロファイル設定を読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">プロファイルが見つかりません</p>
          <button className="btn-secondary mt-4" onClick={onBack}>
            戻る
          </button>
        </motion.div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-6 h-6 text-resonite-blue" />
              <h2 className="text-2xl font-bold text-white">プロファイル情報</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  表示名
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="プロファイルの表示名を入力"
                  className="input-primary w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  プロファイル一覧で表示される名前です（日本語使用可能）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  プロファイルID
                </label>
                <input
                  type="text"
                  value={profile.id}
                  disabled
                  className="input-primary w-full bg-dark-800/50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  フォルダ名として使用される内部ID（変更不可）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  説明
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="プロファイルの説明を入力"
                  className="input-primary w-full"
                />
              </div>
            </div>
          </motion.div>
        );

      case 'launch':
        return (
          <motion.div
            key="launch"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Terminal className="w-6 h-6 text-resonite-blue" />
              <h2 className="text-2xl font-bold text-white">起動引数</h2>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium mb-2">起動引数について</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Resonite起動時に渡されるコマンドライン引数を設定できます</li>
                    <li>• 各引数は自動的に適切にエスケープされます</li>
                    <li>• 一般的な引数: <code className="bg-dark-800 px-1 rounded">-SkipIntroTutorial</code>, <code className="bg-dark-800 px-1 rounded">-DataPath &quot;path&quot;</code></li>
                    <li>• パス変数が使用可能: <code className="bg-dark-800 px-1 rounded">%PROFILE_DIR%</code>, <code className="bg-dark-800 px-1 rounded">%GAME_DIR%</code>, <code className="bg-dark-800 px-1 rounded">%DATA_DIR%</code></li>
                    <li>• 例: <code className="bg-dark-800 px-1 rounded">-DataPath &quot;%DATA_DIR%&quot;</code> → プロファイルのDataPathフォルダ</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Add new argument */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newArg}
                  onChange={(e) => setNewArg(e.target.value)}
                  placeholder="新しい引数を入力 (例: -SkipIntroTutorial)"
                  className="input-primary flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addArg();
                    }
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center space-x-2"
                  onClick={addArg}
                  disabled={!newArg.trim()}
                >
                  <Plus className="w-4 h-4" />
                  <span>追加</span>
                </motion.button>
              </div>

              {/* Arguments list */}
              {args.length === 0 ? (
                <div className="text-center py-8">
                  <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">起動引数が設定されていません</p>
                  <p className="text-gray-500 text-sm">上のフィールドから引数を追加してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {args.map((arg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center space-x-2 p-3 bg-dark-800/30 border border-dark-600/30 rounded-lg"
                    >
                      <Terminal className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(index, e.target.value)}
                        className="input-primary flex-1"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-danger flex items-center space-x-2"
                        onClick={() => removeArg(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'mods':
        return (
          <motion.div
            key="mods"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Package className="w-6 h-6 text-resonite-blue" />
              <h2 className="text-2xl font-bold text-white">MOD管理</h2>
            </div>

            {!modLoaderInfo?.installed ? (
              /* MODローダー未インストール時の警告 */
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-yellow-400 font-medium mb-2">ResoniteModLoaderが必要です</h4>
                    <p className="text-yellow-200 text-sm mb-4">
                      MODを使用するにはResoniteModLoaderをインストールする必要があります。
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary flex items-center space-x-2"
                      onClick={showModLoaderInstallWarning}
                      disabled={isLoadingModLoader}
                    >
                      {isLoadingModLoader ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                      <span>ResoniteModLoaderをインストール</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              /* MOD管理メニュー */
              <div className="space-y-6">
                {/* 手動MODインストール */}
                <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                    <Github className="w-5 h-5" />
                    <span>手動MODインストール</span>
                  </h3>
                  
                  <div className="flex space-x-3 mb-4">
                    <input
                      type="text"
                      value={customRepoUrl}
                      onChange={(e) => setCustomRepoUrl(e.target.value)}
                      placeholder="https://github.com/author/mod-name"
                      className="input-primary flex-1"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary flex items-center space-x-2"
                      onClick={installCustomMod}
                      disabled={isInstallingMod !== null || !customRepoUrl.trim()}
                    >
                      {isInstallingMod === customRepoUrl ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>インストール</span>
                    </motion.button>
                  </div>
                  
                  <p className="text-gray-400 text-sm">
                    GitHubリポジトリのURLを入力してMODを直接インストールできます。
                  </p>
                </div>

                {/* 利用可能なMOD一覧 */}
                <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">利用可能なMOD</h3>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-secondary flex items-center space-x-2"
                      onClick={loadAvailableMods}
                      disabled={isLoadingMods}
                    >
                      {isLoadingMods ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>MOD一覧を取得</span>
                    </motion.button>
                  </div>

                  {availableMods.length > 0 && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={modSearchQuery}
                        onChange={(e) => setModSearchQuery(e.target.value)}
                        placeholder="MODを検索..."
                        className="input-primary w-full"
                      />
                    </div>
                  )}

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {isLoadingMods ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 text-resonite-blue animate-spin mx-auto mb-4" />
                        <p className="text-gray-400">MOD一覧を取得中...</p>
                      </div>
                    ) : availableMods.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">利用可能なMODはありません</p>
                        <p className="text-gray-500 text-sm">「MOD一覧を取得」ボタンを押してください</p>
                      </div>
                    ) : (
                      availableMods
                        .filter(mod => 
                          !modSearchQuery || 
                          mod.name.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
                          mod.description.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
                          mod.author.toLowerCase().includes(modSearchQuery.toLowerCase())
                        )
                        .map((mod, index) => (
                          <motion.div
                            key={mod.source_location}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-dark-700/30 border border-dark-600/30 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="text-white font-medium">{mod.name}</h4>
                                <p className="text-gray-400 text-sm">by {mod.author}</p>
                                {mod.latest_version && (
                                  <p className="text-gray-500 text-xs">最新: {mod.latest_version}</p>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="btn-secondary text-xs"
                                  onClick={() => window.open(mod.source_location, '_blank')}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </motion.button>
                                
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="btn-primary text-xs flex items-center space-x-1"
                                  onClick={() => installMod(mod.source_location)}
                                  disabled={isInstallingMod !== null}
                                >
                                  {isInstallingMod === mod.source_location ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3" />
                                  )}
                                  <span>インストール</span>
                                </motion.button>
                              </div>
                            </div>
                            
                            <p className="text-gray-300 text-sm mb-2">{mod.description}</p>
                            
                            {mod.category && (
                              <span className="inline-block bg-resonite-blue/20 text-resonite-blue text-xs px-2 py-1 rounded">
                                {mod.category}
                              </span>
                            )}
                          </motion.div>
                        ))
                    )}
                  </div>
                </div>

                {/* インストール済みMOD */}
                <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">インストール済みMOD</h3>
                  
                  <div className="space-y-3">
                    {installedMods.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">インストール済みMODはありません</p>
                        <p className="text-gray-500 text-sm">上記からMODをインストールしてください</p>
                      </div>
                    ) : (
                      installedMods.map((mod, index) => (
                        <motion.div
                          key={mod.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-dark-700/30 border border-dark-600/30 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="text-white font-medium">{mod.name}</h4>
                              <p className="text-gray-400 text-sm">バージョン: {mod.installed_version}</p>
                              <p className="text-gray-500 text-xs">インストール日: {mod.installed_date}</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-secondary text-xs"
                                onClick={() => window.open(mod.source_location, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </motion.button>
                              
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-danger text-xs flex items-center space-x-1"
                                onClick={() => uninstallMod(mod.name)}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>削除</span>
                              </motion.button>
                            </div>
                          </div>
                          
                          {mod.description && (
                            <p className="text-gray-300 text-sm">{mod.description}</p>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        );

      case 'other':
        return (
          <motion.div
            key="other"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="w-6 h-6 text-resonite-blue" />
              <h2 className="text-2xl font-bold text-white">その他の設定</h2>
            </div>

            <div className="bg-dark-800/30 rounded-lg p-8 text-center">
              <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">詳細設定</p>
              <p className="text-gray-500">今後、詳細設定項目がここに追加される予定です</p>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-4 h-full overflow-y-scroll">
      {/* Header with breadcrumb */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center space-x-2"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>戻る</span>
          </motion.button>
          
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>プロファイル管理</span>
            <span>/</span>
            <span className="text-white font-medium">{profile.display_name}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center space-x-2"
            onClick={openProfileFolder}
            title="プロファイルフォルダを開く"
          >
            <FolderOpen className="w-4 h-4" />
            <span>フォルダを開く</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center space-x-2"
            onClick={saveProfile}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>保存</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex space-x-1 bg-dark-800/30 p-1 rounded-lg"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-resonite-blue text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {renderTabContent()}
      </motion.div>

      {/* Save reminder */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4 backdrop-blur-sm"
        >
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">未保存の変更があります</p>
              <p className="text-gray-300 text-sm">変更を保存することを忘れずに</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary"
              onClick={saveProfile}
              disabled={isSaving}
            >
              保存
            </motion.button>
          </div>
        </motion.div>
      )}
      
      {/* MOD Risk Warning Modal */}
      <ModRiskWarningModal
        isOpen={showModRiskModal}
        onClose={handleModRiskCancel}
        onConfirm={handleModRiskConfirm}
        title="MODローダーのインストール"
      />
    </div>
  );
}

export default ProfileEditPage;