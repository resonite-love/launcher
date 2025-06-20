import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileDeleteConfirmModalProps {
  isOpen: boolean;
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function ProfileDeleteConfirmModal({
  isOpen,
  profileName,
  onConfirm,
  onCancel,
  isDeleting = false
}: ProfileDeleteConfirmModalProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={!isDeleting ? onCancel : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6"
          >
            <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-800 max-w-md w-full p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-2">
                {t('profiles.deleteModal.title')}
              </h2>

              {/* Warning message */}
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-300 mb-2">
                  <strong className="text-red-400">{t('profiles.deleteModal.warning')}</strong>
                </p>
                <p className="text-sm text-gray-300">
                  {t('profiles.deleteModal.description', { profileName })}
                </p>
              </div>

              {/* Profile name */}
              <div className="mb-6 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">{t('profiles.deleteModal.profileToDelete')}</p>
                <p className="text-lg font-semibold text-white">{profileName}</p>
              </div>

              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onCancel}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      {t('profiles.deleteModal.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('profiles.deleteModal.deleteButton')}
                    </>
                  )}
                </button>
              </div>

              {/* Additional warning */}
              <p className="text-xs text-gray-500 text-center mt-4">
                {t('profiles.deleteModal.note')}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}