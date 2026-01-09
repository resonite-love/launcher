import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { SteamNewsResponse, UpdateNote } from '../types/steam-news';

interface AppStatus {
  initialized: boolean;
  depot_downloader_available: boolean;
  exe_dir: string | null;
  is_first_run: boolean;
}

interface Profile {
  id: string;
  display_name: string;
  name?: string; // 互換性のため
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
  has_mod_loader: boolean;
  mod_loader_type?: 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader';
}

interface SteamCredentials {
  username: string;
  password: string;
}

export interface GameInstallRequest {
  profile_name: string;
  branch: string;
  manifest_id?: string;
  username?: string;
  password?: string;
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

interface InstalledMod {
  name: string;
  description: string;
  source_location: string;
  installed_version: string;
  installed_date: string;
  dll_path: string;
  mod_loader_type?: 'ResoniteModLoader' | 'MonkeyLoader';
  file_format?: string;
  enabled?: boolean;
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

interface YtDlpInfo {
  installed: boolean;
  version?: string;
  path?: string;
}

// Query Keys
export const queryKeys = {
  appStatus: ['appStatus'] as const,
  profiles: ['profiles'] as const,
  steamCredentials: ['steamCredentials'] as const,
  steamNews: ['steamNews'] as const,
  modManifest: (profileName: string) => ['modManifest', profileName] as const,
  installedMods: (profileName: string) => ['installedMods', profileName] as const,
  modVersions: (profileName: string, modName: string) => ['modVersions', profileName, modName] as const,
  unmanagedMods: (profileName: string) => ['unmanagedMods', profileName] as const,
  upgradeableMods: (profileName: string) => ['upgradeableMods', profileName] as const,
  ytDlpStatus: (profileName: string) => ['ytDlpStatus', profileName] as const,
  thunderstorePackages: (profileName: string) => ['thunderstorePackages', profileName] as const,
  bepisLoaderStatus: (profileName: string) => ['bepisLoaderStatus', profileName] as const,
};

// App Status
export const useAppStatus = () => {
  const { setAppStatus } = useAppStore();
  
  return useQuery({
    queryKey: queryKeys.appStatus,
    queryFn: async (): Promise<AppStatus> => {
      const status = await invoke<AppStatus>('initialize_app');
      setAppStatus(status);
      return status;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
};

// Profiles
export const useProfiles = () => {
  const { setProfiles } = useAppStore();
  
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: async (): Promise<Profile[]> => {
      const profiles = await invoke<Profile[]>('get_profiles');
      setProfiles(profiles);
      return profiles;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Steam Credentials
export const useSteamCredentials = () => {
  const { setSteamCredentials } = useAppStore();
  
  return useQuery({
    queryKey: queryKeys.steamCredentials,
    queryFn: async (): Promise<SteamCredentials | null> => {
      const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
      setSteamCredentials(credentials);
      return credentials;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Helper function to convert BBCode to Markdown
const convertBBCodeToMarkdown = (content: string): string => {
  return content
    // Convert headers
    .replace(/\[h2\](.*?)\[\/h2\]/g, '## $1')
    .replace(/\[h3\](.*?)\[\/h3\]/g, '### $1')
    .replace(/\[h1\](.*?)\[\/h1\]/g, '# $1')
    // Convert bold/italic
    .replace(/\[b\](.*?)\[\/b\]/g, '**$1**')
    .replace(/\[i\](.*?)\[\/i\]/g, '*$1*')
    // Convert links
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/g, '[$2]($1)')
    // Convert lists - handle both [list] and direct bullet points
    .replace(/\[list\](.*?)\[\/list\]/gs, (_, listContent) => {
      return listContent.replace(/\[\*\]/g, '-');
    })
    // Handle standalone [*] items (convert to markdown bullets)
    .replace(/\[\*\]/g, '-')
    // Clean up any remaining BBCode tags
    .replace(/\[[^\]]*\]/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

// Helper function to parse steam news content
const parseSteamNewsContent = (newsItem: any): UpdateNote => {
  const content = newsItem.contents || '';
  
  // Extract version from title (e.g., "2025.6.17.623 - Improvements and fixes")
  const versionMatch = newsItem.title.match(/^(\d{4}\.\d{1,2}\.\d{1,2}\.\d+)/);
  const version = versionMatch ? versionMatch[1] : undefined;
  
  // Convert BBCode to Markdown
  const markdownContent = convertBBCodeToMarkdown(content);
  
  // Parse sections from markdown content
  const sections: any[] = [];
  const sectionRegex = /## (.+?)\n((?:(?!##).*\n?)*)/g;
  let match;
  
  while ((match = sectionRegex.exec(markdownContent)) !== null) {
    const title = match[1].trim();
    const sectionContent = match[2].trim();
    
    // Extract list items from this section
    const listItems = sectionContent
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(item => item.length > 0);
    
    if (listItems.length > 0) {
      sections.push({
        title,
        items: listItems
      });
    }
  }
  
  // Format date
  const date = new Date(newsItem.date * 1000);
  const formattedDate = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return {
    gid: newsItem.gid,
    title: newsItem.title,
    version,
    date: newsItem.date_formatted,
    formattedDate,
    author: newsItem.author,
    url: newsItem.url,
    parsedContent: {
      version,
      sections,
      rawContent: markdownContent
    },
    rawContent: markdownContent
  };
};

// Steam News
export const useSteamNews = () => {
  return useQuery({
    queryKey: queryKeys.steamNews,
    queryFn: async (): Promise<UpdateNote[]> => {
      const response = await invoke<SteamNewsResponse>('fetch_steam_news');
      
      // Parse and transform the news items
      const updateNotes = response.newsitems
        .slice(0, 10) // Limit to 10 most recent items
        .map(parseSteamNewsContent)
        .filter(note => note.version); // Only include items with version numbers
      
      return updateNotes;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

// Mutations
export const useCreateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      return await invoke<string>('create_profile', { name, description });
    },
    onSuccess: (result) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
    onError: (error) => {
      toast.error(`プロファイルの作成に失敗しました: ${error}`);
    },
  });
};

export const useLaunchResonite = () => {
  const { setIsLaunching } = useAppStore();
  
  return useMutation({
    mutationFn: async (profileName: string) => {
      setIsLaunching(true);
      try {
        return await invoke<string>('launch_resonite', { profileName });
      } finally {
        setIsLaunching(false);
      }
    },
    onSuccess: (result) => {
      toast.success(result);
    },
    onError: (error) => {
      toast.error(`起動に失敗しました: ${error}`);
    },
  });
};

export const useInstallGame = () => {
  const { setIsInstalling, addInstallingProfile, removeInstallingProfile } = useAppStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: GameInstallRequest) => {
      setIsInstalling(true);
      addInstallingProfile(request.profile_name);
      try {
        return await invoke<string>('install_game_to_profile_interactive', { request });
      } finally {
        setIsInstalling(false);
        removeInstallingProfile(request.profile_name);
      }
    },
    onSuccess: (result) => {
      toast.success(result);
      // Invalidate profiles to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
    onError: (error) => {
      toast.error(`ゲームのインストールに失敗しました: ${error}`);
    },
  });
};

export const useUpdateGame = () => {
  const { setIsUpdating, addInstallingProfile, removeInstallingProfile } = useAppStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: GameInstallRequest) => {
      setIsUpdating(true);
      addInstallingProfile(request.profile_name);
      try {
        return await invoke<string>('update_profile_game_interactive', { request });
      } finally {
        setIsUpdating(false);
        removeInstallingProfile(request.profile_name);
      }
    },
    onSuccess: (result) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
    onError: (error) => {
      toast.error(`ゲームの更新に失敗しました: ${error}`);
    },
  });
};

export const useSaveSteamCredentials = () => {
  const queryClient = useQueryClient();
  const { setSteamCredentials } = useAppStore();
  
  return useMutation({
    mutationFn: async (credentials: SteamCredentials) => {
      const result = await invoke<string>('save_steam_credentials', { credentials });
      setSteamCredentials(credentials);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.steamCredentials });
    },
    onError: (error) => {
      toast.error(`クレデンシャルの保存に失敗しました: ${error}`);
    },
  });
};

export const useClearSteamCredentials = () => {
  const queryClient = useQueryClient();
  const { setSteamCredentials } = useAppStore();
  
  return useMutation({
    mutationFn: async () => {
      const result = await invoke<string>('clear_steam_credentials');
      setSteamCredentials(null);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.steamCredentials });
    },
    onError: (error) => {
      toast.error(`クレデンシャルの削除に失敗しました: ${error}`);
    },
  });
};

// MOD Management Queries
export const useModManifest = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.modManifest(profileName),
    queryFn: async (): Promise<ModInfo[]> => {
      return await invoke<ModInfo[]>('fetch_mod_manifest', { profileName });
    },
    enabled: !!profileName, // Enable auto-fetch when profileName is available
    staleTime: 10 * 60 * 1000, // 10 minutes - matches backend cache
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: 3, // Retry failed requests
  });
};

export const useInstalledMods = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.installedMods(profileName),
    queryFn: async (): Promise<InstalledMod[]> => {
      return await invoke<InstalledMod[]>('get_installed_mods', { profileName });
    },
    enabled: !!profileName,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useModVersions = (profileName: string, modInfo: ModInfo | null) => {
  return useQuery({
    queryKey: queryKeys.modVersions(profileName, modInfo?.name || ''),
    queryFn: async (): Promise<ModRelease[]> => {
      if (!modInfo) return [];
      return await invoke<ModRelease[]>('get_mod_versions', { profileName, modInfo });
    },
    enabled: !!profileName && !!modInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// MOD Management Mutations
export const useInstallMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modInfo, version }: { 
      profileName: string; 
      modInfo: ModInfo; 
      version?: string 
    }) => {
      return await invoke<InstalledMod>('install_mod_from_cache', { 
        profileName, 
        modInfo, 
        version 
      });
    },
    onSuccess: (result, variables) => {
      toast.success(`MOD「${result.name}」をインストールしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODのインストールに失敗しました: ${error}`);
    },
  });
};

export const useUninstallMod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileName, modName, sourceLocation }: { profileName: string; modName: string; sourceLocation?: string }) => {
      return await invoke<string>('uninstall_mod', { profileName, modName, sourceLocation });
    },
    onSuccess: (result, variables) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODのアンインストールに失敗しました: ${error}`);
    },
  });
};

export interface MultiFileInstallRequest {
  assets: GitHubAsset[];
  available_destinations: FileDestination[];
  releases: GitHubRelease[];
  selected_version: string;
}

export interface FileDestination {
  path: string;
  description: string;
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
  download_count?: number;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
}

export interface FileInstallChoice {
  asset_name: string;
  destination_path: string;
}

export interface UpgradeableMod {
  name: string;
  current_version: string;
  latest_version: string;
  description: string;
  source_location: string;
}

export const useCheckMultiFileInstall = () => {
  return useMutation({
    mutationFn: async ({ repoUrl, version }: { repoUrl: string; version?: string }) => {
      return await invoke<MultiFileInstallRequest | null>('check_multi_file_install', { 
        repoUrl, 
        version 
      });
    },
    onError: (error) => {
      toast.error(`複数ファイルチェックに失敗しました: ${error}`);
    },
  });
};

export const useInstallMultipleFiles = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      profileName, 
      repoUrl, 
      version, 
      choices 
    }: { 
      profileName: string; 
      repoUrl: string; 
      version?: string; 
      choices: FileInstallChoice[] 
    }) => {
      return await invoke<InstalledMod[]>('install_multiple_files', { 
        profileName, 
        repoUrl, 
        version, 
        choices 
      });
    },
    onSuccess: (result, variables) => {
      const count = result.length;
      toast.success(`${count}個のファイルをインストールしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`複数ファイルのインストールに失敗しました: ${error}`);
    },
  });
};

export const useDisableMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modName }: { profileName: string; modName: string }) => {
      return await invoke<string>('disable_mod', { profileName, modName });
    },
    onSuccess: (result, variables) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの無効化に失敗しました: ${error}`);
    },
  });
};

export const useEnableMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modName }: { profileName: string; modName: string }) => {
      return await invoke<string>('enable_mod', { profileName, modName });
    },
    onSuccess: (result, variables) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの有効化に失敗しました: ${error}`);
    },
  });
};

export const useMigrateInstalledMods = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profileName: string) => {
      return await invoke<string>('migrate_installed_mods', { profileName });
    },
    onSuccess: (result, profileName) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(profileName) });
    },
    onError: (error) => {
      toast.error(`MODデータのマイグレーションに失敗しました: ${error}`);
    },
  });
};

export const useMigrateProfileConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profileName: string) => {
      return await invoke<string>('migrate_profile_config', { profileName });
    },
    onSuccess: (result, profileName) => {
      toast.success(result);
      // プロファイル設定とMOD情報を更新
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(profileName) });
    },
    onError: (error) => {
      toast.error(`プロファイル設定のマイグレーションに失敗しました: ${error}`);
    },
  });
};

export const useUpdateMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modName, targetVersion }: { 
      profileName: string; 
      modName: string; 
      targetVersion: string 
    }) => {
      return await invoke<InstalledMod>('update_mod', { profileName, modName, targetVersion });
    },
    onSuccess: (result, variables) => {
      toast.success(`MOD「${result.name}」をバージョン${result.installed_version}に更新しました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの更新に失敗しました: ${error}`);
    },
  });
};

export const useDowngradeMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modName, targetVersion }: { 
      profileName: string; 
      modName: string; 
      targetVersion: string 
    }) => {
      return await invoke<InstalledMod>('downgrade_mod', { profileName, modName, targetVersion });
    },
    onSuccess: (result, variables) => {
      toast.success(`MOD「${result.name}」をバージョン${result.installed_version}にダウングレードしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODのダウングレードに失敗しました: ${error}`);
    },
  });
};

export const useUpgradeMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, modName, targetVersion }: { 
      profileName: string; 
      modName: string; 
      targetVersion?: string 
    }) => {
      return await invoke<InstalledMod>('upgrade_mod', { profileName, modName, targetVersion });
    },
    onSuccess: (result, variables) => {
      toast.success(`MOD「${result.name}」をバージョン${result.installed_version}にアップグレードしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODのアップグレードに失敗しました: ${error}`);
    },
  });
};

// Get upgradeable MODs
export const useUpgradeableMods = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.upgradeableMods(profileName),
    queryFn: async (): Promise<UpgradeableMod[]> => {
      return await invoke<UpgradeableMod[]>('get_upgradeable_mods', { profileName });
    },
    enabled: !!profileName,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Bulk upgrade MODs
export const useBulkUpgradeMods = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName }: { profileName: string }) => {
      return await invoke<InstalledMod[]>('bulk_upgrade_mods', { profileName });
    },
    onSuccess: (result, variables) => {
      const count = result.length;
      toast.success(`${count}個のMODをアップグレードしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.upgradeableMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの一括アップグレードに失敗しました: ${error}`);
    },
  });
};

// Unmanaged MODs Query
export const useUnmanagedMods = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.unmanagedMods(profileName),
    queryFn: async (): Promise<UnmanagedMod[]> => {
      return await invoke<UnmanagedMod[]>('scan_unmanaged_mods', { profileName });
    },
    enabled: !!profileName,
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Add single unmanaged MOD to system
export const useAddUnmanagedMod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, unmanagedMod }: { 
      profileName: string; 
      unmanagedMod: UnmanagedMod 
    }) => {
      return await invoke<InstalledMod>('add_unmanaged_mod_to_system', { 
        profileName, 
        unmanagedMod 
      });
    },
    onSuccess: (result, variables) => {
      toast.success(`「${result.name}」を管理システムに追加しました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの追加に失敗しました: ${error}`);
    },
  });
};

// Add all unmanaged MODs to system
export const useAddAllUnmanagedMods = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ profileName, unmanagedMods }: { 
      profileName: string; 
      unmanagedMods: UnmanagedMod[] 
    }) => {
      return await invoke<InstalledMod[]>('add_all_unmanaged_mods_to_system', { 
        profileName, 
        unmanagedMods 
      });
    },
    onSuccess: (result, variables) => {
      const count = result.length;
      toast.success(`${count}個のMODを管理システムに追加しました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.unmanagedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODの一括追加に失敗しました: ${error}`);
    },
  });
};

// yt-dlp Status Query
export const useYtDlpStatus = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.ytDlpStatus(profileName),
    queryFn: async (): Promise<YtDlpInfo> => {
      return await invoke<YtDlpInfo>('get_yt_dlp_status', { profileName });
    },
    enabled: !!profileName,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// yt-dlp Update Mutation
export const useUpdateYtDlp = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profileName: string) => {
      return await invoke<string>('update_yt_dlp', { profileName });
    },
    onSuccess: (result, profileName) => {
      toast.success(result);
      queryClient.invalidateQueries({ queryKey: queryKeys.ytDlpStatus(profileName) });
    },
    onError: (error) => {
      toast.error(`yt-dlpの更新に失敗しました: ${error}`);
    },
  });
};

// App update types
export interface AppUpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string;
  download_url: string;
  published_at: string;
  assets: UpdateAsset[];
}

export interface UpdateAsset {
  name: string;
  download_url: string;
  size: number;
}

// App update check hook
export const useAppUpdate = () => {
  return useQuery({
    queryKey: ['appUpdate'],
    queryFn: async () => {
      return await invoke<AppUpdateInfo>('check_for_app_update');
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
};

// Thunderstore Types
export interface ThunderstoreVersion {
  version_number: string;
  download_url: string;
  downloads: number;
  file_size: number;
  dependencies: string[];
  description: string;
  icon: string;
  date_created: string;
}

export interface ThunderstorePackage {
  name: string;
  full_name: string;
  owner: string;
  package_url: string;
  uuid4: string;
  rating_score: number;
  is_deprecated: boolean;
  categories: string[];
  versions: ThunderstoreVersion[];
}

export interface BepisLoaderStatus {
  installed: boolean;
  version?: string;
  hookfxr_enabled: boolean;
  plugins_dir: string;
  plugins_count: number;
}

// Thunderstore Packages Query
export const useThunderstorePackages = (profileName: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.thunderstorePackages(profileName),
    queryFn: async (): Promise<ThunderstorePackage[]> => {
      return await invoke<ThunderstorePackage[]>('fetch_thunderstore_packages', { profileName });
    },
    enabled: !!profileName && enabled,
    staleTime: 15 * 60 * 1000, // 15 minutes (matches backend cache)
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// BepisLoader Status Query
export const useBepisLoaderStatus = (profileName: string) => {
  return useQuery({
    queryKey: queryKeys.bepisLoaderStatus(profileName),
    queryFn: async (): Promise<BepisLoaderStatus> => {
      return await invoke<BepisLoaderStatus>('get_bepis_loader_status', { profileName });
    },
    enabled: !!profileName,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Install MOD from Thunderstore
export const useInstallThunderstoreMod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileName,
      packageFullName,
      version
    }: {
      profileName: string;
      packageFullName: string;
      version?: string;
    }) => {
      return await invoke<string[]>('install_mod_from_thunderstore', {
        profileName,
        packageFullName,
        version
      });
    },
    onSuccess: (_result, variables) => {
      toast.success(`${variables.packageFullName} をインストールしました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.bepisLoaderStatus(variables.profileName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.installedMods(variables.profileName) });
    },
    onError: (error) => {
      toast.error(`MODのインストールに失敗しました: ${error}`);
    },
  });
};