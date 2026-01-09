import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppStatus {
  initialized: boolean;
  depot_downloader_available: boolean;
  exe_dir: string | null;
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

interface AppState {
  // App Status
  appStatus: AppStatus | null;
  isInitializing: boolean;
  
  // Profiles
  profiles: Profile[];
  selectedProfile: string;
  isLoadingProfiles: boolean;
  
  // Steam Credentials
  steamCredentials: SteamCredentials | null;
  
  // UI State
  currentTab: 'home' | 'profiles' | 'settings' | 'plugins';
  
  // Profile management page navigation
  profilesPage: 'list' | 'edit';
  editingProfileName: string | null;
  
  // Loading states
  isLaunching: boolean;
  isInstalling: boolean;
  isUpdating: boolean;
  
  // Installation tracking
  installingProfiles: Set<string>;
  
  // Actions
  setAppStatus: (status: AppStatus | null) => void;
  setIsInitializing: (loading: boolean) => void;
  
  setProfiles: (profiles: Profile[]) => void;
  setSelectedProfile: (profile: string) => void;
  setIsLoadingProfiles: (loading: boolean) => void;
  
  setSteamCredentials: (credentials: SteamCredentials | null) => void;
  
  setCurrentTab: (tab: 'home' | 'profiles' | 'settings' | 'plugins') => void;
  
  // Profile page navigation
  setProfilesPage: (page: 'list' | 'edit') => void;
  setEditingProfileName: (name: string | null) => void;
  navigateToProfileEdit: (profileName: string) => void;
  navigateToProfileList: () => void;
  
  setIsLaunching: (loading: boolean) => void;
  setIsInstalling: (loading: boolean) => void;
  setIsUpdating: (loading: boolean) => void;
  
  // Installation tracking actions
  addInstallingProfile: (profileName: string) => void;
  removeInstallingProfile: (profileName: string) => void;
  isProfileInstalling: (profileName: string) => boolean;
  
  // Computed
  hasAvailableProfiles: () => boolean;
  getProfileByName: (name: string) => Profile | undefined;
  getInstalledProfiles: () => Profile[];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      appStatus: null,
      isInitializing: true,
      
      profiles: [],
      selectedProfile: '',
      isLoadingProfiles: false,
      
      steamCredentials: null,
      
      currentTab: 'home',
      
      profilesPage: 'list',
      editingProfileName: null,
      
      isLaunching: false,
      isInstalling: false,
      isUpdating: false,
      
      installingProfiles: new Set(),
      
      // Actions
      setAppStatus: (status) => set({ appStatus: status }),
      setIsInitializing: (loading) => set({ isInitializing: loading }),
      
      setProfiles: (profiles) => {
        set({ profiles });
        
        // Auto-select first profile if none selected
        const current = get();
        if (!current.selectedProfile && profiles.length > 0) {
          set({ selectedProfile: profiles[0].id });
        }
        
        // Clear selection if selected profile no longer exists
        if (current.selectedProfile && !profiles.find(p => p.id === current.selectedProfile)) {
          set({ selectedProfile: profiles.length > 0 ? profiles[0].id : '' });
        }
      },
      
      setSelectedProfile: (profile) => set({ selectedProfile: profile }),
      setIsLoadingProfiles: (loading) => set({ isLoadingProfiles: loading }),
      
      setSteamCredentials: (credentials) => set({ steamCredentials: credentials }),
      
      setCurrentTab: (tab) => set({ currentTab: tab }),
      
      // Profile page navigation
      setProfilesPage: (page) => set({ profilesPage: page }),
      setEditingProfileName: (name) => set({ editingProfileName: name }),
      
      navigateToProfileEdit: (profileName) => {
        set({ 
          profilesPage: 'edit',
          editingProfileName: profileName
        });
      },
      
      navigateToProfileList: () => {
        set({ 
          profilesPage: 'list',
          editingProfileName: null
        });
      },
      
      setIsLaunching: (loading) => set({ isLaunching: loading }),
      setIsInstalling: (loading) => set({ isInstalling: loading }),
      setIsUpdating: (loading) => set({ isUpdating: loading }),
      
      // Installation tracking actions
      addInstallingProfile: (profileName) => {
        const current = get();
        const newSet = new Set(current.installingProfiles);
        newSet.add(profileName);
        set({ installingProfiles: newSet });
      },
      
      removeInstallingProfile: (profileName) => {
        const current = get();
        const newSet = new Set(current.installingProfiles);
        newSet.delete(profileName);
        set({ installingProfiles: newSet });
      },
      
      isProfileInstalling: (profileName) => {
        return get().installingProfiles.has(profileName);
      },
      
      // Computed
      hasAvailableProfiles: () => get().profiles.length > 0,
      
      getProfileByName: (name) => get().profiles.find(p => p.id === name || p.display_name === name),
      
      getInstalledProfiles: () => get().profiles.filter(p => p.has_game),
    }),
    {
      name: 'resonite-tools-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields  
      partialize: (state) => ({
        selectedProfile: state.selectedProfile,
        // Don't persist currentTab to always start from home
        // profilesPage is not persisted to always start from list view
      }),
    }
  )
);