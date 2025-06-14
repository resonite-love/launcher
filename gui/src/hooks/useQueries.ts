import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';

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
}

interface SteamCredentials {
  username: string;
  password: string;
}

interface GameInstallRequest {
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
  modManifest: (profileName: string) => ['modManifest', profileName] as const,
  installedMods: (profileName: string) => ['installedMods', profileName] as const,
  modVersions: (profileName: string, modName: string) => ['modVersions', profileName, modName] as const,
  unmanagedMods: (profileName: string) => ['unmanagedMods', profileName] as const,
  ytDlpStatus: (profileName: string) => ['ytDlpStatus', profileName] as const,
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
  const { setIsInstalling } = useAppStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: GameInstallRequest) => {
      setIsInstalling(true);
      try {
        return await invoke<string>('install_game_to_profile_interactive', { request });
      } finally {
        setIsInstalling(false);
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
  const { setIsUpdating } = useAppStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: GameInstallRequest) => {
      setIsUpdating(true);
      try {
        return await invoke<string>('update_profile_game_interactive', { request });
      } finally {
        setIsUpdating(false);
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
    enabled: false, // Disable auto-fetch
    staleTime: 10 * 60 * 1000, // 10 minutes
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
    mutationFn: async ({ profileName, modName }: { profileName: string; modName: string }) => {
      return await invoke<string>('uninstall_mod', { profileName, modName });
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
interface AppUpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string;
  download_url: string;
  published_at: string;
  assets: UpdateAsset[];
}

interface UpdateAsset {
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
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
};