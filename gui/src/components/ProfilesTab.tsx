import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  ChevronDown,
  Monitor,
  Headphones,
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
import GameInstallModal from './GameInstallModal';
import { useAppStore } from '../store/useAppStore';
import { useProfiles, useCreateProfile } from '../hooks/useQueries';
import { useGameInstallation } from '../hooks/useGameInstallation';
import { BranchInfo } from './ProfileEditPage';

interface ProfileInfo {
  id: string;
  display_name: string;
  name?: string; // for compatibility
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

interface ProfileConfig {
  name: string;
  description: string;
  args: string[];
}

function ProfilesTab() {
  const { t } = useTranslation();
  const { 
    profilesPage, 
    editingProfileName, 
    navigateToProfileEdit, 
    navigateToProfileList,
    isProfileInstalling,
    removeInstallingProfile
  } = useAppStore();
  
  // React Query hooks
  const { data: profiles = [], isLoading: profilesLoading, refetch: refetchProfiles } = useProfiles();
  const createProfileMutation = useCreateProfile();
  const { installGame, updateGame, isLoading: getIsInstalling } = useGameInstallation({
    onSuccess: async () => {
      await refetchProfiles();
      closeInstallModal();
    },
  });
  
  // Local loading state (for game installation, etc.)
  const [isLoading, setIsLoading] = useState(false);
  
  // Launch dropdown state
  const [launchDropdownOpen, setLaunchDropdownOpen] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // State for profile creation modal
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [createWithGame, setCreateWithGame] = useState(false);
  const [createGameBranch, setCreateGameBranch] = useState('release');
  const [createManifestId, setCreateManifestId] = useState('');
  const [createWithModLoader, setCreateWithModLoader] = useState(false);
  const [createModLoaderType, setCreateModLoaderType] = useState<'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader'>('ResoniteModLoader');
  
  // State for game installation
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  
  // State for Steam credentials management
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  
  // State for profile editing
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileConfig | null>(null);
  
  // State for MOD risk warning modal
  const [showModRiskModal, setShowModRiskModal] = useState(false);
  const [pendingProfileData, setPendingProfileData] = useState<{
    name: string;
    description: string;
    withGame: boolean;
    branch: string;
    manifestId: string;
    withModLoader: boolean;
    modLoaderType: 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader';
  } | null>(null);
  
  // State for game update modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdateProfile, setSelectedUpdateProfile] = useState<ProfileInfo | null>(null);
  
  // Version info management
  const [gameVersions, setGameVersions] = useState<BranchInfo>({});
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
    loadGameVersions();

    // Listen for installation completion events
    const unlistenCompleted = listen('installation-completed', (event) => {
      const data = event.payload as {
        profile_name: string;
        branch: string;
        success: boolean;
        message: string;
      };
      
      if (data.success) {
        toast.success(data.message);
        refetchProfiles(); // Using React Query
        removeInstallingProfile(data.profile_name);
      } else {
        toast.error(data.message);
        removeInstallingProfile(data.profile_name);
      }
    });

    // Listen for installation status update events
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

    // Cleanup
    return () => {
      unlistenCompleted.then(f => f());
      unlistenStatus.then(f => f());
    };
  }, [refetchProfiles]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (launchDropdownOpen) {
        const dropdownElement = dropdownRefs.current[launchDropdownOpen];
        if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
          setLaunchDropdownOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [launchDropdownOpen]);

  
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

    // Show warning modal if installing MOD loader
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

    // Create directly if no MOD loader
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
      modLoaderType: 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader';
    }
  ) => {
    try {
      setIsLoading(true);
      
      // Create profile using React Query mutation
      await createProfileMutation.mutateAsync({
        name: profileData.name,
        description: profileData.description,
      });
      
      // If also installing game
      if (profileData.withGame) {
        try {
          await installGame(
            profileData.name,
            profileData.branch,
            profileData.manifestId || undefined
          );
          
          // If also installing MOD loader
          if (profileData.withModLoader) {
            try {
              const modLoaderResult = await invoke<string>('install_mod_loader', { 
                profileName: profileData.name,
                loaderType: profileData.modLoaderType
              });
              toast.success(modLoaderResult);
            } catch (modErr) {
              toast.error(t('toasts.error', { message: `MODローダーのインストールに失敗しました: ${modErr}` }));
            }
          }
        } catch (installErr) {
          // Error is already handled by the hook
        }
      }
      
      closeCreateProfileModal();
    } catch (err) {
      toast.error(t('toasts.error', { message: `プロファイルの作成に失敗しました: ${err}` }));
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
  
  // Check if newer version is available
  const hasNewerVersion = (profile: ProfileInfo): boolean => {
    if (!gameVersions || !profile.has_game || !profile.branch) {
      return false;
    }
    
    const branchVersions = gameVersions[profile.branch];
    if (!branchVersions || branchVersions.length === 0) {
      return false;
    }
    
    // Compare by manifest ID if specific manifest ID is specified
    if (profile.manifest_id) {
      const latestVersion = branchVersions[0];
      return latestVersion && latestVersion.manifestId !== profile.manifest_id;
    }
    
    if (!profile.version) {
      return false;
    }
    
    // Find entry corresponding to profile's current version
    const currentVersionEntry = branchVersions.find(v => v.gameVersion === profile.version);
    if (!currentVersionEntry) {
      // If current version not found, consider no update available (too old or invalid)
      return false;
    }
    
    // Sort by timestamp to get latest version
    const sortedVersions = [...branchVersions].sort((a, b) => {
      const timestampA = new Date(a.timestamp).getTime();
      const timestampB = new Date(b.timestamp).getTime();
      return timestampB - timestampA; // Descending order (newest first)
    });
    
    const latestVersion = sortedVersions[0];
    if (!latestVersion) {
      return false;
    }
    
    // No update if current version is same as latest version
    if (currentVersionEntry.manifestId === latestVersion.manifestId) {
      return false;
    }
    
    // Compare by timestamp
    const currentTimestamp = new Date(currentVersionEntry.timestamp).getTime();
    const latestTimestamp = new Date(latestVersion.timestamp).getTime();
    
    return latestTimestamp > currentTimestamp;
  };
  
  // Get latest version info
  const getLatestVersionInfo = (profile: ProfileInfo) => {
    if (!gameVersions || !profile.branch) {
      return null;
    }
    
    const branchVersions = gameVersions[profile.branch];
    if (!branchVersions || branchVersions.length === 0) {
      return null;
    }
    
    // Sort by timestamp to get latest version
    const sortedVersions = [...branchVersions].sort((a, b) => {
      const timestampA = new Date(a.timestamp).getTime();
      const timestampB = new Date(b.timestamp).getTime();
      return timestampB - timestampA; // Descending order (newest first)
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
      toast.error(t('toasts.gameLaunchFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const launchProfileWithMode = async (profileName: string, mode: string) => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('launch_resonite_with_mode', {
        profileName,
        mode,
      });
      
      toast.success(result);
    } catch (err) {
      toast.error(t('toasts.gameLaunchFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const openInstallModal = (profileName: string) => {
    setSelectedProfile(profileName);
    setShowInstallModal(true);
  };

  const closeInstallModal = () => {
    setShowInstallModal(false);
    setSelectedProfile('');
  };

  const handleInstallGame = async (branch: string, manifestId?: string) => {
    if (!selectedProfile) return;
    await installGame(selectedProfile, branch, manifestId);
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

  const handleUpdateGame = async (manifestId?: string) => {
    if (!selectedUpdateProfile) return;
    
    await updateGame(
      selectedUpdateProfile.id,
      selectedUpdateProfile.branch || 'release',
      manifestId || selectedUpdateProfile.manifest_id
    );
    
    closeUpdateModal();
  };

  // Steam credentials related functions
  const loadSavedCredentials = async () => {
    try {
      const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
      setSavedCredentials(credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  // Profile editing related functions
  const openEditModal = async (profileName: string) => {
    try {
      setIsLoading(true);
      const profile = await invoke<ProfileConfig>('get_profile_config', { profileName });
      setEditingProfile(profile);
      setShowEditModal(true);
    } catch (err) {
      toast.error(t('toasts.error', { message: `プロファイル設定の取得に失敗しました: ${err}` }));
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
      toast.error(t('toasts.error', { message: `プロファイルの更新に失敗しました: ${err}` }));
      throw err;
    }
  };

  // Display profile editing page
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
          <h2 className="text-2xl font-bold text-white">{t('profiles.title')}</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center space-x-2"
            onClick={openCreateProfileModal}
          >
            <Plus className="w-4 h-4" />
            <span>{t('profiles.newProfile')}</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center space-x-2"
            onClick={() => refetchProfiles()}
            disabled={profilesLoading}
          >
            <RefreshCw className={`w-4 h-4 ${profilesLoading ? 'animate-spin' : ''}`} />
            <span>{t('profiles.refresh')}</span>
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
          <p className="text-gray-400 text-lg">{t('profiles.noProfiles')}</p>
          <p className="text-gray-500">{t('profiles.createHint')}</p>
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
                    {profile.description || t('profiles.noDescription')}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {profile.has_game ? (
                    <span className="status-success">
                      {t('profiles.installed')}
                    </span>
                  ) : (
                    <span className="status-error">
                      {t('profiles.notInstalled')}
                    </span>
                  )}
                  
                  {profile.has_game && hasNewerVersion(profile) && (
                    <span className="status-info text-xs flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                      <span>{t('profiles.updateAvailable')}</span>
                    </span>
                  )}
                  
                  {profile.has_game && profile.has_mod_loader && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        profile.mod_loader_type === 'BepisLoader'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : profile.mod_loader_type === 'MonkeyLoader'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}
                      title={
                        profile.mod_loader_type === 'BepisLoader' ? 'BepisLoader (BepInEx)'
                          : profile.mod_loader_type === 'MonkeyLoader' ? 'MonkeyLoader'
                          : 'Resonite Mod Loader'
                      }
                    >
                      {profile.mod_loader_type === 'BepisLoader' ? 'BepInEx'
                        : profile.mod_loader_type === 'MonkeyLoader' ? 'ML'
                        : 'RML'}
                    </span>
                  )}
                </div>
              </div>

              {profile.has_game && (
                <div className="mb-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('common.branch')}:</span>
                    <span className="text-white">{profile.branch}</span>
                  </div>
                  {profile.version && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('common.version')}:</span>
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
                          {t('profiles.newVersionAvailable')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                {profile.has_game ? (
                  <>
                    <div className="flex items-stretch flex-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`btn-primary flex-1 flex items-center justify-center space-x-2 rounded-r-none ${
                          isProfileInstalling(profile.id) ? 'opacity-50' : ''
                        }`}
                        onClick={() => launchProfile(profile.id)}
                        disabled={isLoading || isProfileInstalling(profile.id)}
                      >
                        {isProfileInstalling(profile.id) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('common.installing')}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>{t('common.launch')}</span>
                          </>
                        )}
                      </motion.button>
                      
                      {/* Launch Mode Dropdown */}
                      <div 
                        className="relative"
                        ref={(el) => dropdownRefs.current[profile.id] = el}
                      >
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`btn-primary h-full px-3 flex items-center justify-center rounded-l-none border-l border-blue-400 dark:border-blue-500 ${
                            isProfileInstalling(profile.id) ? 'opacity-50' : ''
                          }`}
                          onClick={() => setLaunchDropdownOpen(launchDropdownOpen === profile.id ? null : profile.id)}
                          disabled={isLoading || isProfileInstalling(profile.id)}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.button>
                        
                        {launchDropdownOpen === profile.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-40">
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg transition-colors duration-200 flex items-center space-x-2"
                              onClick={() => {
                                launchProfileWithMode(profile.id, 'screen');
                                setLaunchDropdownOpen(null);
                              }}
                            >
                              <Monitor className="w-4 h-4" />
                              <span>{t('profiles.launchModes.screen')}</span>
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg transition-colors duration-200 flex items-center space-x-2"
                              onClick={() => {
                                launchProfileWithMode(profile.id, 'vr');
                                setLaunchDropdownOpen(null);
                              }}
                            >
                              <Headphones className="w-4 h-4" />
                              <span>{t('profiles.launchModes.vr')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
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
                        ? t('common.installing') 
                        : hasNewerVersion(profile) 
                          ? t('profiles.newVersionAvailable') 
                          : t('common.update')
                      }
                    >
                      {isProfileInstalling(profile.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className={`w-4 h-4 ${hasNewerVersion(profile) ? 'text-white' : ''}`} />
                      )}
                      <span>{isProfileInstalling(profile.id) ? t('common.installing') : t('common.update')}</span>
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
                        <span>{t('common.installing')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>{t('profiles.installGame')}</span>
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
                  title={t('profiles.editModal.title')}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{t('common.edit')}</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Install Game Modal */}
      <GameInstallModal
        isOpen={showInstallModal}
        onClose={closeInstallModal}
        onInstall={handleInstallGame}
        profileName={selectedProfile}
        isLoading={getIsInstalling(selectedProfile)}
      />


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
                    {t('profiles.createModal.title')}
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
                    {t('profiles.createModal.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder={t('profiles.createModal.namePlaceholder')}
                    className="input-primary w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('profiles.createModal.descriptionLabel')}
                  </label>
                  <input
                    type="text"
                    value={newProfileDescription}
                    onChange={(e) => setNewProfileDescription(e.target.value)}
                    placeholder={t('profiles.createModal.descriptionPlaceholder')}
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
                      {t('profiles.createModal.installGame')}
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
                          {t('common.branch')}
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
                            <span className="text-white">{t('profiles.installModal.release')}</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              value="prerelease"
                              checked={createGameBranch === 'prerelease'}
                              onChange={(e) => setCreateGameBranch(e.target.value)}
                              className="text-resonite-blue"
                            />
                            <span className="text-white">{t('profiles.installModal.prerelease')}</span>
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
                              {t('profiles.createModal.installModLoader')}
                            </label>
                          </div>
                          
                          {createWithModLoader && (
                            <div className="ml-7 space-y-3">
                              <div className="flex flex-wrap gap-4">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="createModLoaderType"
                                    value="ResoniteModLoader"
                                    checked={createModLoaderType === 'ResoniteModLoader'}
                                    onChange={(e) => setCreateModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader')}
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
                                    onChange={(e) => setCreateModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader')}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-gray-300">MonkeyLoader</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="createModLoaderType"
                                    value="BepisLoader"
                                    checked={createModLoaderType === 'BepisLoader'}
                                    onChange={(e) => setCreateModLoaderType(e.target.value as 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader')}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-gray-300">BepisLoader (BepInEx)</span>
                                </label>
                              </div>

                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                <p className="text-sm text-blue-400">
                                  {createModLoaderType === 'BepisLoader'
                                    ? 'BepisLoader (BepInEx) がゲームと同時にインストールされ、Thunderstoreから MOD を使用できるようになります。'
                                    : createModLoaderType === 'MonkeyLoader'
                                      ? 'MonkeyLoaderがゲームと同時にインストールされ、MODを使用できるようになります。'
                                      : 'ResoniteModLoaderがゲームと同時にインストールされ、MODを使用できるようになります。'}
                                </p>
                                <p className="text-xs text-blue-300 mt-1">
                                  {createModLoaderType === 'BepisLoader'
                                    ? 'BepisLoaderはBepInExベースのMODローダーで、Thunderstoreから MOD をインストールできます。'
                                    : createModLoaderType === 'MonkeyLoader'
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
                            {t('profiles.createModal.steamCredentialWarning')}
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
                  {t('common.cancel')}
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
                        ? `プロファイル作成＆ゲーム＆${createModLoaderType === 'BepisLoader' ? 'BepInEx' : createModLoaderType === 'MonkeyLoader' ? 'MonkeyLoader' : 'RML'}インストール`
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
        onUpdate={handleUpdateGame}
        profileName={selectedUpdateProfile?.display_name || ''}
        currentVersion={selectedUpdateProfile?.version}
        currentBranch={selectedUpdateProfile?.branch}
        isLoading={isLoading || (selectedUpdateProfile?.id != null && getIsInstalling(selectedUpdateProfile?.id))}
      />
    </div>
  );
}

export default ProfilesTab;