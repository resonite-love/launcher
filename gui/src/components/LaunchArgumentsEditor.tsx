import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Info, 
  Monitor, 
  Globe, 
  Camera, 
  Settings, 
  Eye,
  Folder,
  FileText,
  Gamepad2,
  Users,
  HelpCircle
} from 'lucide-react';

interface LaunchArgumentsEditorProps {
  args: string[];
  onArgsChange: (args: string[]) => void;
}

interface ArgumentPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: string;
  arg: string;
  hasValue?: boolean;
  valueType?: 'text' | 'number' | 'path' | 'boolean';
  placeholder?: string;
  tooltip?: string;
}

const argumentPresets: ArgumentPreset[] = [
  // Hardware/Display
  {
    id: 'skip-intro',
    name: 'イントロチュートリアルをスキップ',
    description: 'イントロチュートリアルの実行を防ぎます',
    icon: Monitor,
    category: 'interface',
    arg: '-SkipIntroTutorial',
    tooltip: '初回起動時のチュートリアルをスキップします'
  },
  {
    id: 'screen-mode',
    name: 'スクリーンモード',
    description: 'デスクトップモードで起動',
    icon: Monitor,
    category: 'hardware',
    arg: '-Screen',
    tooltip: 'VRヘッドセットなしでデスクトップモードで起動します'
  },
  {
    id: 'steamvr',
    name: 'SteamVR',
    description: 'SteamVRデバイスを強制使用',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device SteamVR',
    tooltip: 'SteamVR対応デバイスを強制的に使用します'
  },
  {
    id: 'oculus',
    name: 'Oculus Rift',
    description: 'Oculus Riftデバイスを強制使用',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device Oculus',
    tooltip: 'Oculus Rift + Touchコントローラーを使用します'
  },
  {
    id: 'oculus-quest',
    name: 'Oculus Quest',
    description: 'Oculus Questデバイスを強制使用',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device OculusQuest',
    tooltip: 'Oculus Quest + Touchコントローラーを使用します'
  },
  {
    id: 'windows-mr',
    name: 'Windows MR',
    description: 'Windows Mixed Realityを強制使用',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device WindowsMR',
    tooltip: 'Windows Mixed Realityデバイスを使用します'
  },
  
  // Network/Session
  {
    id: 'invisible',
    name: 'ログイン時に非表示',
    description: 'ログイン時にオンラインステータスを非表示にします',
    icon: Eye,
    category: 'network',
    arg: '-Invisible',
    tooltip: 'ログイン時に他のユーザーから見えない状態になります'
  },
  {
    id: 'lan-only',
    name: 'LAN限定',
    description: 'すべてのワールドをLANのみでアナウンス',
    icon: Globe,
    category: 'network',
    arg: '-ForceLANOnly',
    tooltip: 'ワールドがインターネットからアクセスできないようになります'
  },
  {
    id: 'announce-home',
    name: 'ホームをLANで公開',
    description: 'ホームとUserspaceをLANでアクセス可能にします',
    icon: Users,
    category: 'network',
    arg: '-AnnounceHomeOnLAN',
    tooltip: 'ホームワールドがLANネットワークから参加可能になります'
  },
  {
    id: 'join-auto',
    name: '自動セッション参加',
    description: 'LAN上のアクティブセッションに自動参加',
    icon: Users,
    category: 'network',
    arg: '-Join Auto',
    tooltip: 'LAN上で最も多くのユーザーがいるワールドに自動で参加します'
  },
  
  // Interface
  {
    id: 'no-ui',
    name: 'UI非表示',
    description: 'UserspaceのUIを非表示にします',
    icon: Eye,
    category: 'interface',
    arg: '-NoUI',
    tooltip: 'Userspaceの要素（ロゴやワールドスイッチャーなど）を非表示にします'
  },
  {
    id: 'kiosk',
    name: 'キオスクモード',
    description: 'キオスクモードで実行',
    icon: Monitor,
    category: 'interface',
    arg: '-Kiosk',
    tooltip: 'Userspaceを非表示にし、ゲストのテレポートを無効にします'
  },
  {
    id: 'reset-dash',
    name: 'ダッシュリセット',
    description: 'ダッシュのレイアウトをデフォルトにリセット',
    icon: Settings,
    category: 'interface',
    arg: '-ResetDash',
    tooltip: 'ダッシュボードの配置をデフォルト設定に戻します'
  },
  {
    id: 'no-auto-home',
    name: 'ホーム自動読み込み無効',
    description: '起動時にクラウドホームを自動読み込みしません',
    icon: Folder,
    category: 'interface',
    arg: '-DoNotAutoLoadHome',
    tooltip: '起動時にホームワールドの自動読み込みを無効にします'
  },
  
  // Data/Paths
  {
    id: 'data-path',
    name: 'データパス',
    description: 'データベースディレクトリのパスを指定',
    icon: Folder,
    category: 'paths',
    arg: '-DataPath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'データフォルダのパス',
    tooltip: 'Resoniteのデータベースファイルを保存するディレクトリを指定します'
  },
  {
    id: 'cache-path',
    name: 'キャッシュパス',
    description: 'キャッシュディレクトリのパスを指定',
    icon: Folder,
    category: 'paths',
    arg: '-CachePath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'キャッシュフォルダのパス',
    tooltip: 'Resoniteのキャッシュファイルを保存するディレクトリを指定します'
  },
  {
    id: 'logs-path',
    name: 'ログパス',
    description: 'ログファイルのディレクトリを指定',
    icon: FileText,
    category: 'paths',
    arg: '-LogsPath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'ログフォルダのパス',
    tooltip: 'ログファイルを保存するディレクトリを指定します'
  },
  
  // Graphics
  {
    id: 'ctaa',
    name: 'CTAA有効',
    description: 'Cinematic Temporal Anti-Aliasingを有効にします',
    icon: Camera,
    category: 'graphics',
    arg: '-ctaa',
    tooltip: '高品質なアンチエイリアシングを有効にします（パフォーマンスに影響します）'
  },
  {
    id: 'screen-fullscreen-0',
    name: 'ウィンドウモード',
    description: 'ウィンドウモードで起動',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-fullscreen 0',
    tooltip: 'フルスクリーンではなくウィンドウモードで起動します'
  },
  {
    id: 'screen-fullscreen-1',
    name: 'フルスクリーンモード',
    description: 'フルスクリーンで起動',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-fullscreen 1',
    tooltip: 'フルスクリーンモードで起動します'
  },
  {
    id: 'screen-width',
    name: '画面幅',
    description: '水平解像度を設定',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-width',
    hasValue: true,
    valueType: 'number',
    placeholder: '1920',
    tooltip: 'ウィンドウまたはスクリーンの水平解像度を設定します'
  },
  {
    id: 'screen-height',
    name: '画面高さ',
    description: '垂直解像度を設定',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-height',
    hasValue: true,
    valueType: 'number',
    placeholder: '1080',
    tooltip: 'ウィンドウまたはスクリーンの垂直解像度を設定します'
  },
  
  // Advanced/Debug
  {
    id: 'verbose',
    name: '詳細ログ',
    description: 'エンジン初期化中により詳細なログを出力',
    icon: FileText,
    category: 'debug',
    arg: '-Verbose',
    tooltip: 'デバッグやプラグイン開発に有用な詳細なログを出力します'
  },
  {
    id: 'force-no-voice',
    name: '音声無効',
    description: 'CommonAvatarBuilderで音声を設定しません',
    icon: Settings,
    category: 'debug',
    arg: '-ForceNoVoice',
    tooltip: 'ローカルプレゼンテーション用に音声機能を無効にします'
  }
];

const categories = {
  hardware: { name: 'ハードウェア/VR', icon: Gamepad2, color: 'text-purple-400' },
  network: { name: 'ネットワーク', icon: Globe, color: 'text-blue-400' },
  interface: { name: 'インターフェース', icon: Monitor, color: 'text-green-400' },
  paths: { name: 'パス設定', icon: Folder, color: 'text-yellow-400' },
  graphics: { name: 'グラフィック', icon: Camera, color: 'text-red-400' },
  debug: { name: 'デバッグ/詳細', icon: Settings, color: 'text-gray-400' }
};

function LaunchArgumentsEditor({ args, onArgsChange }: LaunchArgumentsEditorProps) {
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set());
  const [presetValues, setPresetValues] = useState<{[key: string]: string}>({});
  const [customArgs, setCustomArgs] = useState<string[]>([]);
  const [newCustomArg, setNewCustomArg] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初期化時のみ引数を解析
  useEffect(() => {
    if (isInitialized) return;

    const newActivePresets = new Set<string>();
    const newPresetValues: {[key: string]: string} = {};
    const newCustomArgs: string[] = [];

    args.forEach(arg => {
      let matched = false;
      
      argumentPresets.forEach(preset => {
        if (preset.hasValue) {
          // 値を持つ引数の場合
          if (arg.startsWith(preset.arg + ' ')) {
            newActivePresets.add(preset.id);
            newPresetValues[preset.id] = arg.substring(preset.arg.length + 1);
            matched = true;
          }
        } else {
          // 値を持たない引数の場合
          if (arg === preset.arg) {
            newActivePresets.add(preset.id);
            matched = true;
          }
        }
      });

      if (!matched) {
        newCustomArgs.push(arg);
      }
    });

    setActivePresets(newActivePresets);
    setPresetValues(newPresetValues);
    setCustomArgs(newCustomArgs);
    setIsInitialized(true);
  }, [args, isInitialized]);

  const updateArgs = useCallback(() => {
    if (!isInitialized) return;

    const newArgs: string[] = [];

    // プリセット引数を追加
    argumentPresets.forEach(preset => {
      if (activePresets.has(preset.id)) {
        if (preset.hasValue) {
          const value = presetValues[preset.id] || '';
          if (value.trim()) {
            newArgs.push(`${preset.arg} ${value.trim()}`);
          }
        } else {
          newArgs.push(preset.arg);
        }
      }
    });

    // カスタム引数を追加
    customArgs.forEach(arg => {
      if (arg.trim()) {
        newArgs.push(arg.trim());
      }
    });

    onArgsChange(newArgs);
  }, [activePresets, presetValues, customArgs, isInitialized, onArgsChange]);

  useEffect(() => {
    updateArgs();
  }, [updateArgs]);

  const togglePreset = (presetId: string) => {
    const preset = argumentPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    const newActivePresets = new Set(activePresets);
    
    // ハードウェア/VRカテゴリの場合は排他的選択
    if (preset.category === 'hardware') {
      // 同じカテゴリの他のプリセットを全て無効化
      argumentPresets.forEach(p => {
        if (p.category === 'hardware' && p.id !== presetId) {
          newActivePresets.delete(p.id);
        }
      });
      
      // 選択されたプリセットをトグル
      if (newActivePresets.has(presetId)) {
        newActivePresets.delete(presetId);
      } else {
        newActivePresets.add(presetId);
      }
    } else {
      // その他のカテゴリは通常通りトグル
      if (newActivePresets.has(presetId)) {
        newActivePresets.delete(presetId);
      } else {
        newActivePresets.add(presetId);
      }
    }
    
    setActivePresets(newActivePresets);
  };

  const updatePresetValue = (presetId: string, value: string) => {
    setPresetValues(prev => ({
      ...prev,
      [presetId]: value
    }));
  };

  const addCustomArg = () => {
    if (newCustomArg.trim()) {
      setCustomArgs(prev => [...prev, newCustomArg.trim()]);
      setNewCustomArg('');
    }
  };

  const removeCustomArg = (index: number) => {
    setCustomArgs(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomArg = (index: number, value: string) => {
    setCustomArgs(prev => prev.map((arg, i) => i === index ? value : arg));
  };

  const filteredPresets = activeCategory 
    ? argumentPresets.filter(preset => preset.category === activeCategory)
    : argumentPresets;

  return (
    <div className="space-y-6">
      {/* カテゴリー選択 */}
      <div className="flex flex-wrap gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === null
              ? 'bg-resonite-blue text-white'
              : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
          }`}
          onClick={() => setActiveCategory(null)}
        >
          すべて
        </motion.button>
        {Object.entries(categories).map(([key, category]) => {
          const Icon = category.icon;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeCategory === key
                  ? 'bg-resonite-blue text-white'
                  : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
              }`}
              onClick={() => setActiveCategory(key)}
            >
              <Icon className="w-4 h-4" />
              <span>{category.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* プリセット引数 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredPresets.map(preset => {
          const Icon = preset.icon;
          const isActive = activePresets.has(preset.id);
          const categoryInfo = categories[preset.category as keyof typeof categories];
          
          return (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'border-resonite-blue bg-resonite-blue/10'
                  : 'border-dark-600 bg-dark-800/30 hover:border-dark-500'
              }`}
              onClick={() => togglePreset(preset.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-resonite-blue/20' : 'bg-dark-700'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-resonite-blue' : categoryInfo.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                        {preset.name}
                      </h4>
                      {preset.tooltip && (
                        <div className="group relative">
                          <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-dark-900 border border-dark-600 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 w-80 shadow-lg">
                            {preset.tooltip}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className={`text-sm ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                      {preset.description}
                    </p>
                    <p className={`text-xs font-mono mt-1 ${isActive ? 'text-resonite-blue' : 'text-gray-600'}`}>
                      {preset.arg}
                    </p>
                  </div>
                </div>
                
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-6 h-6 rounded-full border-2 transition-colors ${
                    isActive
                      ? 'border-resonite-blue bg-resonite-blue'
                      : 'border-gray-500 hover:border-gray-400'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreset(preset.id);
                  }}
                >
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* 値入力フィールド */}
              {preset.hasValue && isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <input
                    type={preset.valueType === 'number' ? 'number' : 'text'}
                    value={presetValues[preset.id] || ''}
                    onChange={(e) => updatePresetValue(preset.id, e.target.value)}
                    placeholder={preset.placeholder}
                    className="input-primary w-full text-sm select-text"
                    onClick={(e) => e.stopPropagation()}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* カスタム引数セクション */}
      <div className="border border-dark-600 rounded-lg p-4">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">カスタム引数</h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-500 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-dark-900 border border-dark-600 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 w-80 shadow-lg">
              プリセットにない引数や、特別な設定が必要な引数を手動で追加できます
            </div>
          </div>
        </div>

        {/* 新しいカスタム引数の追加 */}
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newCustomArg}
            onChange={(e) => setNewCustomArg(e.target.value)}
            placeholder="例: -CustomArgument value"
            className="input-primary flex-1 select-text"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomArg();
              }
            }}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center space-x-2"
            onClick={addCustomArg}
            disabled={!newCustomArg.trim()}
          >
            <Plus className="w-4 h-4" />
            <span>追加</span>
          </motion.button>
        </div>

        {/* カスタム引数一覧 */}
        {customArgs.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>カスタム引数はありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customArgs.map((arg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center space-x-2 p-2 bg-dark-800/50 border border-dark-600/50 rounded-lg"
              >
                <input
                  type="text"
                  value={arg}
                  onChange={(e) => updateCustomArg(index, e.target.value)}
                  className="input-primary flex-1 select-text"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-danger flex items-center space-x-1"
                  onClick={() => removeCustomArg(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 現在の引数プレビュー */}
      {args.length > 0 && (
        <div className="border border-dark-600 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">現在の起動引数</h3>
          </div>
          <div className="bg-dark-900 rounded-lg p-3 font-mono text-sm select-text">
            <div className="text-gray-300 break-all">
              {args.join(' ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LaunchArgumentsEditor;