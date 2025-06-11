import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronDown, Info, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useProfiles, useLaunchResonite } from '../hooks/useQueries';

interface UpdateNote {
  version: string;
  date: string;
  notes: string[];
}

function HomeTab() {
  const { 
    selectedProfile, 
    setSelectedProfile,
    isLaunching,
  } = useAppStore();

  const { 
    data: profiles = [], 
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles 
  } = useProfiles();

  const launchMutation = useLaunchResonite();

  const [updateNotes] = useState<UpdateNote[]>([
    {
      version: "v1.0.0",
      date: "2024-01-15",
      notes: [
        "初期リリース",
        "プロファイル管理機能を追加",
        "Resonite起動機能を追加"
      ]
    }
  ]);

  // Auto-select first profile if none selected
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfile) {
      setSelectedProfile(profiles[0].name);
    }
  }, [profiles, selectedProfile, setSelectedProfile]);

  const selectedProfileData = profiles.find(p => p.name === selectedProfile);

  const handleLaunch = async () => {
    if (!selectedProfile) {
      return;
    }

    if (!selectedProfileData?.has_game) {
      return;
    }

    launchMutation.mutate(selectedProfile);
  };

  const handleRefresh = () => {
    refetchProfiles();
  };

  return (
    <div className="space-y-8">
      {/* Update Notes Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Info className="w-6 h-6 text-resonite-blue" />
            <h2 className="text-2xl font-bold text-white">アップデート情報</h2>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefresh}
            disabled={isLoadingProfiles}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingProfiles ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </motion.button>
        </div>
        
        <div className="max-h-80 overflow-y-auto scrollbar-hide space-y-4">
          {updateNotes.map((update, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-dark-800/50 border border-dark-600/30 rounded-lg p-4 hover:border-resonite-blue/30 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-semibold text-resonite-blue">
                  {update.version}
                </span>
                <div className="flex items-center space-x-2 text-gray-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{update.date}</span>
                </div>
              </div>
              
              <ul className="space-y-2">
                {update.notes.map((note, noteIndex) => (
                  <motion.li
                    key={noteIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: (index * 0.1) + (noteIndex * 0.05) }}
                    className="flex items-start space-x-3 text-gray-300"
                  >
                    <div className="w-1.5 h-1.5 bg-resonite-blue rounded-full mt-2 flex-shrink-0" />
                    <span>{note}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Launch Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card text-center"
      >
        {/* Profile Selector */}
        <div className="mb-8">
          <label className="block text-lg font-medium text-gray-300 mb-4">
            プロファイル選択
          </label>
          
          <div className="relative max-w-md mx-auto">
            {isLoadingProfiles ? (
              <div className="select-primary w-full pr-10 text-center text-lg font-medium flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                読み込み中...
              </div>
            ) : (
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="select-primary w-full appearance-none pr-10 text-center text-lg font-medium"
                disabled={profiles.length === 0}
              >
                <option value="">
                  {profiles.length === 0 ? 'プロファイルがありません' : 'プロファイルを選択...'}
                </option>
                {profiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name} ({profile.branch || 'unknown'})
                  </option>
                ))}
              </select>
            )}
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Launch Button */}
        <motion.button
          whileHover={{ 
            scale: selectedProfileData?.has_game && !isLaunching ? 1.05 : 1 
          }}
          whileTap={{ 
            scale: selectedProfileData?.has_game && !isLaunching ? 0.95 : 1 
          }}
          className={`launch-button ${
            !selectedProfileData?.has_game || isLaunching ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleLaunch}
          disabled={!selectedProfile || !selectedProfileData?.has_game || isLaunching}
        >
          <div className="flex items-center justify-center space-x-3">
            {isLaunching ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6" />
            )}
            <span className="text-xl">
              {isLaunching ? 'Starting Resonite...' : 'Play Resonite'}
            </span>
          </div>
        </motion.button>

        {/* Profile Info */}
        {selectedProfileData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-dark-800/30 rounded-lg p-4 max-w-md mx-auto"
          >
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ブランチ:</span>
                <span className="font-medium text-white">
                  {selectedProfileData.branch || 'unknown'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">説明:</span>
                <span className="font-medium text-white">
                  {selectedProfileData.description || 'なし'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ゲーム状態:</span>
                {selectedProfileData.has_game ? (
                  <span className="status-success">インストール済み</span>
                ) : (
                  <span className="status-error">未インストール</span>
                )}
              </div>
              
              {selectedProfileData.version && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">バージョン:</span>
                  <span className="font-medium text-white">
                    {selectedProfileData.version}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Warning Messages */}
        {!selectedProfileData?.has_game && selectedProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-yellow-400 text-sm"
          >
            ⚠️ このプロファイルにはゲームがインストールされていません。
            <br />
            プロファイル管理タブからインストールしてください。
          </motion.div>
        )}

        {profiles.length === 0 && !isLoadingProfiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-gray-400 text-sm"
          >
            📝 プロファイル管理タブで新しいプロファイルを作成してください。
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default HomeTab;