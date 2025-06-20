import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Check, 
  X, 
  Loader2, 
  AlertCircle, 
  Key, 
  Users, 
  Package,
  Settings,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface FirstRunSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface SteamCredentials {
  username: string;
  password: string;
}

type SetupStep = 'welcome' | 'depot' | 'steam' | 'complete';

function FirstRunSetupModal({ isOpen, onComplete }: FirstRunSetupModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [isDownloading, setIsDownloading] = useState(false);
  const [depotDownloaded, setDepotDownloaded] = useState(false);
  const [steamUsername, setSteamUsername] = useState('');
  const [steamPassword, setSteamPassword] = useState('');
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);

  const steps = [
    { id: 'welcome', title: t('firstRun.welcome.title'), icon: Users },
    { id: 'depot', title: t('firstRun.depotDownloader.title'), icon: Package },
    { id: 'steam', title: t('firstRun.steam.title'), icon: Key },
    { id: 'complete', title: t('firstRun.complete.title'), icon: Check },
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  const downloadDepotDownloader = async () => {
    try {
      setIsDownloading(true);
      const result = await invoke<string>('download_depot_downloader');
      toast.success(result);
      setDepotDownloaded(true);
      setTimeout(() => setCurrentStep('steam'), 1000);
    } catch (err) {
      toast.error(`DepotDownloader download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const saveSteamCredentials = async () => {
    if (saveCredentials && steamUsername.trim() && steamPassword.trim()) {
      try {
        const credentials: SteamCredentials = {
          username: steamUsername.trim(),
          password: steamPassword.trim(),
        };
        await invoke<string>('save_steam_credentials', { credentials });
        toast.success(t('toasts.steamCredentialsSaved'));
      } catch (err) {
        toast.error(`Credential save failed: ${err}`);
      }
    }
  };

  const completeSetup = async () => {
    try {
      setIsCompletingSetup(true);
      await saveSteamCredentials();
      await invoke<string>('complete_first_run_setup');
      setCurrentStep('complete');
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      toast.error(`Setup completion failed: ${err}`);
    } finally {
      setIsCompletingSetup(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 bg-resonite-blue/20 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-10 h-10 text-resonite-blue" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('firstRun.welcome.heading')}
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {t('firstRun.welcome.description')}<br />
                {t('firstRun.welcome.setupSteps')}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full flex items-center justify-center space-x-2"
              onClick={() => setCurrentStep('depot')}
            >
              <span>{t('firstRun.welcome.startSetup')}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        );

      case 'depot':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
              depotDownloaded ? 'bg-green-500/20' : 'bg-resonite-blue/20'
            }`}>
              {depotDownloaded ? (
                <Check className="w-10 h-10 text-green-400" />
              ) : (
                <Package className="w-10 h-10 text-resonite-blue" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('firstRun.depotDownloader.title')}
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {t('firstRun.depotDownloader.description')}<br />
                {t('firstRun.depotDownloader.githubInfo')}
              </p>
            </div>
            
            {depotDownloaded && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-green-300 font-medium">{t('firstRun.depotDownloader.downloadComplete')}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center space-x-2"
                onClick={() => setCurrentStep('welcome')}
                disabled={isDownloading}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('common.back')}</span>
              </motion.button>
              
              {!depotDownloaded ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  onClick={downloadDepotDownloader}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('firstRun.depotDownloader.downloading')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{t('firstRun.depotDownloader.startDownload')}</span>
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  onClick={() => setCurrentStep('steam')}
                >
                  <span>{t('common.next')}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </motion.div>
        );

      case 'steam':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-resonite-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key className="w-10 h-10 text-resonite-blue" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('firstRun.steam.title')}
              </h2>
              <p className="text-gray-300">
                {t('firstRun.steam.description')}
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <p className="font-medium mb-1">{t('firstRun.steam.credentialTitle')}</p>
                  <p className="text-blue-200">
                    {t('firstRun.steam.autoLogin')}
                    {t('firstRun.steam.encrypted')}
                    {t('firstRun.steam.subAccountRecommended')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.steam.username')}
                </label>
                <input
                  type="text"
                  value={steamUsername}
                  onChange={(e) => setSteamUsername(e.target.value)}
                  placeholder={t('settings.steam.credentialModal.usernameLabel')}
                  className="input-primary w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.steam.credentialModal.passwordLabel')}
                </label>
                <input
                  type="password"
                  value={steamPassword}
                  onChange={(e) => setSteamPassword(e.target.value)}
                  placeholder={t('settings.steam.credentialModal.passwordLabel')}
                  className="input-primary w-full"
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="saveCredentials"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                  className="w-4 h-4 text-resonite-blue bg-dark-800 border-dark-600 rounded focus:ring-resonite-blue focus:ring-2"
                />
                <label htmlFor="saveCredentials" className="text-white font-medium">
                  {t('firstRun.steam.saveCredentials')}
                </label>
              </div>
            </div>

            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center space-x-2"
                onClick={() => setCurrentStep('depot')}
                disabled={isCompletingSetup}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('common.back')}</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
                onClick={completeSetup}
                disabled={isCompletingSetup}
              >
                {isCompletingSetup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('firstRun.steam.settingUp')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('common.finish')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {t('firstRun.complete.setupComplete')}
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {t('firstRun.complete.description')}<br />
                {t('firstRun.complete.readyToUse')}
              </p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-300">
                  <p className="font-medium mb-1">{t('firstRun.complete.nextSteps.title')}</p>
                  <ul className="space-y-1 text-green-200">
                    <li>{t('firstRun.complete.nextSteps.createProfile')}</li>
                    <li>{t('firstRun.complete.nextSteps.downloadGame')}</li>
                    <li>{t('firstRun.complete.nextSteps.manageMods')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-dark-900 border border-dark-600 rounded-xl p-8 max-w-2xl w-full"
        >
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === getCurrentStepIndex();
                const isCompleted = index < getCurrentStepIndex();
                
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center space-y-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted 
                          ? 'bg-green-500 text-white'
                          : isActive 
                          ? 'bg-resonite-blue text-white'
                          : 'bg-dark-700 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        isActive ? 'text-resonite-blue' : 'text-gray-400'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-dark-700'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FirstRunSetupModal;