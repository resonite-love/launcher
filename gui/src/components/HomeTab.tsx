import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronDown, Info, Calendar, Loader2, RefreshCw, Construction } from 'lucide-react';
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
    isProfileInstalling
  } = useAppStore();

  const { 
    data: profiles = [], 
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles 
  } = useProfiles();

  const launchMutation = useLaunchResonite();

  const [updateNotes] = useState<UpdateNote[]>([]);

  // Auto-select first profile if none selected
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfile) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles, selectedProfile, setSelectedProfile]);

  const selectedProfileData = profiles.find(p => p.id === selectedProfile);

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
    <div className="flex flex-col h-full overflow-y-scroll scrollbar-hide">
      {/* Main Content - Update Notes */}
      <div className="p-4 flex-1 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card h-full flex flex-col"
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
          
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4">
            {updateNotes.length === 0 ? (
              /* 未実装状態の表示 */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-12"
              >
                <Construction className="w-16 h-16 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">アップデート情報機能</h3>
                <p className="text-gray-400 mb-1">この機能はまだ実装されていません</p>
                <p className="text-gray-500 text-sm">
                  将来のバージョンでResoniteの最新アップデート情報を自動取得する予定です
                </p>
                
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-md">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-left">
                      <p className="text-blue-300 font-medium mb-1">予定している機能</p>
                      <ul className="text-blue-200 space-y-1">
                        <li>• Resonite公式のアップデート情報を自動取得</li>
                        <li>• バージョン履歴とチェンジログの表示</li>
                        <li>• 新バージョンの通知機能</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              updateNotes.map((update, index) => (
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
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Footer - Profile Selection and Launch */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex-shrink-0 bg-dark-900/80 backdrop-blur-sm border-t border-dark-600/50 p-3"
      >
        <div className="flex items-center gap-6">
          {/* Profile Selector */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                プロファイル:
              </label>
              
              <div className="relative flex-1 max-w-xs">
                {isLoadingProfiles ? (
                  <div className="select-primary w-full pr-10 text-sm flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    読み込み中...
                  </div>
                ) : (
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="select-primary w-full appearance-none pr-8 text-sm"
                    disabled={profiles.length === 0}
                  >
                    <option value="">
                      {profiles.length === 0 ? 'プロファイルがありません' : 'プロファイルを選択...'}
                    </option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.display_name}
                      </option>
                    ))}
                  </select>
                )}
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Profile Info */}
          {selectedProfileData && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">ブランチ:</span>
                <span className="px-2 py-1 bg-resonite-blue/20 text-resonite-blue rounded-md font-medium">
                  {selectedProfileData.branch || 'unknown'}
                </span>
              </div>
              
              {selectedProfileData.version && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">バージョン:</span>
                  <span className="px-2 py-1 bg-dark-700 text-white rounded-md font-mono text-xs">
                    {selectedProfileData.version}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-gray-400">状態:</span>
                {selectedProfileData.has_game ? (
                  <span className="status-success">Ready</span>
                ) : (
                  <span className="status-error">未インストール</span>
                )}
              </div>
            </div>
          )}

          {/* Launch Button */}
          <motion.button
            whileHover={{ 
              scale: selectedProfileData?.has_game && !isLaunching && !isProfileInstalling(selectedProfile) ? 1.02 : 1 
            }}
            whileTap={{ 
              scale: selectedProfileData?.has_game && !isLaunching && !isProfileInstalling(selectedProfile) ? 0.98 : 1 
            }}
            className={`btn-primary flex items-center space-x-2 px-6 py-3 ${
              !selectedProfileData?.has_game || isLaunching || isProfileInstalling(selectedProfile) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleLaunch}
            disabled={!selectedProfile || !selectedProfileData?.has_game || isLaunching || isProfileInstalling(selectedProfile)}
          >
            {isLaunching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isProfileInstalling(selectedProfile) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isLaunching ? 'Starting...' : isProfileInstalling(selectedProfile) ? 'インストール中...' : 'Play'}
            </span>
          </motion.button>
        </div>

        {/* Warning Messages */}
        {!selectedProfileData?.has_game && selectedProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-yellow-400 text-xs flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>このプロファイルにはゲームがインストールされていません。プロファイル管理タブからインストールしてください。</span>
          </motion.div>
        )}

        {profiles.length === 0 && !isLoadingProfiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-gray-400 text-xs flex items-center gap-2"
          >
            <span>📝</span>
            <span>プロファイル管理タブで新しいプロファイルを作成してください。</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default HomeTab;