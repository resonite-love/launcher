import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronDown, Info, Calendar, Loader2, RefreshCw, Construction, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store/useAppStore';
import { useProfiles, useLaunchResonite, useSteamNews } from '../hooks/useQueries';
import { UpdateNote } from '../types/steam-news';

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

  const { 
    data: updateNotes = [], 
    isLoading: isLoadingNews,
    refetch: refetchNews 
  } = useSteamNews();

  const launchMutation = useLaunchResonite();

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
    refetchNews();
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
              disabled={isLoadingProfiles || isLoadingNews}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingProfiles || isLoadingNews ? 'animate-spin' : ''}`} />
              <span>更新</span>
            </motion.button>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4">
            {isLoadingNews ? (
              /* Loading state */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-12"
              >
                <Loader2 className="w-16 h-16 text-resonite-blue mb-4 animate-spin" />
                <h3 className="text-xl font-semibold text-white mb-2">アップデート情報を取得中...</h3>
                <p className="text-gray-400">Resoniteの最新情報を読み込んでいます</p>
              </motion.div>
            ) : updateNotes.length === 0 ? (
              /* No data state */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-12"
              >
                <Info className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">アップデート情報なし</h3>
                <p className="text-gray-400 mb-1">現在表示可能なアップデート情報がありません</p>
                <p className="text-gray-500 text-sm">
                  更新ボタンを押して最新情報を取得してください
                </p>
              </motion.div>
            ) : (
              updateNotes.map((update, index) => (
                <motion.div
                  key={update.gid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-dark-800/50 border border-dark-600/30 rounded-lg p-6 hover:border-resonite-blue/30 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {update.title}
                      </h3>
                      {update.version && (
                        <span className="inline-block px-3 py-1 bg-resonite-blue/20 text-resonite-blue text-sm rounded-full font-mono">
                          v{update.version}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-gray-400 text-sm flex-shrink-0 ml-4">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{update.formattedDate}</span>
                      </div>
                      <motion.a
                        href={update.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        className="p-1 hover:text-resonite-blue transition-colors duration-200"
                        title="Steam で開く"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </motion.a>
                    </div>
                  </div>
                  
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-xl font-bold text-white mb-3 mt-4 first:mt-0">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-lg font-semibold text-resonite-blue mb-2 mt-4 first:mt-0 flex items-center">
                            <div className="w-2 h-2 bg-resonite-blue rounded-full mr-2" />
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-md font-medium text-gray-200 mb-2 mt-3 first:mt-0">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="space-y-1 mb-4 ml-2">{children}</ul>
                        ),
                        li: ({ children }) => (
                          <li className="flex items-start space-x-2 text-gray-300 text-sm">
                            <div className="w-1 h-1 bg-gray-500 rounded-full mt-2 flex-shrink-0" />
                            <span className="leading-relaxed">{children}</span>
                          </li>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-white font-semibold">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="text-gray-200 italic">{children}</em>
                        ),
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-resonite-blue hover:text-blue-300 underline transition-colors duration-200"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="bg-dark-700 text-gray-200 px-1 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {update.rawContent}
                    </ReactMarkdown>
                  </div>
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