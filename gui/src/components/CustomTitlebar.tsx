import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, X } from 'lucide-react';
import { appWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import iconPng from '../assets/icon.png';

function CustomTitlebar() {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState<string | null>(null);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div 
      className="top-0 left-0 right-0 z-[9999] flex items-center justify-between h-8 bg-dark-900/80 backdrop-blur-md select-none"
      data-tauri-drag-region
      onDoubleClick={(e) => e.preventDefault()}
    >
      {/* Left side - App title */}
      <div className="flex items-center px-4" data-tauri-drag-region>
        <div className="flex items-center space-x-2" data-tauri-drag-region>
          <img 
            src={iconPng} 
            alt="RESO Launcher" 
            className="w-4 h-4 flex-shrink-0" 
            data-tauri-drag-region 
          />
          <span className="text-sm font-medium text-white" data-tauri-drag-region>
            RESO Launcher&nbsp; 
            <span className="text-xs" data-tauri-drag-region>{t('titlebar.poweredBy')}</span>
          </span>
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