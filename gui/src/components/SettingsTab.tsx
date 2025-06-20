import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Check, 
  AlertCircle,
  Key,
  Edit3,
  Trash2,
  Loader2,
  X,
  Download,
  ExternalLink,
  RefreshCw,
  Info,
  Globe,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppUpdate, type AppUpdateInfo, type UpdateAsset } from '../hooks/useQueries';
import { shell } from '@tauri-apps/api';
import { useTranslation } from 'react-i18next';

interface SteamCredentials {
  username: string;
  password: string;
}

function SettingsTab() {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Steamクレデンシャル管理用の状態
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');
  
  // アップデートチェック
  const { data: updateInfo, isLoading: updateLoading, refetch: checkUpdate } = useAppUpdate();
  
  // App update states
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    loadSavedCredentials();
    
    // Listen for update events
    const unlisten = invoke('listen', {
      event: 'update-progress',
      handler: (payload: any) => {
        setUpdateProgress(payload.payload);
      }
    });
    
    const unlistenComplete = invoke('listen', {
      event: 'update-complete',
      handler: () => {
        setIsInstalling(false);
        setUpdateProgress(0);
        toast.success(t('settings.app.updateInstalled'));
      }
    });
    
    return () => {
      if (unlisten) unlisten;
      if (unlistenComplete) unlistenComplete;
    };
  }, [t]);

  // Steamクレデンシャル関連の関数
  const loadSavedCredentials = async () => {
    try {
      const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
      setSavedCredentials(credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  const openCredentialsModal = () => {
    setCredentialsUsername(savedCredentials?.username || '');
    setCredentialsPassword(savedCredentials?.password || '');
    setShowCredentialsModal(true);
  };

  const closeCredentialsModal = () => {
    setShowCredentialsModal(false);
    setCredentialsUsername('');
    setCredentialsPassword('');
  };

  const saveCredentials = async () => {
    if (!credentialsUsername.trim()) {
      toast.error(t('settings.steam.credentialModal.usernameRequired'));
      return;
    }

    try {
      setIsLoading(true);
      const credentials: SteamCredentials = {
        username: credentialsUsername.trim(),
        password: credentialsPassword,
      };

      await invoke<string>('save_steam_credentials', { credentials });
      toast.success(t('toasts.steamCredentialsSaved'));
      setSavedCredentials(credentials);
      closeCredentialsModal();
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsLoading(false);
    }
  };

  const clearCredentials = async () => {
    try {
      setIsLoading(true);
      await invoke<string>('clear_steam_credentials');
      toast.success(t('toasts.steamCredentialsDeleted'));
      setSavedCredentials(null);
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsLoading(false);
    }
  };

  // App update functions
  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      const hasUpdate = await invoke<boolean>('check_app_updates');
      if (hasUpdate) {
        toast.success(t('settings.app.updateAvailable'));
      } else {
        toast.success(t('settings.app.upToDate'));
      }
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const installUpdate = async () => {
    try {
      setIsInstalling(true);
      setUpdateProgress(0);
      const result = await invoke<string>('install_app_update');
      toast.success(result);
    } catch (err) {
      toast.error(t('toasts.error', { message: err }));
      setIsInstalling(false);
      setUpdateProgress(0);
    }
  };

  return (
    <div className="space-y-8 p-4 h-full overflow-y-scroll">
      {/* Language Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Globe className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">{t('settings.language.title')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
              i18n.language === 'ja' 
                ? 'border-resonite-blue bg-resonite-blue/20 text-white' 
                : 'border-dark-600 bg-dark-800/30 text-gray-400 hover:text-white hover:border-dark-500'
            }`}
            onClick={() => i18n.changeLanguage('ja')}
          >
            <p className="text-lg font-medium">{t('settings.language.japanese')}</p>
            <p className="text-sm opacity-70">{t('settings.language.japaneseEn')}</p>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
              i18n.language === 'en' 
                ? 'border-resonite-blue bg-resonite-blue/20 text-white' 
                : 'border-dark-600 bg-dark-800/30 text-gray-400 hover:text-white hover:border-dark-500'
            }`}
            onClick={() => i18n.changeLanguage('en')}
          >
            <p className="text-lg font-medium">{t('settings.language.english')}</p>
            <p className="text-sm opacity-70">{t('settings.language.englishJa')}</p>
          </motion.button>
        </div>
      </motion.div>
      {/* Steam Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Key className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">{t('settings.steam.title')}</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
          <div className="flex items-center space-x-3">
            {savedCredentials ? (
              <>
                <Check className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-white font-medium">
                    {t('settings.steam.username')} {savedCredentials.username}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {t('settings.steam.configured')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-white font-medium">{t('settings.steam.notConfigured')}</p>
                  <p className="text-gray-400 text-sm">
                    {t('settings.steam.requiredForInstall')}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary flex items-center space-x-2"
              onClick={openCredentialsModal}
              disabled={isLoading}
            >
              <Edit3 className="w-4 h-4" />
              <span>{savedCredentials ? t('common.edit') : t('common.settings')}</span>
            </motion.button>
            
            {savedCredentials && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-danger flex items-center space-x-2"
                onClick={clearCredentials}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('common.delete')}</span>
              </motion.button>
            )}
          </div>
        </div>

        <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">{t('settings.steam.about.title')}</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>{t('settings.steam.about.downloadRequired')}</li>
            <li>{t('settings.steam.about.encrypted')}</li>
            <li>{t('settings.steam.about.twoFactor')}</li>
            <li>{t('settings.steam.about.emptyPassword')}</li>
          </ul>
        </div>
      </motion.div>

      {/* Application Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">{t('settings.app.title')}</h2>
        </div>

        {/* App Updater Section */}
        <div className="bg-dark-800/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <RotateCcw className="w-5 h-5 text-resonite-blue" />
              <div>
                <p className="text-white font-medium">{t('settings.app.autoUpdater.title')}</p>
                <p className="text-gray-400 text-sm">
                  {t('settings.app.autoUpdater.description')}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center space-x-2"
                onClick={checkForUpdates}
                disabled={isCheckingUpdates || isInstalling}
              >
                {isCheckingUpdates ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{t('settings.app.checkUpdates')}</span>
              </motion.button>
            </div>
          </div>
          
          {/* Installation Progress */}
          {isInstalling && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">{t('settings.app.installing')}</span>
                <span className="text-sm text-gray-400">{Math.round(updateProgress)}%</span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div 
                  className="bg-resonite-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Legacy Update Information (keeping for manual checks) */}
        {updateLoading ? (
          <div className="bg-dark-800/30 rounded-lg p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-resonite-blue mr-3" />
            <span className="text-gray-300">{t('settings.app.checkingUpdate')}</span>
          </div>
        ) : updateInfo ? (
          <div className="space-y-4">
            {updateInfo.update_available ? (
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Download className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {t('settings.app.updateAvailable')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400">{t('settings.app.currentVersion')}</span>
                          <span className="font-mono text-gray-300">{t('settings.app.versionPrefix')}{updateInfo.current_version}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400">{t('settings.app.latestVersion')}</span>
                          <span className="font-mono text-green-400">{t('settings.app.versionPrefix')}{updateInfo.latest_version}</span>
                        </div>
                      </div>
                      
                      {/* Install Update Button */}
                      <div className="mt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn-primary flex items-center space-x-2"
                          onClick={installUpdate}
                          disabled={isInstalling || isCheckingUpdates}
                        >
                          {isInstalling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>{t('settings.app.installUpdate')}</span>
                        </motion.button>
                      </div>
                      
                      {/* リリースノート */}
                      {updateInfo.release_notes && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">{t('settings.app.changelog')}</h4>
                          <div className="bg-dark-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                              {updateInfo.release_notes}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn-secondary flex items-center space-x-2"
                    onClick={() => shell.open(updateInfo.download_url)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{t('settings.app.releasePage')}</span>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="bg-dark-800/30 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-white font-medium">{t('settings.app.upToDate')}</p>
                      <p className="text-gray-400 text-sm">
                        {t('settings.app.currentVersion')} {t('settings.app.versionPrefix')}{updateInfo.current_version}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-secondary flex items-center space-x-2"
                    onClick={() => checkUpdate()}
                    disabled={updateLoading}
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{t('settings.app.recheck')}</span>
                  </motion.button>
                </div>
              </div>
            )}
            
            {/* アップデート情報のフッター */}
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span>
                {t('settings.app.lastCheck')} {new Date().toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US')}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-400">{t('settings.app.updateCheckFailed')}</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center space-x-2"
                onClick={() => checkUpdate()}
                disabled={updateLoading}
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t('common.retry')}</span>
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Steam Credentials Modal */}
      {showCredentialsModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeCredentialsModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Key className="w-6 h-6 text-resonite-blue" />
                <h3 className="text-xl font-bold text-white">
                  {t('settings.steam.credentialModal.title')}
                </h3>
              </div>
              <button
                onClick={closeCredentialsModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-dark-800/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                {t('settings.steam.credentialModal.description')}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.steam.credentialModal.usernameLabel')}
                </label>
                <input
                  type="text"
                  value={credentialsUsername}
                  onChange={(e) => setCredentialsUsername(e.target.value)}
                  placeholder={t('settings.steam.username').replace(':', '')}
                  className="input-primary w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.steam.credentialModal.passwordLabel')}
                </label>
                <input
                  type="password"
                  value={credentialsPassword}
                  onChange={(e) => setCredentialsPassword(e.target.value)}
                  placeholder={t('settings.steam.credentialModal.passwordLabel')}
                  className="input-primary w-full"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={closeCredentialsModal}
                disabled={isLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
                onClick={saveCredentials}
                disabled={isLoading || !credentialsUsername.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{t('common.save')}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default SettingsTab;