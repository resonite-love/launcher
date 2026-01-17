import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useTranslation } from 'react-i18next';
import {
  Terminal,
  Pause,
  Play,
  Trash2,
  XCircle,
  ChevronDown,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  MessageSquare,
  FolderOpen,
  Monitor,
  Headphones,
  Loader2,
  Search,
  X,
  Regex
} from 'lucide-react';

interface LogLine {
  source_id: string;
  line: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'message' | 'unknown';
  timestamp?: string;
}

interface LogSource {
  id: string;
  name: string;
  path: string;
  exists: boolean;
}

// ログレベルに応じた色とアイコン
const levelConfig = {
  debug: { color: 'text-gray-400', bgColor: 'bg-gray-800/30', icon: Bug },
  info: { color: 'text-blue-400', bgColor: 'bg-blue-900/20', icon: Info },
  warning: { color: 'text-yellow-400', bgColor: 'bg-yellow-900/20', icon: AlertTriangle },
  error: { color: 'text-red-400', bgColor: 'bg-red-900/20', icon: AlertCircle },
  message: { color: 'text-green-400', bgColor: 'bg-green-900/20', icon: MessageSquare },
  unknown: { color: 'text-gray-300', bgColor: 'bg-transparent', icon: Terminal },
};

export default function LogViewerApp() {
  const { t } = useTranslation();
  const [profileName, setProfileName] = useState<string>('');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [sources, setSources] = useState<LogSource[]>([]);
  const [activeSource, setActiveSource] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isKilling, setIsKilling] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchDropdownOpen, setLaunchDropdownOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const pausedLogsRef = useRef<LogLine[]>([]);

  // URLからプロファイル名を取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profile = params.get('profile');
    if (profile) {
      setProfileName(decodeURIComponent(profile));
    }
  }, []);

  // ログソースを取得
  useEffect(() => {
    if (!profileName) return;

    invoke<LogSource[]>('get_log_sources', { profileName })
      .then(setSources)
      .catch(console.error);
  }, [profileName]);

  // ログイベントをリッスン
  useEffect(() => {
    const unlisten = listen<LogLine[]>('log-lines', (event) => {
      const newLines = event.payload;
      
      if (isPaused) {
        pausedLogsRef.current = [...pausedLogsRef.current, ...newLines];
      } else {
        setLogs(prev => {
          const combined = [...prev, ...newLines];
          // 最大10000行を保持
          return combined.slice(-10000);
        });
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [isPaused]);

  // 一時停止解除時にバッファしたログを追加
  useEffect(() => {
    if (!isPaused && pausedLogsRef.current.length > 0) {
      setLogs(prev => {
        const combined = [...prev, ...pausedLogsRef.current];
        pausedLogsRef.current = [];
        return combined.slice(-10000);
      });
    }
  }, [isPaused]);

  // 自動スクロール
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // フィルタ変更時も自動スクロールを維持
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      // 少し遅延させてDOM更新後にスクロール
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      });
    }
  }, [filterText, isRegexMode, activeSource]);

  // スクロールイベントで自動スクロールを制御
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // 正規表現のバリデーション
  useEffect(() => {
    if (isRegexMode && filterText.trim()) {
      try {
        new RegExp(filterText, 'i');
        setRegexError(null);
      } catch (e) {
        if (e instanceof Error) {
          setRegexError(e.message);
        }
      }
    } else {
      setRegexError(null);
    }
  }, [filterText, isRegexMode]);

  // フィルタリングされたログ
  const filteredLogs = useMemo(() => {
    let result = activeSource === 'all'
      ? logs
      : logs.filter(log => log.source_id === activeSource);

    if (filterText.trim()) {
      if (isRegexMode) {
        try {
          const regex = new RegExp(filterText, 'i');
          result = result.filter(log => regex.test(log.line));
        } catch {
          // 正規表現エラー時はフィルタリングしない
        }
      } else {
        const lowerFilter = filterText.toLowerCase();
        result = result.filter(log => log.line.toLowerCase().includes(lowerFilter));
      }
    }

    return result;
  }, [logs, activeSource, filterText, isRegexMode]);

  // ログをクリア
  const clearLogs = () => {
    setLogs([]);
    pausedLogsRef.current = [];
  };

  // Resoniteを終了
  const killResonite = async () => {
    if (!profileName) return;
    setIsKilling(true);
    try {
      await invoke('kill_resonite', { profileName });
    } catch (e) {
      console.error('Failed to kill Resonite:', e);
    } finally {
      setIsKilling(false);
    }
  };

  // Resoniteを起動
  const launchResonite = async (mode?: string) => {
    if (!profileName) return;
    setIsLaunching(true);
    setLaunchDropdownOpen(false);
    try {
      if (mode) {
        await invoke('launch_resonite_with_mode', { profileName, mode });
      } else {
        await invoke('launch_resonite', { profileName });
      }
    } catch (e) {
      console.error('Failed to launch Resonite:', e);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="h-screen bg-dark-950 flex flex-col text-white">
      {/* Header */}
      <header className="bg-dark-900/80 border-b border-dark-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5 text-resonite-blue" />
            <h1 className="font-medium">{profileName || 'Log Viewer'}</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Launch Resonite */}
            <div className="relative flex items-stretch">
              <button
                onClick={() => launchResonite()}
                disabled={isLaunching}
                className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 border-r-0 rounded-l text-green-400 text-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isLaunching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{isLaunching ? t('common.starting') : t('common.launch')}</span>
              </button>
              <button
                onClick={() => setLaunchDropdownOpen(!launchDropdownOpen)}
                disabled={isLaunching}
                className="px-2 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-r text-green-400 text-sm flex items-center transition-colors disabled:opacity-50"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              
              {launchDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-40">
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-dark-700 first:rounded-t-lg transition-colors flex items-center space-x-2 text-sm"
                    onClick={() => launchResonite('screen')}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>{t('profiles.launchModes.screen')}</span>
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-dark-700 last:rounded-b-lg transition-colors flex items-center space-x-2 text-sm"
                    onClick={() => launchResonite('vr')}
                  >
                    <Headphones className="w-4 h-4" />
                    <span>{t('profiles.launchModes.vr')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Kill Resonite */}
            <button
              onClick={killResonite}
              disabled={isKilling}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded text-red-400 text-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{isKilling ? t('logViewer.killing') : t('logViewer.kill')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-dark-900/50 border-b border-dark-700/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSource('all')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeSource === 'all'
                ? 'bg-resonite-blue/20 text-resonite-blue border border-resonite-blue/30'
                : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            {t('logViewer.all')}
          </button>
          {sources.filter(s => s.exists).map(source => (
            <div key={source.id} className="flex items-stretch">
              <button
                onClick={() => setActiveSource(source.id)}
                className={`px-3 py-1.5 rounded-l text-sm transition-colors flex items-center ${
                  activeSource === source.id
                    ? 'bg-resonite-blue/20 text-resonite-blue border border-resonite-blue/30 border-r-0'
                    : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
                }`}
              >
                {source.name}
              </button>
              <button
                onClick={() => {
                  // パスからディレクトリを取得して開く
                  const dir = source.path.replace(/[/\\][^/\\]+$/, '');
                  invoke('open_folder', { path: dir }).catch(console.error);
                }}
                className={`px-2 rounded-r text-sm transition-colors flex items-center ${
                  activeSource === source.id
                    ? 'bg-resonite-blue/20 text-resonite-blue border border-resonite-blue/30 border-l-0'
                    : 'text-gray-500 hover:text-white hover:bg-dark-800/50'
                }`}
                title={t('logViewer.openLogFolder', { name: source.name })}
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded transition-colors ${
              isPaused 
                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' 
                : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
            }`}
            title={isPaused ? t('logViewer.resume') : t('logViewer.pause')}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-dark-800/50 transition-colors"
            title={t('logViewer.clearLogs')}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Auto-scroll indicator */}
          <button
            onClick={() => {
              setAutoScroll(true);
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            }}
            className={`p-1.5 rounded transition-colors ${
              autoScroll 
                ? 'text-green-400' 
                : 'text-gray-500 hover:text-white hover:bg-dark-800/50'
            }`}
            title={autoScroll ? t('logViewer.autoScrollEnabled') : t('logViewer.scrollToBottom')}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-dark-900/30 border-b border-dark-700/30 px-4 py-1.5 flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('logViewer.filterPlaceholder')}
            className={`w-full pl-8 pr-7 py-1 bg-dark-800 border rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-resonite-blue/50 ${
              regexError ? 'border-red-500/50' : 'border-dark-600'
            }`}
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setIsRegexMode(!isRegexMode)}
          className={`px-1.5 py-1 rounded text-xs flex items-center space-x-1 transition-colors ${
            isRegexMode
              ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
              : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
          }`}
          title={t('logViewer.regexMode')}
        >
          <Regex className="w-3.5 h-3.5" />
          <span>Regex</span>
        </button>
        {regexError && (
          <span className="text-red-400 text-xs">{regexError}</span>
        )}
        {filterText && (
          <span className="text-gray-500 text-xs">
            {t('logViewer.matchCount', { count: filteredLogs.length })}
          </span>
        )}
      </div>

      {/* Paused Banner */}
      {isPaused && (
        <div className="bg-yellow-600/20 border-b border-yellow-600/30 px-4 py-1.5 flex items-center space-x-2">
          <Pause className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-200 text-sm">
            {t('logViewer.paused')} - {t('logViewer.newLinesBuffered', { count: pausedLogsRef.current.length })}
          </span>
        </div>
      )}

      {/* Log Content */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-sm p-2 space-y-0.5"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('logViewer.waitingForLogs')}</p>
              <p className="text-xs mt-1">{t('logViewer.startResoniteHint')}</p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const config = levelConfig[log.level];
            const Icon = config.icon;
            
            return (
              <div
                key={index}
                className={`flex items-start space-x-2 px-2 py-0.5 rounded ${config.bgColor} hover:bg-dark-800/50`}
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                {activeSource === 'all' && (
                  <span className="text-gray-500 text-xs w-16 flex-shrink-0">
                    [{log.source_id}]
                  </span>
                )}
                <span className={`${config.color} break-all whitespace-pre-wrap`}>
                  {log.line}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Status Bar */}
      <footer className="bg-dark-900/50 border-t border-dark-700/30 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>{t('logViewer.lines', { count: filteredLogs.length })}</span>
        <span>
          {t('logViewer.activeSources', { count: sources.filter(s => s.exists).length })}
        </span>
      </footer>
    </div>
  );
}
