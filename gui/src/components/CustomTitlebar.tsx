import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react';
import { appWindow } from '@tauri-apps/api/window';

function CustomTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovered, setIsHovered] = useState<string | null>(null);

  useEffect(() => {
    // Listen for window state changes
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    // Get initial state
    appWindow.isMaximized().then(setIsMaximized);

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      appWindow.unmaximize();
    } else {
      appWindow.maximize();
    }
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-8 bg-dark-900/80 backdrop-blur-md select-none"
      data-tauri-drag-region
    >
      {/* Left side - App title */}
      <div className="flex items-center px-4" data-tauri-drag-region>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-resonite-blue to-resonite-purple flex-shrink-0" />
          <span className="text-sm font-medium text-white">Resonite Tools</span>
        </div>
      </div>

      {/* Center - Draggable area */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* Right side - Window controls */}
      <div className="flex items-center">
        {/* Minimize Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-8 flex items-center justify-center transition-colors duration-150 ${
            isHovered === 'minimize' 
              ? 'bg-gray-600/50' 
              : 'hover:bg-gray-600/30'
          }`}
          onClick={handleMinimize}
          onMouseEnter={() => setIsHovered('minimize')}
          onMouseLeave={() => setIsHovered(null)}
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-gray-300" />
        </motion.button>

        {/* Maximize/Restore Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-8 flex items-center justify-center transition-colors duration-150 ${
            isHovered === 'maximize' 
              ? 'bg-gray-600/50' 
              : 'hover:bg-gray-600/30'
          }`}
          onClick={handleMaximize}
          onMouseEnter={() => setIsHovered('maximize')}
          onMouseLeave={() => setIsHovered(null)}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Minimize2 className="w-3.5 h-3.5 text-gray-300" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-gray-300" />
          )}
        </motion.button>

        {/* Close Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-8 flex items-center justify-center transition-colors duration-150 ${
            isHovered === 'close' 
              ? 'bg-red-600/80' 
              : 'hover:bg-red-600/60'
          }`}
          onClick={handleClose}
          onMouseEnter={() => setIsHovered('close')}
          onMouseLeave={() => setIsHovered(null)}
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-300" />
        </motion.button>
      </div>
    </div>
  );
}

export default CustomTitlebar;