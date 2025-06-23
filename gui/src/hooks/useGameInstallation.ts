import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { GameInstallRequest } from './useQueries';
import { useSteamCredentials } from './useQueries';
import { useAppStore } from '../store/useAppStore';

interface UseGameInstallationOptions {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: string) => void;
}

export const useGameInstallation = (options?: UseGameInstallationOptions) => {
  const { t } = useTranslation();
  const { data: steamCredentials } = useSteamCredentials();
  const { addInstallingProfile, removeInstallingProfile, isProfileInstalling } = useAppStore();

  const installGame = async (
    profileName: string,
    branch: string,
    manifestId?: string,
    username?: string,
    password?: string
  ) => {
    try {
      addInstallingProfile(profileName);
      
      const request: GameInstallRequest = {
        profile_name: profileName,
        branch,
        manifest_id: manifestId || undefined,
        username: username || steamCredentials?.username || undefined,
        password: password || steamCredentials?.password || undefined,
      };

      const result = await invoke<string>('install_game_to_profile_interactive', { request });
      // Don't show success toast here because it's shown when installation actually completes
      
      if (options?.onSuccess) {
        await options.onSuccess();
      }
      
      return result;
    } catch (err) {
      removeInstallingProfile(profileName);
      const errorMessage = String(err);
      toast.error(t('toasts.error', { message: `ゲームのインストールに失敗しました: ${errorMessage}` }));
      
      if (options?.onError) {
        options.onError(errorMessage);
      }
      
      throw err;
    }
  };

  const updateGame = async (
    profileName: string,
    branch: string,
    manifestId?: string,
    username?: string,
    password?: string
  ) => {
    try {
      addInstallingProfile(profileName);
      
      const request: GameInstallRequest = {
        profile_name: profileName,
        branch,
        manifest_id: manifestId,
        username: username || steamCredentials?.username || undefined,
        password: password || steamCredentials?.password || undefined,
      };

      const result = await invoke<string>('update_profile_game_interactive', { request });
      // Don't show success toast here because it's shown when update actually completes
      
      if (options?.onSuccess) {
        await options.onSuccess();
      }
      
      return result;
    } catch (err) {
      removeInstallingProfile(profileName);
      const errorMessage = String(err);
      toast.error(t('toasts.error', { message: `ゲームの更新に失敗しました: ${errorMessage}` }));
      
      if (options?.onError) {
        options.onError(errorMessage);
      }
      
      throw err;
    }
  };

  return {
    installGame,
    updateGame,
    isLoading: (profileName: string) => isProfileInstalling(profileName),
  };
};