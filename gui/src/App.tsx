import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, User, Settings, Plug, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CustomTitlebar from './components/CustomTitlebar';
import HomeTab from './components/HomeTab';
import ProfilesTab from './components/ProfilesTab';
import SettingsTab from './components/SettingsTab';
import PluginsTab from './components/PluginsTab';
import FirstRunSetupModal from './components/FirstRunSetupModal';
import { useAppStore } from './store/useAppStore';
import { useAppStatus } from './hooks/useQueries';

function App() {
  const { t } = useTranslation();
  const { 
    currentTab, 
    setCurrentTab, 
    appStatus,
    isInitializing,
    setIsInitializing 
  } = useAppStore();

  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);

  const { 
    data: statusData, 
    isLoading: isLoadingStatus, 
    error: statusError,
    refetch: refetchStatus 
  } = useAppStatus();

  useEffect(() => {
    setIsInitializing(isLoadingStatus);
  }, [isLoadingStatus, setIsInitializing]);

  useEffect(() => {
    if (statusData && statusData.is_first_run) {
      setShowFirstRunSetup(true);
    }
  }, [statusData]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-4"
        >
          <Loader2 className="w-8 h-8 text-resonite-blue animate-spin" />
          <p className="text-gray-300 text-lg">{t('app.initializing')}</p>
        </motion.div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card max-w-md w-full text-center"
        >
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">{t('common.error')}</h3>
          <p className="text-gray-300 mb-6">{String(statusError)}</p>
          <button className="btn-primary w-full" onClick={() => refetchStatus()}>
            {t('common.retry')}
          </button>
        </motion.div>
      </div>
    );
  }

  // Show warning if DepotDownloader is not available
  const showDepotWarning = appStatus && !appStatus.depot_downloader_available;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen bg-dark-950 flex flex-col window-frame"
    >
      {/* Custom Titlebar */}
      <CustomTitlebar />
      {/* DepotDownloader Warning Banner */}
      {showDepotWarning && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-600/20 border-b border-yellow-600/30 p-3"
        >
          <div className="max-w-7xl mx-auto flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-200 text-sm">
              {t('app.depotDownloaderWarning')}
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <header className="left-0 right-0 z-40 bg-dark-900/70 backdrop-blur-md border-b border-dark-700/30 px-6 py-2">
        <div className="max-w-7xl mx-auto">
          <nav className="flex items-center space-x-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'home' 
                  ? 'text-white bg-resonite-blue/20 border border-resonite-blue/30 shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
              }`}
              onClick={() => setCurrentTab('home')}
            >
              <Home className="w-4 h-4" />
              <span>{t('nav.home')}</span>
              {currentTab === 'home' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-resonite-blue/10 rounded-lg border border-resonite-blue/20"
                  style={{ zIndex: -1 }}
                />
              )}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'profiles' 
                  ? 'text-white bg-resonite-blue/20 border border-resonite-blue/30 shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
              }`}
              onClick={() => setCurrentTab('profiles')}
            >
              <User className="w-4 h-4" />
              <span>{t('nav.profiles')}</span>
              {currentTab === 'profiles' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-resonite-blue/10 rounded-lg border border-resonite-blue/20"
                  style={{ zIndex: -1 }}
                />
              )}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'settings'
                  ? 'text-white bg-resonite-blue/20 border border-resonite-blue/30 shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
              }`}
              onClick={() => setCurrentTab('settings')}
            >
              <Settings className="w-4 h-4" />
              <span>{t('nav.settings')}</span>
              {currentTab === 'settings' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-resonite-blue/10 rounded-lg border border-resonite-blue/20"
                  style={{ zIndex: -1 }}
                />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'plugins'
                  ? 'text-white bg-resonite-blue/20 border border-resonite-blue/30 shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
              }`}
              onClick={() => setCurrentTab('plugins')}
            >
              <Plug className="w-4 h-4" />
              <span>{t('nav.plugins')}</span>
              {currentTab === 'plugins' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-resonite-blue/10 rounded-lg border border-resonite-blue/20"
                  style={{ zIndex: -1 }}
                />
              )}
            </motion.button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-hidden">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="max-w-7xl mx-auto h-full"
        >
          {currentTab === 'home' && <HomeTab />}
          {currentTab === 'profiles' && <ProfilesTab />}
          {currentTab === 'settings' && <SettingsTab />}
          {currentTab === 'plugins' && <PluginsTab />}
        </motion.div>
      </main>

      {/* Status Bar */}
      <footer className="bg-dark-900/30 backdrop-blur-sm border-t border-dark-700/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            {appStatus?.exe_dir && (
              <span className="text-gray-400">
                📁 {appStatus.exe_dir}
              </span>
            )}
          </div>
          
          <div className="flex items-center px-2">
            {appStatus?.depot_downloader_available ? (
              <span className="status-success">
                ✓ DepotDownloader
              </span>
            ) : (
              <span className="status-error">
                ✗ DepotDownloader
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* First Run Setup Modal */}
      <FirstRunSetupModal
        isOpen={showFirstRunSetup}
        onComplete={() => {
          setShowFirstRunSetup(false);
          refetchStatus(); // アプリステータスを再取得
        }}
      />
    </motion.div>
  );
}

export default App;