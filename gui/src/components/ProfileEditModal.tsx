import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';

interface ProfileConfig {
  name: string;
  description: string;
  args: string[];
}

interface ProfileEditModalProps {
  isOpen: boolean;
  profile: ProfileConfig | null;
  onClose: () => void;
  onSave: (config: ProfileConfig) => Promise<void>;
}

function ProfileEditModal({ isOpen, profile, onClose, onSave }: ProfileEditModalProps) {
  const [config, setConfig] = useState<ProfileConfig>({
    name: '',
    description: '',
    args: []
  });
  const [newArg, setNewArg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setConfig({ ...profile });
    }
  }, [profile]);

  const addArgument = () => {
    if (newArg.trim()) {
      setConfig(prev => ({
        ...prev,
        args: [...prev.args, newArg.trim()]
      }));
      setNewArg('');
    }
  };

  const removeArgument = (index: number) => {
    setConfig(prev => ({
      ...prev,
      args: prev.args.filter((_, i) => i !== index)
    }));
  };

  const updateArgument = (index: number, value: string) => {
    setConfig(prev => ({
      ...prev,
      args: prev.args.map((arg, i) => i === index ? value : arg)
    }));
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      return;
    }

    try {
      setIsLoading(true);
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addArgument();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-dark-900 border border-dark-600 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            プロファイル設定編集
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                プロファイル名
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                className="input-primary w-full"
                disabled={isLoading}
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">
                プロファイル名は変更できません
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                説明
              </label>
              <input
                type="text"
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="プロファイルの説明を入力"
                className="input-primary w-full"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Launch Arguments */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              起動引数
            </label>
            
            <div className="space-y-2 mb-4">
              {config.args.map((arg, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={arg}
                    onChange={(e) => updateArgument(index, e.target.value)}
                    className="input-primary flex-1"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => removeArgument(index)}
                    className="text-red-400 hover:text-red-300 p-2"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newArg}
                onChange={(e) => setNewArg(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="新しい引数を追加（例: -Screen）"
                className="input-primary flex-1"
                disabled={isLoading}
              />
              <button
                onClick={addArgument}
                className="btn-secondary flex items-center space-x-1"
                disabled={isLoading || !newArg.trim()}
              >
                <Plus className="w-4 h-4" />
                <span>追加</span>
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              <p>使用可能な変数:</p>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>%PROFILE_DIR% - プロファイルディレクトリ</li>
                <li>%GAME_DIR% - ゲームディレクトリ</li>
                <li>%DATA_DIR% - データディレクトリ</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            className="btn-secondary flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            className="btn-primary flex-1 flex items-center justify-center space-x-2"
            onClick={handleSave}
            disabled={isLoading || !config.name.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>保存</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ProfileEditModal;