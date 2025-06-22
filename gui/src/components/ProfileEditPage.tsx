import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/shell';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  UserPlus,
  Eye,
  EyeOff,
  Play,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import ModRiskWarningModal from './ModRiskWarningModal';
import MultiFileInstallModal from './MultiFileInstallModal';
import ProfileActionsDropdown from './ProfileActionsDropdown';
import GameVersionSelector from './GameVersionSelector';
import GameUpdateModal from './GameUpdateModal';
import GameInstallModal from './GameInstallModal';
import LaunchArgumentsEditor from './LaunchArgumentsEditor';
import { ModVersionSelector } from './ModVersionSelector';
import { ProfileDeleteConfirmModal } from './ProfileDeleteConfirmModal';
import { 
  useModManifest, 
  useInstalledMods, 
  useModVersions,
  useInstallMod,
  useUninstallMod,
  useDisableMod,
  useEnableMod,
  useUpdateMod,
  useDowngradeMod,
  useUpgradeMod,
  useUnmanagedMods,
  useAddUnmanagedMod,
  useAddAllUnmanagedMods,
  useCheckMultiFileInstall,
  useInstallMultipleFiles,
  useYtDlpStatus,
  useUpdateYtDlp,
  useLaunchResonite,
  useMigrateInstalledMods,
  useMigrateProfileConfig,
  useSteamCredentials,
  MultiFileInstallRequest,
  FileInstallChoice
} from '../hooks/useQueries';

interface ProfileConfig {
  config_version?: number;
  id: string;
  display_name: string;
  name?: string; // 互換性のため
  description: string;
  args: string[];
  game_info?: {
    branch: string;
    manifest_id?: string;
  };
  mod_loader_type?: 'ResoniteModLoader' | 'MonkeyLoader';
}

interface ProfileEditPageProps {
  profileName: string;
  onBack: () => void;
}

interface UnifiedModLoaderInfo {
  installed: boolean;
  loader_type?: 'ResoniteModLoader' | 'MonkeyLoader';
  version?: string;
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

interface GameVersion {
  gameVersion: string;
  manifestId: string;
  timestamp: string;
}

export interface BranchInfo {
  [key: string]: GameVersion[];
}

type TabType = 'info' | 'launch' | 'mods' | 'other';

function ProfileEditPage({ profileName, onBack }: ProfileEditPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  
  // Steam認証情報を取得
  const { data: steamCredentials } = useSteamCredentials();
  
  // フォーム状態
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [args, setArgs] = useState<string[]>([]);
  
  // MODローダー用の状態
  const [modLoaderInfo, setModLoaderInfo] = useState<UnifiedModLoaderInfo | null>(null);
  const [isLoadingModLoader, setIsLoadingModLoader] = useState(false);
  const [showModRiskModal, setShowModRiskModal] = useState(false);
  const [selectedModLoaderType, setSelectedModLoaderType] = useState<'ResoniteModLoader' | 'MonkeyLoader'>('ResoniteModLoader');
  
  // MOD管理用の状態
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [isInstallingMod, setIsInstallingMod] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<{[modUrl: string]: string}>({});
  const [selectedModForVersions, setSelectedModForVersions] = useState<InstalledMod | null>(null);
  const [selectedAvailableModForVersions, setSelectedAvailableModForVersions] = useState<ModInfo | null>(null);
  const [selectedInstallVersion, setSelectedInstallVersion] = useState<string>('');
  const [selectedCustomModUrl, setSelectedCustomModUrl] = useState<string>('');
  const [customModVersions, setCustomModVersions] = useState<any[]>([]);
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
  const disableModMutation = useDisableMod();
  const enableModMutation = useEnableMod();
  const updateModMutation = useUpdateMod();
  const downgradeModMutation = useDowngradeMod();
  const upgradeModMutation = useUpgradeMod();
  const addUnmanagedModMutation = useAddUnmanagedMod();
  const addAllUnmanagedModsMutation = useAddAllUnmanagedMods();
  
  // 複数ファイルインストール用のフック
  const checkMultiFileInstallMutation = useCheckMultiFileInstall();
  const installMultipleFilesMutation = useInstallMultipleFiles();
  
  // 複数ファイルインストール用の状態
  const [multiFileInstallRequest, setMultiFileInstallRequest] = useState<MultiFileInstallRequest | null>(null);
  const [showMultiFileModal, setShowMultiFileModal] = useState(false);
  
  // yt-dlp管理用のクエリ
  const { data: ytDlpInfo, isLoading: ytDlpLoading, refetch: refetchYtDlp } = useYtDlpStatus(profileName);
  const updateYtDlpMutation = useUpdateYtDlp();
  const launchMutation = useLaunchResonite();
  const migrateInstalledModsMutation = useMigrateInstalledMods();
  const migrateProfileConfigMutation = useMigrateProfileConfig();
  
  // ゲーム情報用の状態
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [showGameUpdateModal, setShowGameUpdateModal] = useState(false);
  const [hasGame, setHasGame] = useState(false);
  const [currentGameVersion, setCurrentGameVersion] = useState<string | null>(null);
  
  // 削除確認モーダル用の状態
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 複製モーダル用の状態
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateDescription, setDuplicateDescription] = useState('');
  const [currentBranch, setCurrentBranch] = useState<string>('release');
  const [showGameInstallModal, setShowGameInstallModal] = useState(false);
  const [isInstallingGame, setIsInstallingGame] = useState(false);
  const [gameVersions, setGameVersions] = useState<BranchInfo>({});
  

  const tabs = [
    { id: 'info' as TabType, label: t('profiles.editPage.gameInfo'), icon: User },
    { id: 'launch' as TabType, label: t('profiles.editModal.launchArgs.title'), icon: Terminal },
    { id: 'mods' as TabType, label: t('profiles.editPage.modManagement'), icon: Package },
    { id: 'other' as TabType, label: t('common.settings'), icon: Settings },
  ];

  useEffect(() => {
    loadProfile();
    loadModLoaderInfo();
    loadProfileInfo();
    loadGameVersions();
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
      toast.error(t('toasts.error', { message: err }));
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
      toast.success(t('toasts.profileUpdated'));
      setProfile(updatedProfile);
      
      // プロファイル一覧を更新
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) {
      toast.error(t('profiles.createModal.nameLabel') + t('toasts.nameRequired'));
      return;
    }

    try {
      setIsDuplicating(true);
      await invoke<string>('duplicate_profile', {
        sourceProfileName: profileName,
        newProfileName: duplicateName.trim(),
        newDescription: duplicateDescription.trim() || `${profile?.display_name || profileName}のコピー`
      });
      
      toast.success(t('toasts.profileCreated', { name: duplicateName }));
      
      // プロファイル一覧を更新
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      
      // モーダルを閉じてフィールドをリセット
      setShowDuplicateModal(false);
      setDuplicateName('');
      setDuplicateDescription('');
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsDuplicating(false);
    }
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
  
  const loadProfileInfo = async () => {
    try {
      const profiles = await invoke<any[]>('get_profiles');
      const info = profiles.find(p => p.id === profileName);
      if (info) {
        setProfileInfo(info);
        setHasGame(info.has_game || false);
        setCurrentGameVersion(info.version || null);
        setCurrentBranch(info.branch || 'release');
      }
    } catch (err) {
      console.error('Failed to load profile info:', err);
    }
  };
  
  const loadGameVersions = async () => {
    try {
      const versions = await invoke<any>('get_game_versions');
      setGameVersions(versions);
    } catch (err) {
      console.error('Failed to load game versions:', err);
    }
  };

  const showModLoaderInstallWarning = () => {
    setShowModRiskModal(true);
  };

  const installModLoader = async () => {
    try {
      setIsLoadingModLoader(true);
      const result = await invoke<string>('install_mod_loader', { 
        profileName,
        loaderType: selectedModLoaderType 
      });
      toast.success(result);
      await loadModLoaderInfo();
      await loadProfile(); // 起動引数が更新される可能性がある
      
      // プロファイル一覧を更新（MODローダー情報を含む）
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
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
      toast.error(t('toasts.error', { message: err }));
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
      toast.error(t('toasts.error', { message: err }));
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
  // 最新版を自動インストール
  const handleInstallLatestClick = async (mod: ModInfo) => {
    if (mod.releases.length > 0) {
      const latestVersion = mod.releases[0].version; // 配列の最初が最新版
      await installMod(mod, latestVersion);
    }
  };

  // カスタムインストール（バージョン選択）
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

  const handleCustomModInstallButtonClick = async () => {
    if (selectedCustomModUrl && selectedInstallVersion) {
      await installModFromUrl(selectedCustomModUrl, selectedInstallVersion);
      setSelectedCustomModUrl('');
      setSelectedInstallVersion('');
      setCustomModVersions([]);
      setCustomRepoUrl('');
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
      toast.success(`MOD "${result.name}" を` + t('common.install') + 'しました');
      refetchInstalledMods();
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsInstallingMod(null);
    }
  };

  const uninstallMod = async (modName: string) => {
    await uninstallModMutation.mutateAsync({ profileName, modName });
  };

  const disableMod = async (modName: string) => {
    await disableModMutation.mutateAsync({ profileName, modName });
  };

  const enableMod = async (modName: string) => {
    await enableModMutation.mutateAsync({ profileName, modName });
  };

  const handleLaunch = () => {
    if (!hasGame) {
      toast.error(t('home.launcher.notInstalled'));
      return;
    }
    launchMutation.mutate(profileName);
  };

  const installCustomMod = async () => {
    if (!customRepoUrl.trim()) {
      toast.error(t('toasts.githubUrlRequired'));
      return;
    }

    if (!customRepoUrl.includes('github.com')) {
      toast.error(t('toasts.validGithubUrlRequired'));
      return;
    }

    try {
      setIsInstallingMod(customRepoUrl);
      
      // 複数ファイルが必要かをチェック
      const multiFileRequest = await checkMultiFileInstallMutation.mutateAsync({
        repoUrl: customRepoUrl.trim()
      });
      
      if (multiFileRequest) {
        // 複数ファイルの場合、選択モーダルを表示
        setMultiFileInstallRequest(multiFileRequest);
        setShowMultiFileModal(true);
        setIsInstallingMod(null);
        return;
      }
      
      // 単一ファイルの場合、従来のフローを継続
      const versions = await invoke<any[]>('get_github_releases', { repoUrl: customRepoUrl.trim() });
      
      if (versions.length === 0) {
        toast.error(t('toasts.noReleasesFound'));
        return;
      }

      setCustomModVersions(versions);
      setSelectedCustomModUrl(customRepoUrl.trim());
      setSelectedInstallVersion('');
    } catch (error) {
      toast.error(t('toasts.error', { message: error }));
    } finally {
      setIsInstallingMod(null);
    }
  };

  const handleMultiFileInstall = async (choices: FileInstallChoice[], version: string) => {
    if (!customRepoUrl.trim()) return;
    
    try {
      await installMultipleFilesMutation.mutateAsync({
        profileName,
        repoUrl: customRepoUrl.trim(),
        version,
        choices
      });
      
      // インストール成功後、状態をリセット
      setCustomRepoUrl('');
      setMultiFileInstallRequest(null);
      setShowMultiFileModal(false);
    } catch (error) {
      // エラーハンドリングはuseMutationで処理される
    }
  };

  const handleMultiFileVersionChange = async (version: string) => {
    if (!customRepoUrl.trim()) return;
    
    try {
      // 新しいバージョンで複数ファイル情報を再取得
      const multiFileRequest = await checkMultiFileInstallMutation.mutateAsync({
        repoUrl: customRepoUrl.trim(),
        version
      });
      
      if (multiFileRequest) {
        setMultiFileInstallRequest(multiFileRequest);
      }
    } catch (error) {
      // エラーハンドリングはuseMutationで処理される
    }
  };

  const openProfileFolder = async () => {
    try {
      await invoke('open_profile_folder', { profileName });
      toast.success(t('toasts.profileFolderOpened'));
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    }
  };

  const uninstallModLoader = async () => {
    try {
      setIsLoadingModLoader(true);
      const result = await invoke<string>('uninstall_mod_loader', { profileName });
      toast.success(result);
      await loadModLoaderInfo();
      await loadProfile(); // 起動引数が更新される可能性がある
      
      // プロファイル一覧を更新（MODローダー情報を含む）
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsLoadingModLoader(false);
    }
  };

  const hasChanges = profile && (
    displayName !== profile.display_name ||
    description !== profile.description ||
    JSON.stringify(args) !== JSON.stringify(profile.args)
  );
  
  const handleGameUpdate = async (manifestId?: string) => {
    try {
      const request = {
        profile_name: profileName,
        branch: currentBranch,
        manifest_id: manifestId,
      };
      
      const result = await invoke<string>('update_profile_game_interactive', { request });
      toast.success(result);
      
      // 更新後に情報を再読み込み
      await loadProfileInfo();
      setShowGameUpdateModal(false);
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    }
  };
  
  const handleGameInstall = async (branch: string, manifestId?: string) => {
    try {
      setIsInstallingGame(true);
      const request = {
        profile_name: profileName,
        branch: branch,
        manifest_id: manifestId,
        username: steamCredentials?.username || null,
        password: steamCredentials?.password || null,
      };
      
      const result = await invoke<string>('install_game_to_profile_interactive', { request });
      toast.success(result);
      
      // インストール後に情報を再読み込み
      await loadProfileInfo();
      await loadModLoaderInfo();
      setShowGameInstallModal(false);
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsInstallingGame(false);
    }
  };
  
  // ゲームの新しいバージョンが利用可能かチェック
  const hasNewerGameVersion = (): boolean => {
    if (!gameVersions || !hasGame || !currentBranch || !currentGameVersion) {
      return false;
    }
    
    const branchVersions = gameVersions[currentBranch];
    if (!branchVersions || branchVersions.length === 0) {
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
    
    // 特定のマニフェストIDが指定されている場合はマニフェストIDで比較
    if (profileInfo?.manifest_id) {
      return latestVersion.manifestId !== profileInfo.manifest_id;
    }
    
    // プロファイルの現在のバージョンに対応するエントリを探す
    const currentVersionEntry = branchVersions.find(v => v.gameVersion === currentGameVersion);
    if (!currentVersionEntry) {
      // 現在のバージョンが見つからない場合は更新なしと判断（古すぎるか無効）
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
  
  // ゲームの最新バージョン情報を取得
  const getLatestGameVersionInfo = () => {
    if (!gameVersions || !currentBranch) {
      return null;
    }
    
    const branchVersions = gameVersions[currentBranch];
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
  
  // プロファイル削除処理
  const handleDeleteProfile = async () => {
    if (profileName === 'default') {
      toast.error(t('toasts.defaultProfileCannotBeDeleted'));
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Tauriコマンドを呼び出してプロファイルを削除
      const result = await invoke<string>('delete_profile', { profileName });
      
      toast.success(result);
      
      // プロファイル一覧のキャッシュを無効化
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      
      // HomeTabで使用されているプロファイル情報も更新
      await queryClient.invalidateQueries({ queryKey: ['profileInfo'] });
      
      // プロファイル一覧画面に戻る
      setTimeout(() => {
        onBack();
      }, 500);
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-4"
        >
          <Loader2 className="w-8 h-8 text-resonite-blue animate-spin" />
          <p className="text-gray-300 text-lg">{t('profiles.editPage.loadingProfile')}</p>
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
          <p className="text-gray-400 text-lg">{t('profiles.editPage.profileNotFound')}</p>
          <button className="btn-secondary mt-4" onClick={onBack}>
            {t('common.back')}
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
              <h2 className="text-2xl font-bold text-white">{t('profiles.editPage.gameInfo')}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profiles.editPage.displayName')}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profiles.editPage.displayNamePlaceholder')}
                  className="input-primary w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('profiles.editPage.displayNameHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('common.profile')}ID
                </label>
                <input
                  type="text"
                  value={profile.id}
                  disabled
                  className="input-primary w-full bg-dark-800/50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('profiles.editPage.internalIdLabel')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('common.description')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('profiles.editModal.descriptionPlaceholder')}
                  className="input-primary w-full"
                />
              </div>
            </div>
            
            {/* ゲーム情報カード */}
            {hasGame ? (
              <div className="mt-6 bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <Package className="w-5 h-5 text-resonite-blue" />
                    <span>{t('profiles.editPage.gameInfo')}</span>
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary flex items-center space-x-2"
                    onClick={() => setShowGameUpdateModal(true)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{t('profiles.editPage.versionChange')}</span>
                  </motion.button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-dark-600/50">
                    <span className="text-gray-400">{t('common.branch')}</span>
                    <span className="text-white font-medium">{currentBranch}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-dark-600/50">
                    <span className="text-gray-400">{t('profiles.editPage.currentVersionLabel')}{t('common.version')}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-mono text-sm">
                        {currentGameVersion || t('profiles.editPage.unknown')}
                      </span>
                      {hasNewerGameVersion() && (() => {
                        const latestVersion = getLatestGameVersionInfo();
                        return latestVersion && (
                          <span className="text-blue-300 text-xs">
                            → v{latestVersion.gameVersion}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {profileInfo?.manifest_id && (
                    <div className="flex justify-between items-center py-2 border-b border-dark-600/50">
                      <span className="text-gray-400">マニフェストID</span>
                      <span className="text-gray-300 font-mono text-xs">
                        {profileInfo.manifest_id}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">{t('common.status')}</span>
                    <div className="flex items-center space-x-2">
                      <span className="status-success">{t('profiles.installed')}</span>
                      {hasNewerGameVersion() && (
                        <span className="status-info text-xs flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                          <span>{t('profiles.updateAvailable')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {hasNewerGameVersion() && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-blue-300 font-medium mb-1">{t('profiles.newVersionAvailable')}</p>
                        <p className="text-blue-200">
                          {t('profiles.editPage.updateVersionNote')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!hasNewerGameVersion() && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-blue-300">
                          {t('profiles.editPage.updateVersionNote')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ゲーム未インストール時の表示 */
              <div className="mt-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-orange-400 flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>{t('profiles.editPage.gameNotInstalled')}</span>
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-orange-200 mb-2">
                        このプロファイルにはResoniteがインストールされていません。
                      </p>
                      <p className="text-orange-200 text-sm">
                        {t('profiles.editPage.gameNotInstalledNote')}
                      </p>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary w-full flex items-center justify-center space-x-2"
                    onClick={() => setShowGameInstallModal(true)}
                    disabled={isInstallingGame}
                  >
                    {isInstallingGame ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>Resoniteをインストール</span>
                  </motion.button>
                </div>
              </div>
            )}
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
              <h2 className="text-2xl font-bold text-white">{t('profiles.editModal.launchArgs.title')}</h2>
            </div>
            
            {!hasGame ? (
              /* ゲーム未インストール時の警告 */
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-orange-400 font-medium mb-2">{t('profiles.editPage.gameNotInstalledWarning')}</h4>
                    <p className="text-orange-200 text-sm">
                      {t('profiles.editPage.installGameFirst')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <LaunchArgumentsEditor
                args={args}
                onArgsChange={setArgs}
              />
            )}
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
              <h2 className="text-2xl font-bold text-white">{t('profiles.editPage.modManagement')}</h2>
            </div>

            {!hasGame ? (
              /* ゲーム未インストール時の警告 */
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-orange-400 font-medium mb-2">{t('home.launcher.notInstalled')}</h4>
                    <p className="text-orange-200 text-sm">
                      {t('profiles.editPage.modManagementWarning')}
                    </p>
                  </div>
                </div>
              </div>
            ) : !modLoaderInfo?.installed ? (
              /* MODローダー未インストール時の警告 */
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-yellow-400 font-medium mb-2">{t('profiles.editPage.modLoaderRequired')}</h4>
                    <p className="text-yellow-200 text-sm mb-4">
                      {t('profiles.editPage.modLoaderRequiredDescription')}
                    </p>
                    
                    {/* MODローダータイプ選択 */}
                    <div className="mb-4">
                      <label className="text-gray-300 text-sm mb-2 block">{t('profiles.editPage.selectModLoader')}</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="modLoaderType"
                            value="ResoniteModLoader"
                            checked={selectedModLoaderType === 'ResoniteModLoader'}
                            onChange={(e) => setSelectedModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader')}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-300">Resonite Mod Loader (RML)</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="modLoaderType"
                            value="MonkeyLoader"
                            checked={selectedModLoaderType === 'MonkeyLoader'}
                            onChange={(e) => setSelectedModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader')}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-300">MonkeyLoader</span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {selectedModLoaderType === 'ResoniteModLoader' 
                          ? t('profiles.editPage.rmlDescription')
                          : t('profiles.editPage.monkeyLoaderDescription')}
                      </p>
                    </div>
                    
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
                      <span>{selectedModLoaderType}をインストール</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              /* MOD管理メニュー */
              <div className="space-y-6">
                {/* インストール済みMODローダー情報 */}
                {modLoaderInfo?.installed && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Package className="w-5 h-5 text-green-400" />
                        <div>
                          <h4 className="text-green-400 font-medium">
                            {t('profiles.editPage.modLoaderInstalled', { type: modLoaderInfo.loader_type === 'MonkeyLoader' ? 'MonkeyLoader' : 'Resonite Mod Loader' })}
                          </h4>
                          <p className="text-green-200 text-sm">
                            {t('common.version')}: {modLoaderInfo.version || t('profiles.editPage.unknown')}
                            {profile?.config_version && profile.config_version < 2 && (
                              <span className="ml-2 text-yellow-300">({t('profiles.editPage.migrated')})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-secondary text-xs flex items-center space-x-1"
                        onClick={uninstallModLoader}
                        disabled={isLoadingModLoader}
                      >
                        {isLoadingModLoader ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>アンインストール</span>
                      </motion.button>
                    </div>
                  </div>
                )}
                
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
                    <span className="font-medium">{t('profiles.editPage.manage')}</span>
                  </motion.button>
                </div>

                {/* インストールタブのコンテンツ */}
                {modActiveTab === 'install' && (
                  <div className="space-y-6">
                    {/* 手動MODインストール */}
                    <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                        <Github className="w-5 h-5" />
                        <span>{t('profiles.editPage.manualModInstall')}</span>
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
                        {t('profiles.editPage.githubUrlHint')}
                      </p>
                    </div>

                    {/* 利用可能なMOD一覧 */}
                    <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">{t('profiles.editPage.availableMods')}</h3>
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
                          <span>{t('profiles.editPage.fetchModList')}</span>
                        </motion.button>
                      </div>

                      {availableMods.length > 0 && (
                        <div className="mb-4">
                          <input
                            type="text"
                            value={modSearchQuery}
                            onChange={(e) => setModSearchQuery(e.target.value)}
                            placeholder={t('profiles.editPage.searchMods')}
                            className="input-primary w-full"
                          />
                        </div>
                      )}

                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {modsLoading ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-resonite-blue animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">{t('profiles.editPage.fetchingMods')}</p>
                          </div>
                        ) : availableMods.length === 0 ? (
                          <div className="text-center py-8">
                            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">{t('profiles.editPage.fetchModsFirst')}</p>
                            <p className="text-gray-500 text-sm">{t('profiles.editPage.fetchModsHint')}</p>
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
                                    <p className="text-gray-400 text-xs">{t('profiles.editPage.byAuthor')} {mod.author} • {mod.releases.length} {t('profiles.editPage.releases')}</p>
                                    <p className="text-gray-300 text-xs truncate">{mod.description}</p>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2 ml-3">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-secondary text-xs p-1.5"
                                      onClick={() => open(mod.source_location)}
                                      title="Open in GitHub"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </motion.button>
                                    
                                    {/* カスタムインストールボタン */}
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-secondary text-xs p-1.5"
                                      onClick={() => handleAvailableModInstallClick(mod)}
                                      disabled={installModMutation.isPending || mod.releases.length === 0}
                                      title={t('profiles.editPage.selectVersionToInstall')}
                                    >
                                      <Settings className="w-3 h-3" />
                                    </motion.button>
                                    
                                    {/* 最新版インストールボタン */}
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="btn-primary text-xs flex items-center space-x-1 px-3 py-1.5"
                                      onClick={() => handleInstallLatestClick(mod)}
                                      disabled={installModMutation.isPending || mod.releases.length === 0}
                                      title={t('profiles.editPage.installLatest')}
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
                          <h3 className="text-lg font-semibold text-orange-400">{t('profiles.editPage.unmangedMods')}</h3>
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
                              <span>{t('profiles.editPage.addAllToManagement')}</span>
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
                              <span>{t('profiles.editPage.rescan')}</span>
                            </motion.button>
                          </div>
                        </div>
                        
                        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                          <p className="text-orange-300 text-sm">
                            {t('profiles.editPage.unmangedModsWarning')}
                            {t('profiles.editPage.versionControlNote')}
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
                                  <p className="text-gray-400 text-sm">{t('profiles.editPage.fileSize')}: {mod.file_name}</p>
                                  <p className="text-gray-500 text-xs">
                                    {t('profiles.editPage.size')}: {(mod.file_size / 1024 / 1024).toFixed(2)}MB | 
                                    {t('profiles.editPage.updated')}: {mod.modified_time}
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
                                  <span>{t('common.add')}</span>
                                </motion.button>
                              </div>
                              
                              {/* ハッシュベースのバージョン検出情報 */}
                              {mod.detected_version && (
                                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                                  <p className="text-blue-300 text-sm">
                                    {t('profiles.editPage.detectedVersion')} <span className="font-mono">{mod.detected_version}</span>
                                  </p>
                                  <p className="text-blue-200 text-xs mt-1">
                                    {t('profiles.editPage.detectedVersionNote')}
                                  </p>
                                </div>
                              )}
                              
                              {mod.matched_mod_info ? (
                                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="text-green-400 font-medium">{t('profiles.editPage.matchedModInfo')}</h5>
                                      <p className="text-green-300 text-sm">{mod.matched_mod_info.name}</p>
                                      <p className="text-green-200 text-xs">{mod.matched_mod_info.description}</p>
                                      <p className="text-green-200 text-xs">{t('profiles.editPage.byAuthor')} {mod.matched_mod_info.author}</p>
                                      {mod.matched_mod_info.latest_version && (
                                        <p className="text-green-200 text-xs">{t('profiles.editPage.latestVersion')} {mod.matched_mod_info.latest_version}</p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn-secondary text-xs"
                                        onClick={() => open(mod.matched_mod_info!.source_location)}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </motion.button>
                                    </div>
                                  </div>
                                </div>
                              ) : !mod.detected_version && (
                                <div className="mt-3 p-3 bg-gray-500/10 border border-gray-500/30 rounded">
                                  <p className="text-gray-400 text-sm">
                                    {t('profiles.editPage.noMatchFound')}
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
                      <h3 className="text-lg font-semibold text-white mb-4">{t('profiles.editPage.installedMods')}</h3>
                      
                      <div className="space-y-3">
                        {installedMods.length === 0 ? (
                          <div className="text-center py-8">
                            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">{t('profiles.editPage.noInstalledMods')}</p>
                            <p className="text-gray-500 text-sm">{t('profiles.editPage.installModsFirst')}</p>
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
                                  <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                                    <h4 className="text-white font-medium">{mod.name}</h4>
                                    
                                    {/* MODローダータイプとファイル形式のチップ */}
                                    {(mod.mod_loader_type || mod.file_format) && (
                                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                                        mod.file_format === 'nupkg'
                                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      }`}>
                                        {mod.file_format === 'nupkg' ? 'ML' : 'RML'}
                                      </span>
                                    )}
                                    
                                    {/* MOD有効/無効状態 */}
                                    {mod.enabled === false && (
                                      <span className="inline-flex items-center text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-0.5 rounded-full">
                                        {t('profiles.editPage.disabled')}
                                      </span>
                                    )}
                                    
                                    {hasNewerVersion(mod) && (
                                      <span className="inline-flex items-center text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1"></span>
                                        {t('profiles.editPage.updateAvailable')}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-400 text-sm">
                                    {t('common.version')}: {mod.installed_version}
                                    {hasNewerVersion(mod) && (() => {
                                      const manifestMod = availableMods.find(m => 
                                        m.name === mod.name || m.source_location === mod.source_location
                                      );
                                      return manifestMod?.latest_version && (
                                        <span className="text-blue-300 ml-2">
                                          → {manifestMod.latest_version} {t('profiles.editPage.available')}
                                        </span>
                                      );
                                    })()}
                                  </p>
                                  <p className="text-gray-500 text-xs">{t('profiles.editPage.installDate')} {mod.installed_date}</p>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="btn-secondary text-xs"
                                    onClick={() => open(mod.source_location)}
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
                                    title={hasNewerVersion(mod) ? t('profiles.editPage.newVersionAvailable') : t('profiles.editPage.changeVersion')}
                                  >
                                    {loadingManualVersions === mod.name ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Edit className="w-3 h-3" />
                                    )}
                                    <span>{t('profiles.editPage.changeVersion')}</span>
                                    {hasNewerVersion(mod) && (
                                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                    )}
                                  </motion.button>
                                  
                                  {/* MOD有効化/無効化ボタン */}
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`text-xs flex items-center space-x-1 ${
                                      mod.enabled === false ? 'btn-primary' : 'btn-secondary'
                                    }`}
                                    onClick={() => mod.enabled === false ? enableMod(mod.name) : disableMod(mod.name)}
                                    disabled={disableModMutation.isPending || enableModMutation.isPending}
                                    title={mod.enabled === false ? t('profiles.editPage.enableMod') : t('profiles.editPage.disableMod')}
                                  >
                                    {disableModMutation.isPending || enableModMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : mod.enabled === false ? (
                                      <Eye className="w-3 h-3" />
                                    ) : (
                                      <EyeOff className="w-3 h-3" />
                                    )}
                                    <span>{mod.enabled === false ? t('profiles.editPage.enable') : t('profiles.editPage.disable')}</span>
                                  </motion.button>
                                  
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="btn-danger text-xs flex items-center space-x-1"
                                    onClick={() => uninstallMod(mod.name)}
                                    disabled={uninstallModMutation.isPending}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('common.delete')}</span>
                                  </motion.button>
                                </div>
                              </div>
                              
                              {mod.description && (
                                <p className="text-gray-300 text-sm">{mod.description}</p>
                              )}
                              
                              {/* バージョン選択UI */}
                              {selectedModForVersions?.name === mod.name && (
                                <div className="mt-4 p-3 bg-dark-600/30 border border-dark-500/30 rounded-lg">
                                  <h5 className="text-white font-medium mb-2">{t('profiles.editPage.versionSelection')}</h5>
                                  {(versionsLoading || loadingManualVersions === mod.name) ? (
                                    <div className="flex items-center space-x-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span className="text-gray-400">{t('profiles.editPage.fetchingVersions')}</span>
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
                                        <p className="text-gray-400 text-sm">{t('profiles.editPage.noVersionsAvailable')}</p>
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
                                            <span>{t('profiles.editPage.fetchFromGithub')}</span>
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
                                      {t('common.close')}
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
              <h2 className="text-2xl font-bold text-white">{t('profiles.editPage.otherSettings')}</h2>
            </div>

            {!hasGame ? (
              /* ゲーム未インストール時の警告 */
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-orange-400 font-medium mb-2">ゲームがインストールされていません</h4>
                    <p className="text-orange-200 text-sm">
                      {t('profiles.editPage.otherSettingsWarning')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
              {/* yt-dlp管理 */}
              <div className="bg-dark-800/30 border border-dark-600/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Download className="w-5 h-5 text-resonite-blue" />
                  <span>{t('profiles.editPage.ytdlpManagement')}</span>
                </h3>
                
                {ytDlpLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-gray-400">{t('profiles.editPage.checkingYtdlp')}</span>
                  </div>
                ) : ytDlpInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-dark-700/30 border border-dark-600/30 rounded-lg">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-white font-medium">yt-dlp.exe</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          {t('common.version')}: {ytDlpInfo.version || t('profiles.editPage.unknown')}
                        </p>
                        {ytDlpInfo.path && (
                          <p className="text-gray-500 text-xs">
                            {t('profiles.editPage.ytdlpPath')}
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
                          <span>{t('profiles.editPage.checkUpdate')}</span>
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
                    <p className="text-gray-400">{t('profiles.editPage.ytdlpStatusFailed')}</p>
                  </div>
                )}
              </div>

              {/* その他の設定エリア */}
              <div className="bg-dark-800/30 rounded-lg p-8 text-center">
                <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">{t('profiles.editPage.detailedSettings')}</p>
                <p className="text-gray-500">{t('profiles.editPage.detailedSettingsNote')}</p>
              </div>
            </div>
            )}
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
            <span>{t('common.back')}</span>
          </motion.button>
          
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{t('profiles.editPage.profileManagement')}</span>
            <span>/</span>
            <span className="text-white font-medium">{profile.display_name}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">

          {/* アクションドロップダウン */}
          <ProfileActionsDropdown
            profileName={profileName}
            isReloading={installedModsLoading || unmanagedModsLoading || migrateInstalledModsMutation.isPending || migrateProfileConfigMutation.isPending}
            onDuplicate={() => {
              setDuplicateName(`${profile?.display_name || profileName} - Copy`);
              setDuplicateDescription(profile?.description || '');
              setShowDuplicateModal(true);
            }}
            onDelete={() => setShowDeleteConfirmModal(true)}
            onOpenFolder={openProfileFolder}
            onReload={async () => {
              // プロファイル設定とMODデータのマイグレーションを実行してからリフェッチ
              await Promise.all([
                migrateProfileConfigMutation.mutateAsync(profileName),
                migrateInstalledModsMutation.mutateAsync(profileName)
              ]);
              refetchInstalledMods();
              refetchUnmanagedMods();
            }}
            showDeleteOption={profileName !== 'default'}
          />

          
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
            <span>{t('common.save')}</span>
          </motion.button>


          {/* 起動ボタン */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center space-x-2 ${
              hasGame 
                ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500 px-4 py-2 rounded-lg transition-colors duration-200' 
                : 'btn-secondary opacity-50 cursor-not-allowed'
            }`}
            onClick={handleLaunch}
            disabled={!hasGame || launchMutation.isPending}
            title={hasGame ? t('profiles.editPage.launchResonite') : t('profiles.editPage.gameNotInstalledWarning')}
          >
            {launchMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{t('profiles.editPage.launch')}</span>
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
          const isDisabled = !hasGame && (tab.id === 'launch' || tab.id === 'mods' || tab.id === 'other');
          
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: isDisabled ? 1 : 1.02 }}
              whileTap={{ scale: isDisabled ? 1 : 0.98 }}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-resonite-blue text-white shadow-lg'
                  : isDisabled
                  ? 'text-gray-600 cursor-not-allowed bg-dark-800/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
              }`}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              title={isDisabled ? t('profiles.editPage.installGamePlaceholder') : undefined}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
              {isDisabled && (
                <span className="ml-1 text-orange-400">
                  <Info className="w-3 h-3" />
                </span>
              )}
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
              <p className="text-white font-medium">{t('profiles.editPage.unsavedChanges')}</p>
              <p className="text-gray-300 text-sm">{t('profiles.editPage.unsavedChangesNote')}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary"
              onClick={saveProfile}
              disabled={isSaving}
            >
              {t('common.save')}
            </motion.button>
          </div>
        </motion.div>
      )}
      
      {/* MOD Risk Warning Modal */}
      <ModRiskWarningModal
        isOpen={showModRiskModal}
        onClose={handleModRiskCancel}
        onConfirm={handleModRiskConfirm}
        title={`${selectedModLoaderType === 'MonkeyLoader' ? 'MonkeyLoader' : 'Resonite Mod Loader'}のインストール`}
      />
      
      {/* Game Update Modal */}
      <GameUpdateModal
        isOpen={showGameUpdateModal}
        onClose={() => setShowGameUpdateModal(false)}
        onUpdate={handleGameUpdate}
        profileName={profile?.display_name || profileName}
        currentVersion={currentGameVersion || undefined}
        currentBranch={currentBranch}
        isLoading={false}
      />
      
      {/* Game Install Modal */}
      <GameInstallModal
        isOpen={showGameInstallModal}
        onClose={() => setShowGameInstallModal(false)}
        onInstall={handleGameInstall}
        profileName={profile?.display_name || profileName}
        isLoading={isInstallingGame}
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
                {selectedAvailableModForVersions.name} - {t('common.install')}
              </h3>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary text-sm"
                onClick={() => setSelectedAvailableModForVersions(null)}
              >
                {t('common.close')}
              </motion.button>
            </div>
            
            {availableVersionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-resonite-blue" />
                <span className="ml-2 text-gray-400">{t('profiles.editPage.fetchingVersions')}</span>
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
                <p className="text-gray-400">{t('profiles.editPage.noVersionsAvailable')}</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* カスタムMODバージョン選択モーダル */}
      {selectedCustomModUrl && customModVersions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-dark-800 rounded-lg p-6 max-w-md w-full mx-4 border border-dark-600"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">{t('modLoader.versionSelector.selectVersion')}</h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setSelectedCustomModUrl('');
                  setCustomModVersions([]);
                  setSelectedInstallVersion('');
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </motion.button>
            </div>

            <div className="space-y-4">
              <ModVersionSelector
                mod={{
                  name: selectedCustomModUrl.split('/').pop() || 'Custom MOD',
                  description: 'Manual install from GitHub repository',
                  source_location: selectedCustomModUrl,
                  installed_version: '',
                  installed_date: new Date().toISOString(),
                  dll_path: ''
                }}
                availableVersions={customModVersions}
                onVersionSelect={handleAvailableModVersionSelect}
                isLoading={isInstallingMod !== null}
              />
              
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center space-x-2"
                  onClick={handleCustomModInstallButtonClick}
                  disabled={isInstallingMod !== null || !selectedInstallVersion}
                >
                  {isInstallingMod ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>インストール</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* プロファイル複製モーダル */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-dark-800 rounded-lg p-6 max-w-md w-full mx-4 border border-dark-600"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Copy className="w-5 h-5 text-resonite-blue" />
                <span>{t('profiles.editPage.duplicateModal.title')}</span>
              </h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateName('');
                  setDuplicateDescription('');
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </motion.button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profiles.editPage.duplicateModal.newName')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-400 focus:border-resonite-blue focus:outline-none"
                  placeholder={t('profiles.editPage.duplicateModal.newNamePlaceholder')}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('common.description')}
                </label>
                <textarea
                  value={duplicateDescription}
                  onChange={(e) => setDuplicateDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-400 focus:border-resonite-blue focus:outline-none resize-none"
                  placeholder={t('profiles.editPage.duplicateModal.newDescriptionPlaceholder')}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="bg-dark-700/30 border border-dark-600/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-200 text-sm">
                      {t('profiles.editPage.duplicateModal.duplicateNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateName('');
                  setDuplicateDescription('');
                }}
                disabled={isDuplicating}
              >
                {t('common.cancel')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex items-center space-x-2"
                onClick={handleDuplicate}
                disabled={isDuplicating || !duplicateName.trim()}
              >
                {isDuplicating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{isDuplicating ? t('profiles.editPage.duplicateModal.duplicating') : t('profiles.editPage.duplicate')}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* 複数ファイルインストールモーダル */}
      <MultiFileInstallModal
        isOpen={showMultiFileModal}
        onClose={() => {
          setShowMultiFileModal(false);
          setMultiFileInstallRequest(null);
        }}
        onConfirm={handleMultiFileInstall}
        onVersionChange={handleMultiFileVersionChange}
        installRequest={multiFileInstallRequest}
      />
      
      {/* 削除確認モーダル */}
      <ProfileDeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        profileName={profile?.display_name || profileName}
        onConfirm={handleDeleteProfile}
        onCancel={() => setShowDeleteConfirmModal(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default ProfileEditPage;