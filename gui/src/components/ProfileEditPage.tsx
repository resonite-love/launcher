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
  Github,
  Edit,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import ModRiskWarningModal from './ModRiskWarningModal';
import { ModVersionSelector } from './ModVersionSelector';
import { 
  useModManifest, 
  useInstalledMods, 
  useModVersions,
  useInstallMod,
  useUninstallMod,
  useUpdateMod,
  useDowngradeMod,
  useUpgradeMod,
  useUnmanagedMods,
  useAddUnmanagedMod,
  useAddAllUnmanagedMods,
  useYtDlpStatus,
  useUpdateYtDlp
} from '../hooks/useQueries';

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
  releases: ModRelease[];
  tags?: string[];
  flags?: string[];
  last_updated?: string;
}

interface InstalledMod {
  name: string;
  description: string;
  source_location: string;
  installed_version: string;
  installed_date: string;
  dll_path: string;
}

interface ModRelease {
  version: string;
  download_url?: string;
  release_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  changelog?: string;
  file_name?: string;
  file_size?: number;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

interface GitHubRelease {
  tag_name: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
}

interface UnmanagedMod {
  file_name: string;
  file_path: string;
  file_size: number;
  modified_time: string;
  dll_name: string;
  matched_mod_info?: ModInfo;
  calculated_sha256?: string;
  detected_version?: string;
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
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [isInstallingMod, setIsInstallingMod] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<{[modUrl: string]: string}>({});
  const [selectedModForVersions, setSelectedModForVersions] = useState<InstalledMod | null>(null);
  const [selectedAvailableModForVersions, setSelectedAvailableModForVersions] = useState<ModInfo | null>(null);
  const [selectedInstallVersion, setSelectedInstallVersion] = useState<string>('');
  const [modActiveTab, setModActiveTab] = useState<'install' | 'manage'>('install');

  // React Query hooks - disable auto-fetch for available mods
  const { data: availableMods = [], isLoading: modsLoading, refetch: refetchMods } = useModManifest(profileName);
  const { data: installedMods = [], isLoading: installedModsLoading, refetch: refetchInstalledMods } = useInstalledMods(profileName);
  const { data: unmanagedMods = [], isLoading: unmanagedModsLoading, refetch: refetchUnmanagedMods } = useUnmanagedMods(profileName);
  // MODバージョン取得用のstate
  const [manualModVersions, setManualModVersions] = useState<{[modName: string]: ModRelease[]}>({});
  const [loadingManualVersions, setLoadingManualVersions] = useState<string | null>(null);

  const { data: modVersions = [], isLoading: versionsLoading } = useModVersions(
    profileName, 
    selectedModForVersions ? availableMods.find(m => m.name === selectedModForVersions.name || m.source_location === selectedModForVersions.source_location) || null : null
  );
  
  const { data: availableModVersions = [], isLoading: availableVersionsLoading } = useModVersions(
    profileName,
    selectedAvailableModForVersions
  );
  
  const installModMutation = useInstallMod();
  const uninstallModMutation = useUninstallMod();
  const updateModMutation = useUpdateMod();
  const downgradeModMutation = useDowngradeMod();
  const upgradeModMutation = useUpgradeMod();
  const addUnmanagedModMutation = useAddUnmanagedMod();
  const addAllUnmanagedModsMutation = useAddAllUnmanagedMods();
  
  // yt-dlp管理用のクエリ
  const { data: ytDlpInfo, isLoading: ytDlpLoading, refetch: refetchYtDlp } = useYtDlpStatus(profileName);
  const updateYtDlpMutation = useUpdateYtDlp();

  const tabs = [
    { id: 'info' as TabType, label: 'プロファイル情報', icon: User },
    { id: 'launch' as TabType, label: '起動オプション', icon: Terminal },
    { id: 'mods' as TabType, label: 'MOD管理', icon: Package },
    { id: 'other' as TabType, label: 'その他', icon: Settings },
  ];

  useEffect(() => {
    loadProfile();
    loadModLoaderInfo();
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
    refetchMods();
  };

  const installMod = async (modInfo: ModInfo, version?: string) => {
    const selectedVersion = selectedVersions[modInfo.source_location] || version;
    await installModMutation.mutateAsync({
      profileName,
      modInfo,
      version: selectedVersion
    });
  };

  const handleVersionChange = async (mod: InstalledMod, targetVersion: string) => {
    const currentVersion = mod.installed_version;
    
    try {
      // Compare versions to determine if it's an upgrade or downgrade
      const isUpgrade = compareVersions(targetVersion, currentVersion) > 0;
      
      if (isUpgrade) {
        await upgradeModMutation.mutateAsync({
          profileName,
          modName: mod.name,
          targetVersion
        });
      } else {
        await downgradeModMutation.mutateAsync({
          profileName,
          modName: mod.name,
          targetVersion
        });
      }
    } catch (err) {
      toast.error(`バージョン変更に失敗しました: ${err}`);
    }
  };

  // Simple version comparison (basic implementation)
  const compareVersions = (a: string, b: string): number => {
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');
    return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
  };

  // 新しいバージョンが利用可能かチェック
  const hasNewerVersion = (mod: InstalledMod): boolean => {
    const manifestMod = availableMods.find(m => 
      m.name === mod.name || m.source_location === mod.source_location
    );
    
    if (!manifestMod || !manifestMod.latest_version) return false;
    
    return compareVersions(manifestMod.latest_version, mod.installed_version) > 0;
  };

  // 手動インストールMODのバージョン一覧を取得
  const loadManualModVersions = async (mod: InstalledMod) => {
    try {
      setLoadingManualVersions(mod.name);
      
      // GitHubの全リリース情報を取得
      const releases = await invoke<GitHubRelease[]>('get_all_github_releases', { 
        repoUrl: mod.source_location 
      });
      
      // ModRelease形式に変換
      const modReleases: ModRelease[] = releases
        .filter(release => release.assets && release.assets.length > 0)
        .map(release => {
          const dllAsset = release.assets?.find(asset => asset.name.endsWith('.dll'));
          return {
            version: release.tag_name,
            download_url: dllAsset?.browser_download_url,
            release_url: `${mod.source_location}/releases/tag/${release.tag_name}`,
            published_at: release.published_at || '',
            prerelease: release.prerelease || false,
            draft: release.draft || false,
            changelog: release.body,
            file_name: dllAsset?.name,
            file_size: dllAsset?.size
          };
        })
        .filter(release => release.download_url); // DLLがあるもののみ
      
      setManualModVersions(prev => ({
        ...prev,
        [mod.name]: modReleases
      }));
      
    } catch (err) {
      toast.error(`バージョン情報の取得に失敗しました: ${err}`);
    } finally {
      setLoadingManualVersions(null);
    }
  };

  // MODがマニフェストに含まれているかチェック
  const isModInManifest = (mod: InstalledMod): boolean => {
    return availableMods.some(availableMod => 
      availableMod.name === mod.name || 
      availableMod.source_location === mod.source_location
    );
  };

  // バージョン変更ボタンクリック時の処理
  const handleVersionChangeClick = async (mod: InstalledMod) => {
    setSelectedModForVersions(mod);
    
    // マニフェストに含まれていない場合は手動でバージョン情報を取得
    if (!isModInManifest(mod) && !manualModVersions[mod.name]) {
      await loadManualModVersions(mod);
    }
  };

  // 利用可能なMODのインストールボタンクリック
  const handleAvailableModInstallClick = (mod: ModInfo) => {
    setSelectedAvailableModForVersions(mod);
    setSelectedInstallVersion(''); // リセット
  };

  const handleAvailableModVersionSelect = (version: string) => {
    setSelectedInstallVersion(version);
  };

  const handleInstallButtonClick = async () => {
    if (selectedAvailableModForVersions && selectedInstallVersion) {
      await installMod(selectedAvailableModForVersions, selectedInstallVersion);
      setSelectedAvailableModForVersions(null);
      setSelectedInstallVersion('');
    }
  };

  const installModFromUrl = async (repoUrl: string, version?: string) => {
    try {
      setIsInstallingMod(repoUrl);
      const result = await invoke<InstalledMod>('install_mod_from_github', {
        profileName,
        repoUrl,
        version: version || null
      });
      toast.success(`MOD "${result.name}" をインストールしました`);
      refetchInstalledMods();
    } catch (err) {
      toast.error(`MODのインストールに失敗しました: ${err}`);
    } finally {
      setIsInstallingMod(null);
    }
  };

  const uninstallMod = async (modName: string) => {
    await uninstallModMutation.mutateAsync({ profileName, modName });
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

    await installModFromUrl(customRepoUrl.trim());
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
                {/* MODサブタブ */}
                <div className="flex space-x-1 bg-dark-800/30 p-1 rounded-lg">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 ${
                      modActiveTab === 'install'
                        ? 'bg-resonite-blue text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                    }`}
                    onClick={() => setModActiveTab('install')}
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-medium">インストール</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 ${
                      modActiveTab === 'manage'
                        ? 'bg-resonite-blue text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                    }`}
                    onClick={() => setModActiveTab('manage')}
                  >
                    <Package className="w-4 h-4" />
                    <span className="font-medium">管理</span>
                  </motion.button>
                </div>

                {/* インストールタブのコンテンツ */}
                {modActiveTab === 'install' && (
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
                          disabled={modsLoading}
                        >
                          {modsLoading ? (
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
                        {modsLoading ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-resonite-blue animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">MOD一覧を取得中...</p>
                          </div>
                        ) : availableMods.length === 0 ? (
                          <div className="text-center py-8">
                            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">MOD一覧を取得してください</p>
                            <p className="text-gray-500 text-sm">上の「MOD一覧を取得」ボタンを押してください</p>
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
                                key={`${mod.source_location}-${mod.name}-${index}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-dark-700/30 border border-dark-600/30 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h4 className="text-white font-medium text-sm truncate">{mod.name}</h4>
                                      {mod.category && (
                                        <span className="inline-block bg-resonite-blue/20 text-resonite-blue text-xs px-1.5 py-0.5 rounded shrink-0">
                                          {mod.category}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-400 text-xs">by {mod.author} • {mod.releases.length} リリース</p>
                                    <p className="text-gray-300 text-xs truncate">{mod.description}</p>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2 ml-3">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-secondary text-xs p-1.5"
                                      onClick={() => window.open(mod.source_location, '_blank')}
                                      title="GitHubで開く"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </motion.button>
                                    
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-primary text-xs flex items-center space-x-1 px-3 py-1.5"
                                      onClick={() => handleAvailableModInstallClick(mod)}
                                      disabled={installModMutation.isPending || mod.releases.length === 0}
                                      title="バージョンを選択してインストール"
                                    >
                                      {installModMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Download className="w-3 h-3" />
                                      )}
                                      <span>インストール</span>
                                    </motion.button>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* 未管理MOD（手動で追加されたMOD） */}
                    {unmanagedMods.length > 0 && (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-orange-400">検出された未管理MOD</h3>
                          <div className="flex items-center space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="btn-primary text-xs flex items-center space-x-1"
                              onClick={() => addAllUnmanagedModsMutation.mutate({ 
                                profileName, 
                                unmanagedMods 
                              })}
                              disabled={addAllUnmanagedModsMutation.isPending || unmanagedMods.length === 0}
                            >
                              {addAllUnmanagedModsMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              <span>すべて管理システムに追加</span>
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="btn-secondary text-xs flex items-center space-x-1"
                              onClick={() => refetchUnmanagedMods()}
                              disabled={unmanagedModsLoading}
                            >
                              {unmanagedModsLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span>再スキャン</span>
                            </motion.button>
                          </div>
                        </div>
                        
                        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                          <p className="text-orange-300 text-sm">
                            ⚠️ これらのMODはrml_modsフォルダに手動で追加されたファイルです。
                            管理システムに追加すると、バージョン管理が可能になります。
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          {unmanagedMods.map((mod, index) => (
                            <motion.div
                              key={mod.file_path}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-dark-700/30 border border-orange-500/20 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="text-orange-200 font-medium">{mod.dll_name}</h4>
                                  <p className="text-gray-400 text-sm">ファイル: {mod.file_name}</p>
                                  <p className="text-gray-500 text-xs">
                                    サイズ: {(mod.file_size / 1024 / 1024).toFixed(2)}MB | 
                                    更新: {mod.modified_time}
                                  </p>
                                  {mod.calculated_sha256 && (
                                    <p className="text-gray-500 text-xs font-mono">
                                      SHA256: {mod.calculated_sha256.substring(0, 16)}...
                                    </p>
                                  )}
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="btn-primary text-xs flex items-center space-x-1"
                                  onClick={() => addUnmanagedModMutation.mutate({ 
                                    profileName, 
                                    unmanagedMod: mod 
                                  })}
                                  disabled={addUnmanagedModMutation.isPending}
                                >
                                  {addUnmanagedModMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                  <span>追加</span>
                                </motion.button>
                              </div>
                              
                              {/* ハッシュベースのバージョン検出情報 */}
                              {mod.detected_version && (
                                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                                  <p className="text-blue-300 text-sm">
                                    🔍 検出バージョン: <span className="font-mono">{mod.detected_version}</span>
                                  </p>
                                  <p className="text-blue-200 text-xs mt-1">
                                    このMODは管理システムに追加時、検出されたバージョンで登録されます
                                  </p>
                                </div>
                              )}
                              
                              {mod.matched_mod_info ? (
                                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="text-green-400 font-medium">マッチしたMOD情報</h5>
                                      <p className="text-green-300 text-sm">{mod.matched_mod_info.name}</p>
                                      <p className="text-green-200 text-xs">{mod.matched_mod_info.description}</p>
                                      <p className="text-green-200 text-xs">作者: {mod.matched_mod_info.author}</p>
                                      {mod.matched_mod_info.latest_version && (
                                        <p className="text-green-200 text-xs">最新バージョン: {mod.matched_mod_info.latest_version}</p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn-secondary text-xs"
                                        onClick={() => window.open(mod.matched_mod_info!.source_location, '_blank')}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </motion.button>
                                    </div>
                                  </div>
                                </div>
                              ) : !mod.detected_version && (
                                <div className="mt-3 p-3 bg-gray-500/10 border border-gray-500/30 rounded">
                                  <p className="text-gray-400 text-sm">
                                    📦 マニフェストに該当するMODが見つかりませんでした
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 管理タブのコンテンツ */}
                {modActiveTab === 'manage' && (
                  <div className="space-y-6">
                    {/* インストール済みMOD */}
                    <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">インストール済みMOD</h3>
                      
                      <div className="space-y-3">
                        {installedMods.length === 0 ? (
                          <div className="text-center py-8">
                            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">インストール済みMODはありません</p>
                            <p className="text-gray-500 text-sm">インストールタブからMODをインストールしてください</p>
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
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h4 className="text-white font-medium">{mod.name}</h4>
                                    {hasNewerVersion(mod) && (
                                      <span className="inline-flex items-center text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1"></span>
                                        更新可能
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-400 text-sm">
                                    バージョン: {mod.installed_version}
                                    {hasNewerVersion(mod) && (() => {
                                      const manifestMod = availableMods.find(m => 
                                        m.name === mod.name || m.source_location === mod.source_location
                                      );
                                      return manifestMod?.latest_version && (
                                        <span className="text-blue-300 ml-2">
                                          → {manifestMod.latest_version} が利用可能
                                        </span>
                                      );
                                    })()}
                                  </p>
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
                                    className={`text-xs flex items-center space-x-1 ${
                                      hasNewerVersion(mod) 
                                        ? 'btn-primary border-blue-500/50' 
                                        : 'btn-secondary'
                                    }`}
                                    onClick={() => handleVersionChangeClick(mod)}
                                    disabled={versionsLoading || loadingManualVersions === mod.name}
                                    title={hasNewerVersion(mod) ? '新しいバージョンが利用可能です' : 'バージョンを変更'}
                                  >
                                    {loadingManualVersions === mod.name ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Edit className="w-3 h-3" />
                                    )}
                                    <span>バージョン変更</span>
                                    {hasNewerVersion(mod) && (
                                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                    )}
                                  </motion.button>
                                  
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="btn-danger text-xs flex items-center space-x-1"
                                    onClick={() => uninstallMod(mod.name)}
                                    disabled={uninstallModMutation.isPending}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>削除</span>
                                  </motion.button>
                                </div>
                              </div>
                              
                              {mod.description && (
                                <p className="text-gray-300 text-sm">{mod.description}</p>
                              )}
                              
                              {/* バージョン選択UI */}
                              {selectedModForVersions?.name === mod.name && (
                                <div className="mt-4 p-3 bg-dark-600/30 border border-dark-500/30 rounded-lg">
                                  <h5 className="text-white font-medium mb-2">バージョン選択</h5>
                                  {(versionsLoading || loadingManualVersions === mod.name) ? (
                                    <div className="flex items-center space-x-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span className="text-gray-400">バージョン情報を取得中...</span>
                                    </div>
                                  ) : (() => {
                                    const availableVersions = isModInManifest(mod) 
                                      ? modVersions 
                                      : manualModVersions[mod.name] || [];
                                    
                                    return availableVersions.length > 0 ? (
                                      <ModVersionSelector
                                        mod={mod}
                                        availableVersions={availableVersions}
                                        onVersionSelect={(version) => handleVersionChange(mod, version)}
                                        isLoading={updateModMutation.isPending || downgradeModMutation.isPending || upgradeModMutation.isPending}
                                      />
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-gray-400 text-sm">利用可能なバージョンがありません</p>
                                        {!isModInManifest(mod) && (
                                          <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="btn-secondary text-xs flex items-center space-x-1"
                                            onClick={() => loadManualModVersions(mod)}
                                            disabled={loadingManualVersions === mod.name}
                                          >
                                            {loadingManualVersions === mod.name ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Github className="w-3 h-3" />
                                            )}
                                            <span>GitHubから取得</span>
                                          </motion.button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="mt-2 flex justify-end">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-secondary text-xs"
                                      onClick={() => setSelectedModForVersions(null)}
                                    >
                                      閉じる
                                    </motion.button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
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

            <div className="space-y-6">
              {/* yt-dlp管理 */}
              <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Download className="w-5 h-5 text-resonite-blue" />
                  <span>yt-dlp管理</span>
                </h3>
                
                {ytDlpLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-gray-400">yt-dlpの状態を確認中...</span>
                  </div>
                ) : ytDlpInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-dark-700/30 border border-dark-600/30 rounded-lg">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-white font-medium">yt-dlp.exe</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          バージョン: {ytDlpInfo.version || '不明'}
                        </p>
                        {ytDlpInfo.path && (
                          <p className="text-gray-500 text-xs">
                            パス: Game/RuntimeData/yt-dlp.exe
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn-secondary text-xs flex items-center space-x-1"
                          onClick={() => refetchYtDlp()}
                          disabled={ytDlpLoading}
                        >
                          <RefreshCw className={`w-3 h-3 ${ytDlpLoading ? 'animate-spin' : ''}`} />
                          <span>更新確認</span>
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn-primary text-xs flex items-center space-x-1"
                          onClick={() => updateYtDlpMutation.mutate(profileName)}
                          disabled={updateYtDlpMutation.isPending}
                        >
                          {updateYtDlpMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>
                            {ytDlpInfo.installed ? 'アップデート' : 'インストール'}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400">yt-dlpの状態を取得できませんでした</p>
                  </div>
                )}
              </div>

              {/* その他の設定エリア */}
              <div className="bg-dark-800/30 rounded-lg p-8 text-center">
                <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">詳細設定</p>
                <p className="text-gray-500">今後、詳細設定項目がここに追加される予定です</p>
              </div>
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
            className="btn-secondary flex items-center space-x-2"
            onClick={() => {
              refetchInstalledMods();
              refetchUnmanagedMods();
            }}
            disabled={installedModsLoading || unmanagedModsLoading}
            title="MODフォルダの変更を反映"
          >
            {installedModsLoading || unmanagedModsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>リロード</span>
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

      {/* 利用可能なMODのバージョン選択モーダル */}
      {selectedAvailableModForVersions && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedAvailableModForVersions(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-800 border border-dark-600 rounded-lg p-6 w-full max-w-4xl min-h-[500px] max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                {selectedAvailableModForVersions.name} - インストール
              </h3>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary text-sm"
                onClick={() => setSelectedAvailableModForVersions(null)}
              >
                閉じる
              </motion.button>
            </div>
            
            {availableVersionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-resonite-blue" />
                <span className="ml-2 text-gray-400">バージョン情報を取得中...</span>
              </div>
            ) : availableModVersions.length > 0 ? (
              <div className="space-y-4">
                <ModVersionSelector
                  mod={{
                    name: selectedAvailableModForVersions.name,
                    description: selectedAvailableModForVersions.description,
                    source_location: selectedAvailableModForVersions.source_location,
                    installed_version: '',
                    installed_date: new Date().toISOString(),
                    dll_path: ''
                  }}
                  availableVersions={availableModVersions}
                  onVersionSelect={handleAvailableModVersionSelect}
                  isLoading={installModMutation.isPending}
                />
                
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary flex items-center space-x-2"
                    onClick={handleInstallButtonClick}
                    disabled={installModMutation.isPending || !selectedInstallVersion}
                  >
                    {installModMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>インストール</span>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">利用可能なバージョンがありません</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default ProfileEditPage;