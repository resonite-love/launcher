import { motion } from 'framer-motion';
import { Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WebSocketRelayPlugin from './WebSocketRelayPlugin';

function PluginsTab() {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center space-x-3">
          <Plug className="w-6 h-6 text-resonite-blue" />
          <h2 className="text-2xl font-bold text-white">{t('plugins.title')}</h2>
        </div>

        {/* Plugin List */}
        <div className="space-y-4">
          <WebSocketRelayPlugin />
        </div>
      </motion.div>
    </div>
  );
}

export default PluginsTab;
