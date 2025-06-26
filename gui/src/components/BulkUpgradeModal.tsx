import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  ArrowUp, 
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { UpgradeableMod } from '../hooks/useQueries';

interface BulkUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  upgradeableMods: UpgradeableMod[];
  onConfirm: () => void;
  isUpgrading: boolean;
}

export default function BulkUpgradeModal({
  isOpen,
  onClose,
  upgradeableMods,
  onConfirm,
  isUpgrading
}: BulkUpgradeModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-dark-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden border border-dark-600"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-600">
            <div className="flex items-center space-x-3">
              <ArrowUp className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">
                {t('profiles.bulkUpgrade.title')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isUpgrading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {upgradeableMods.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {t('profiles.bulkUpgrade.allUpToDate')}
                </h3>
                <p className="text-gray-400">
                  {t('profiles.bulkUpgrade.allUpToDateDescription')}
                </p>
              </div>
            ) : (
              <>
                {/* Warning */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-yellow-400 font-medium mb-1">
                        {t('profiles.bulkUpgrade.warning')}
                      </h4>
                      <p className="text-yellow-200 text-sm">
                        {t('profiles.bulkUpgrade.warningDescription')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-4">
                    {t('profiles.bulkUpgrade.summary', { count: upgradeableMods.length })}
                  </h3>
                </div>

                {/* MOD List */}
                <div className="max-h-96 overflow-y-auto space-y-3 mb-6">
                  {upgradeableMods.map((mod) => (
                    <div
                      key={mod.name}
                      className="bg-dark-700/50 border border-dark-600/50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">{mod.name}</h4>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-400">{mod.current_version}</span>
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 font-medium">{mod.latest_version}</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm">{mod.description}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {upgradeableMods.length > 0 && (
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-600">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isUpgrading}
              >
                {t('common.cancel')}
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className="btn-primary flex items-center space-x-2"
                disabled={isUpgrading}
              >
                {isUpgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
                <span>
                  {isUpgrading 
                    ? t('profiles.bulkUpgrade.upgrading') 
                    : t('profiles.bulkUpgrade.confirmUpgrade', { count: upgradeableMods.length })
                  }
                </span>
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}