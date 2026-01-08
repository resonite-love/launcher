import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Trash2, FolderOpen, RefreshCw, Database, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileActionsDropdownProps {
  profileName: string;
  isReloading: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenFolder: () => void;
  onReload: () => void;
  onClearCache?: () => void;
  onClearDatabase?: () => void;
  showDeleteOption?: boolean;
}

export default function ProfileActionsDropdown({
  profileName,
  isReloading,
  onDuplicate,
  onDelete,
  onOpenFolder,
  onReload,
  onClearCache,
  onClearDatabase,
  showDeleteOption = true,
}: ProfileActionsDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      id: 'reload',
      label: t('profiles.editPage.reload'),
      icon: RefreshCw,
      onClick: onReload,
      disabled: isReloading,
      className: 'text-blue-400 hover:text-blue-300',
    },
    {
      id: 'openFolder',
      label: t('profiles.editPage.openFolder'),
      icon: FolderOpen,
      onClick: onOpenFolder,
      disabled: false,
      className: 'text-yellow-400 hover:text-yellow-300',
    },
    {
      id: 'duplicate',
      label: t('profiles.editPage.duplicate'),
      icon: Copy,
      onClick: onDuplicate,
      disabled: false,
      className: 'text-green-400 hover:text-green-300',
    },
  ];

  // キャッシュ削除オプションを追加
  if (onClearCache) {
    menuItems.push({
      id: 'clearCache',
      label: t('profiles.editPage.clearCache', 'Clear Cache'),
      icon: HardDrive,
      onClick: onClearCache,
      disabled: false,
      className: 'text-orange-400 hover:text-orange-300',
    });
  }

  // データベース削除オプションを追加
  if (onClearDatabase) {
    menuItems.push({
      id: 'clearDatabase',
      label: t('profiles.editPage.clearDatabase', 'Clear Database'),
      icon: Database,
      onClick: onClearDatabase,
      disabled: false,
      className: 'text-orange-400 hover:text-orange-300',
    });
  }

  // デフォルトプロファイル以外の場合は削除オプションを追加
  if (showDeleteOption && profileName !== 'default') {
    menuItems.push({
      id: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      onClick: onDelete,
      disabled: false,
      className: 'text-red-400 hover:text-red-300',
    });
  }

  const handleItemClick = (item: typeof menuItems[0]) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* ドロップダウンボタン */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary flex items-center space-x-1 relative"
        title={t('profiles.editPage.profileActions')}
      >
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
        <span>{t('profiles.editPage.actions')}</span>
      </motion.button>

      {/* ドロップダウンメニュー */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* オーバーレイ - クリックでメニューを閉じる */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            
            {/* メニューコンテンツ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-20 bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-2 min-w-48"
            >
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.7)' }}
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    className={`w-full px-4 py-2 text-left flex items-center space-x-3 transition-colors duration-150 ${
                      item.disabled 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : `${item.className} hover:bg-dark-700`
                    }`}
                  >
                    <Icon 
                      className={`w-4 h-4 ${
                        item.disabled && item.id === 'reload' && isReloading 
                          ? 'animate-spin' 
                          : ''
                      }`} 
                    />
                    <span className="text-sm">{item.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}