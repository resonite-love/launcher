import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';

interface AppStatus {
  initialized: boolean;
  depot_downloader_available: boolean;
  exe_dir: string | null;
}

interface Profile {
  name: string;
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
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

// Query Keys
export const queryKeys = {
  appStatus: ['appStatus'] as const,
  profiles: ['profiles'] as const,
  steamCredentials: ['steamCredentials'] as const,
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