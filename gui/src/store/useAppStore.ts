import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  currentTab: 'home' | 'profiles' | 'settings';
  
  // Loading states
  isLaunching: boolean;
  isInstalling: boolean;
  isUpdating: boolean;
  
  // Actions
  setAppStatus: (status: AppStatus | null) => void;
  setIsInitializing: (loading: boolean) => void;
  
  setProfiles: (profiles: Profile[]) => void;
  setSelectedProfile: (profile: string) => void;
  setIsLoadingProfiles: (loading: boolean) => void;
  
  setSteamCredentials: (credentials: SteamCredentials | null) => void;
  
  setCurrentTab: (tab: 'home' | 'profiles' | 'settings') => void;
  
  setIsLaunching: (loading: boolean) => void;
  setIsInstalling: (loading: boolean) => void;
  setIsUpdating: (loading: boolean) => void;
  
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
      
      isLaunching: false,
      isInstalling: false,
      isUpdating: false,
      
      // Actions
      setAppStatus: (status) => set({ appStatus: status }),
      setIsInitializing: (loading) => set({ isInitializing: loading }),
      
      setProfiles: (profiles) => {
        set({ profiles });
        
        // Auto-select first profile if none selected
        const current = get();
        if (!current.selectedProfile && profiles.length > 0) {
          set({ selectedProfile: profiles[0].name });
        }
        
        // Clear selection if selected profile no longer exists
        if (current.selectedProfile && !profiles.find(p => p.name === current.selectedProfile)) {
          set({ selectedProfile: profiles.length > 0 ? profiles[0].name : '' });
        }
      },
      
      setSelectedProfile: (profile) => set({ selectedProfile: profile }),
      setIsLoadingProfiles: (loading) => set({ isLoadingProfiles: loading }),
      
      setSteamCredentials: (credentials) => set({ steamCredentials: credentials }),
      
      setCurrentTab: (tab) => set({ currentTab: tab }),
      
      setIsLaunching: (loading) => set({ isLaunching: loading }),
      setIsInstalling: (loading) => set({ isInstalling: loading }),
      setIsUpdating: (loading) => set({ isUpdating: loading }),
      
      // Computed
      hasAvailableProfiles: () => get().profiles.length > 0,
      
      getProfileByName: (name) => get().profiles.find(p => p.name === name),
      
      getInstalledProfiles: () => get().profiles.filter(p => p.has_game),
    }),
    {
      name: 'resonite-tools-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({
        selectedProfile: state.selectedProfile,
        currentTab: state.currentTab,
      }),
    }
  )
);