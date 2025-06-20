import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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

const getArgumentPresets = (t: any): ArgumentPreset[] => [
  // Hardware/Display
  {
    id: 'skip-intro',
    name: t('launchArgs.presets.skipIntroTutorial'),
    description: t('launchArgs.presets.skipIntroTutorial'),
    icon: Monitor,
    category: 'interface',
    arg: '-SkipIntroTutorial',
    tooltip: t('launchArgs.presets.skipIntroTutorial')
  },
  {
    id: 'screen-mode',
    name: t('launchArgs.presets.screen'),
    description: t('launchArgs.presets.screen'),
    icon: Monitor,
    category: 'hardware',
    arg: '-Screen',
    tooltip: t('launchArgs.presets.screen')
  },
  {
    id: 'steamvr',
    name: 'SteamVR',
    description: 'Force use SteamVR device',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device SteamVR',
    tooltip: 'Force use SteamVR compatible device'
  },
  {
    id: 'oculus',
    name: 'Oculus Rift',
    description: 'Force use Oculus Rift device',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device Oculus',
    tooltip: 'Use Oculus Rift + Touch controllers'
  },
  {
    id: 'oculus-quest',
    name: 'Oculus Quest',
    description: 'Force use Oculus Quest device',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device OculusQuest',
    tooltip: 'Use Oculus Quest + Touch controllers'
  },
  {
    id: 'windows-mr',
    name: 'Windows MR',
    description: 'Force use Windows Mixed Reality',
    icon: Gamepad2,
    category: 'hardware',
    arg: '-Device WindowsMR',
    tooltip: 'Use Windows Mixed Reality device'
  },
  
  // Network/Session
  {
    id: 'invisible',
    name: t('launchArgs.presets.invisible'),
    description: t('launchArgs.presets.invisible'),
    icon: Eye,
    category: 'network',
    arg: '-Invisible',
    tooltip: t('launchArgs.presets.invisible')
  },
  {
    id: 'lan-only',
    name: t('launchArgs.presets.forceLANOnly'),
    description: t('launchArgs.presets.forceLANOnly'),
    icon: Globe,
    category: 'network',
    arg: '-ForceLANOnly',
    tooltip: t('launchArgs.presets.forceLANOnly')
  },
  {
    id: 'announce-home',
    name: 'Announce Home on LAN',
    description: 'Make home and userspace accessible on LAN',
    icon: Users,
    category: 'network',
    arg: '-AnnounceHomeOnLAN',
    tooltip: 'Makes home world joinable from LAN network'
  },
  {
    id: 'join-auto',
    name: t('launchArgs.presets.join'),
    description: t('launchArgs.presets.join'),
    icon: Users,
    category: 'network',
    arg: '-Join Auto',
    tooltip: t('launchArgs.presets.join')
  },
  
  // Interface
  {
    id: 'no-ui',
    name: t('launchArgs.presets.noUI'),
    description: t('launchArgs.presets.noUI'),
    icon: Eye,
    category: 'interface',
    arg: '-NoUI',
    tooltip: t('launchArgs.presets.noUI')
  },
  {
    id: 'kiosk',
    name: t('launchArgs.presets.kiosk'),
    description: t('launchArgs.presets.kiosk'),
    icon: Monitor,
    category: 'interface',
    arg: '-Kiosk',
    tooltip: t('launchArgs.presets.kiosk')
  },
  {
    id: 'reset-dash',
    name: t('launchArgs.presets.resetDash'),
    description: t('launchArgs.presets.resetDash'),
    icon: Settings,
    category: 'interface',
    arg: '-ResetDash',
    tooltip: t('launchArgs.presets.resetDash')
  },
  {
    id: 'no-auto-home',
    name: t('launchArgs.presets.doNotAutoLoadHome'),
    description: t('launchArgs.presets.doNotAutoLoadHome'),
    icon: Folder,
    category: 'interface',
    arg: '-DoNotAutoLoadHome',
    tooltip: t('launchArgs.presets.doNotAutoLoadHome')
  },
  
  // Data/Paths
  {
    id: 'data-path',
    name: t('launchArgs.presets.dataPath'),
    description: t('launchArgs.presets.dataPath'),
    icon: Folder,
    category: 'paths',
    arg: '-DataPath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'Data folder path',
    tooltip: t('launchArgs.presets.dataPath')
  },
  {
    id: 'cache-path',
    name: t('launchArgs.presets.cachePath'),
    description: t('launchArgs.presets.cachePath'),
    icon: Folder,
    category: 'paths',
    arg: '-CachePath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'Cache folder path',
    tooltip: t('launchArgs.presets.cachePath')
  },
  {
    id: 'logs-path',
    name: t('launchArgs.presets.logPath'),
    description: t('launchArgs.presets.logPath'),
    icon: FileText,
    category: 'paths',
    arg: '-LogsPath',
    hasValue: true,
    valueType: 'path',
    placeholder: 'Log folder path',
    tooltip: t('launchArgs.presets.logPath')
  },
  
  // Graphics
  {
    id: 'ctaa',
    name: t('launchArgs.presets.ctaa'),
    description: t('launchArgs.presets.ctaa'),
    icon: Camera,
    category: 'graphics',
    arg: '-ctaa',
    tooltip: t('launchArgs.presets.ctaa')
  },
  {
    id: 'screen-fullscreen-0',
    name: 'Windowed Mode',
    description: 'Launch in windowed mode',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-fullscreen 0',
    tooltip: 'Launch in windowed mode instead of fullscreen'
  },
  {
    id: 'screen-fullscreen-1',
    name: 'Fullscreen Mode',
    description: 'Launch in fullscreen',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-fullscreen 1',
    tooltip: 'Launch in fullscreen mode'
  },
  {
    id: 'screen-width',
    name: 'Screen Width',
    description: 'Set horizontal resolution',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-width',
    hasValue: true,
    valueType: 'number',
    placeholder: '1920',
    tooltip: 'Set horizontal resolution of window or screen'
  },
  {
    id: 'screen-height',
    name: 'Screen Height',
    description: 'Set vertical resolution',
    icon: Monitor,
    category: 'graphics',
    arg: '-screen-height',
    hasValue: true,
    valueType: 'number',
    placeholder: '1080',
    tooltip: 'Set vertical resolution of window or screen'
  },
  
  // Advanced/Debug
  {
    id: 'verbose',
    name: 'Verbose Logging',
    description: 'Output more detailed logs during engine initialization',
    icon: FileText,
    category: 'debug',
    arg: '-Verbose',
    tooltip: 'Outputs detailed logs useful for debugging and plugin development'
  },
  {
    id: 'force-no-voice',
    name: 'Disable Voice',
    description: 'Does not set up voice in CommonAvatarBuilder',
    icon: Settings,
    category: 'debug',
    arg: '-ForceNoVoice',
    tooltip: 'Disables voice functionality for local presentations'
  }
];

const getCategories = (t: any) => ({
  hardware: { name: t('launchArgs.categories.hardware'), icon: Gamepad2, color: 'text-purple-400' },
  network: { name: t('launchArgs.categories.network'), icon: Globe, color: 'text-blue-400' },
  interface: { name: t('launchArgs.categories.interface'), icon: Monitor, color: 'text-green-400' },
  paths: { name: t('launchArgs.categories.paths'), icon: Folder, color: 'text-yellow-400' },
  graphics: { name: t('launchArgs.categories.graphics'), icon: Camera, color: 'text-red-400' },
  debug: { name: t('launchArgs.categories.debug'), icon: Settings, color: 'text-gray-400' }
});

function LaunchArgumentsEditor({ args, onArgsChange }: LaunchArgumentsEditorProps) {
  const { t } = useTranslation();
  const argumentPresets = getArgumentPresets(t);
  const categories = getCategories(t);
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set());
  const [presetValues, setPresetValues] = useState<{[key: string]: string}>({});
  const [customArgs, setCustomArgs] = useState<string[]>([]);
  const [newCustomArg, setNewCustomArg] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Parse arguments only during initialization
  useEffect(() => {
    if (isInitialized) return;

    const newActivePresets = new Set<string>();
    const newPresetValues: {[key: string]: string} = {};
    const newCustomArgs: string[] = [];

    args.forEach(arg => {
      let matched = false;
      
      argumentPresets.forEach(preset => {
        if (preset.hasValue) {
          // For arguments with values
          if (arg.startsWith(preset.arg + ' ')) {
            newActivePresets.add(preset.id);
            newPresetValues[preset.id] = arg.substring(preset.arg.length + 1);
            matched = true;
          }
        } else {
          // For arguments without values
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

    // Add preset arguments
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

    // Add custom arguments
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
    
    // Hardware/VR category uses exclusive selection
    if (preset.category === 'hardware') {
      // Disable all other presets in the same category
      argumentPresets.forEach(p => {
        if (p.category === 'hardware' && p.id !== presetId) {
          newActivePresets.delete(p.id);
        }
      });
      
      // Toggle the selected preset
      if (newActivePresets.has(presetId)) {
        newActivePresets.delete(presetId);
      } else {
        newActivePresets.add(presetId);
      }
    } else {
      // Other categories toggle normally
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
      {/* Category selection */}
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
          {t('launchArgs.all')}
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

      {/* Preset arguments */}
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
                          <HelpCircle className="w-3 h-3 text-gray-500 pointer-events-none" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-dark-900 border border-dark-600 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 w-80 shadow-lg pointer-events-none">
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

              {/* Value input field */}
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

      {/* Custom arguments section */}
      <div className="border border-dark-600 rounded-lg p-4">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">{t('launchArgs.custom.title')}</h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-500 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-dark-900 border border-dark-600 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 w-80 shadow-lg">
              {t('launchArgs.custom.description')}
            </div>
          </div>
        </div>

        {/* Adding new custom arguments */}
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newCustomArg}
            onChange={(e) => setNewCustomArg(e.target.value)}
            placeholder={t('launchArgs.custom.placeholder')}
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
            <span>{t('launchArgs.custom.add')}</span>
          </motion.button>
        </div>

        {/* Custom arguments list */}
        {customArgs.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>{t('launchArgs.custom.noCustomArgs')}</p>
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

      {/* Current arguments preview */}
      {args.length > 0 && (
        <div className="border border-dark-600 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">{t('launchArgs.currentArgs')}</h3>
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