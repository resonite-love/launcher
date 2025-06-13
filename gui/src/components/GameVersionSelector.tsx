import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, History, Calendar } from 'lucide-react';

interface GameVersion {
  gameVersion: string;
  manifestId: string;
  timestamp: string;
}

interface GameVersionSelectorProps {
  branch: string;
  selectedVersion?: string | null;
  onVersionSelect: (version: string | null) => void;
  disabled?: boolean;
}

function GameVersionSelector({ branch, selectedVersion, onVersionSelect, disabled }: GameVersionSelectorProps) {
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [branch]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<any>('get_game_versions');
      
      // Filter versions by branch
      const branchVersions = response[branch] || [];
      setVersions(branchVersions.reverse());
    } catch (err) {
      console.error('Failed to load game versions:', err);
      setError('バージョン情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };


  const formatVersionForDisplay = (version: GameVersion) => {
    return `${version.gameVersion}`;
  };

  return (
    <div className="space-y-2 relative z-20">
      <label className="block text-sm font-medium text-gray-300">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4" />
          <span>バージョン選択（オプション）</span>
        </div>
      </label>
      
      <div className="relative">
        {isLoading ? (
          <div className="select-primary w-full pr-10 text-sm flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            読み込み中...
          </div>
        ) : error ? (
          <div className="select-primary w-full text-sm text-red-400">
            {error}
          </div>
        ) : (
          <>
            <select
              value={selectedVersion || ''}
              onChange={(e) => onVersionSelect(e.target.value || null)}
              className="select-primary w-full appearance-none pr-10 text-sm cursor-pointer relative z-10"
              disabled={disabled || versions.length === 0}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              <option value="">
                最新版を使用（推奨）
              </option>
              {versions.map((version) => (
                <option key={version.manifestId} value={version.manifestId}>
                  {formatVersionForDisplay(version)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-0" />
          </>
        )}
      </div>

      {selectedVersion && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 p-3 bg-dark-800/50 border border-dark-600/30 rounded-lg"
        >
          <div className="flex items-start space-x-2 text-xs">
            <Calendar className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-yellow-400 font-medium">特定バージョンが選択されています</p>
              <p className="text-gray-400">
                選択したバージョン: {versions.find(v => v.manifestId === selectedVersion)?.gameVersion}
              </p>
              <p className="text-gray-500">
                このバージョンに固定してインストールされます。最新版への自動更新は行われません。
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        特定のバージョンを選択すると、そのバージョンに固定されます。
        通常は「最新版を使用」を選択することをお勧めします。
      </p>
    </div>
  );
}

export default GameVersionSelector;