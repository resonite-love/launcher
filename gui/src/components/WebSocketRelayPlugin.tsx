import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Radio,
  Play,
  Square,
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  Link
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

type Mode = 'host' | 'client';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectedClient {
  id: string;
  connectedAt: Date;
}

function WebSocketRelayPlugin() {
  const { t } = useTranslation();

  // Mode selection
  const [mode, setMode] = useState<Mode>('host');

  // Host mode state
  const [targetAddress, setTargetAddress] = useState('ws://localhost:49994');
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);

  // Client mode state
  const [inputAccessKey, setInputAccessKey] = useState('');
  const [localPort, setLocalPort] = useState('33333');
  const [localAddress, setLocalAddress] = useState<string | null>(null);

  // Common state
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // イベントリスナーのセットアップ
  useEffect(() => {
    let mounted = true;
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // クライアント接続
      const unlisten1 = await listen<{ client_id: string }>('ws-relay-client-connected', (event) => {
        if (!mounted) return;
        setConnectedClients((prev) => {
          // 重複追加を防ぐ
          if (prev.some((c) => c.id === event.payload.client_id)) {
            return prev;
          }
          return [...prev, { id: event.payload.client_id, connectedAt: new Date() }];
        });
      });
      unlisteners.push(unlisten1);

      // クライアント切断
      const unlisten2 = await listen<{ client_id: string }>('ws-relay-client-disconnected', (event) => {
        if (!mounted) return;
        setConnectedClients((prev) =>
          prev.filter((c) => c.id !== event.payload.client_id)
        );
      });
      unlisteners.push(unlisten2);

      // ホスト切断
      const unlisten3 = await listen<{ reason: string }>('ws-relay-host-disconnected', () => {
        if (!mounted) return;
        setAccessKey(null);
        setConnectedClients([]);
        setStatus('disconnected');
      });
      unlisteners.push(unlisten3);

      // クライアント側トンネルクローズ
      const unlisten4 = await listen<{ reason: string }>('ws-relay-tunnel-closed', () => {
        if (!mounted) return;
        setLocalAddress(null);
        setStatus('disconnected');
      });
      unlisteners.push(unlisten4);
    };

    setupListeners();

    return () => {
      mounted = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('plugins.wsRelay.copied'));
    } catch {
      toast.error(t('plugins.wsRelay.copyFailed'));
    }
  };

  // Host: Start publishing
  const startHost = async () => {
    if (!targetAddress) {
      toast.error(t('plugins.wsRelay.enterTargetAddress'));
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);

    try {
      const result = await invoke<{ access_key: string }>('ws_relay_start_host', {
        targetAddress,
      });
      setAccessKey(result.access_key);
      setStatus('connected');
      toast.success(t('plugins.wsRelay.hostStarted'));
    } catch (err) {
      setStatus('error');
      setErrorMessage(String(err));
      toast.error(String(err));
    }
  };

  // Host: Stop publishing
  const stopHost = async () => {
    try {
      await invoke('ws_relay_stop_host');
      setAccessKey(null);
      setConnectedClients([]);
      setStatus('disconnected');
      toast.success(t('plugins.wsRelay.hostStopped'));
    } catch (err) {
      toast.error(String(err));
    }
  };

  // Client: Connect
  const connectClient = async () => {
    if (!inputAccessKey) {
      toast.error(t('plugins.wsRelay.enterAccessKey'));
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);

    try {
      const result = await invoke<{ local_address: string }>('ws_relay_connect_client', {
        accessKey: inputAccessKey.toUpperCase(),
        localPort: parseInt(localPort, 10),
      });
      setLocalAddress(result.local_address);
      setStatus('connected');
      toast.success(t('plugins.wsRelay.clientConnected'));
    } catch (err) {
      setStatus('error');
      setErrorMessage(String(err));
      toast.error(String(err));
    }
  };

  // Client: Disconnect
  const disconnectClient = async () => {
    try {
      await invoke('ws_relay_disconnect_client');
      setLocalAddress(null);
      setStatus('disconnected');
      toast.success(t('plugins.wsRelay.clientDisconnected'));
    } catch (err) {
      toast.error(String(err));
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {t('plugins.wsRelay.title')}
          </h3>
          <p className="text-sm text-gray-400">
            {t('plugins.wsRelay.description')}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          {status === 'connected' && (
            <span className="flex items-center text-green-400 text-sm">
              <CheckCircle className="w-4 h-4 mr-1" />
              {t('plugins.wsRelay.status.connected')}
            </span>
          )}
          {status === 'connecting' && (
            <span className="flex items-center text-yellow-400 text-sm">
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              {t('plugins.wsRelay.status.connecting')}
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center text-red-400 text-sm">
              <XCircle className="w-4 h-4 mr-1" />
              {t('plugins.wsRelay.status.error')}
            </span>
          )}
        </div>
      </div>

      {/* Mode Selection */}
      <div className="flex space-x-4 mb-6">
        <label className={`flex items-center space-x-2 cursor-pointer px-4 py-2 rounded-lg border transition-all ${
          mode === 'host'
            ? 'border-resonite-blue bg-resonite-blue/10 text-white'
            : 'border-dark-600 text-gray-400 hover:border-dark-500'
        } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input
            type="radio"
            name="mode"
            value="host"
            checked={mode === 'host'}
            onChange={() => setMode('host')}
            disabled={isConnected}
            className="sr-only"
          />
          <Radio className={`w-4 h-4 ${mode === 'host' ? 'text-resonite-blue' : ''}`} />
          <span>{t('plugins.wsRelay.mode.host')}</span>
        </label>

        <label className={`flex items-center space-x-2 cursor-pointer px-4 py-2 rounded-lg border transition-all ${
          mode === 'client'
            ? 'border-resonite-blue bg-resonite-blue/10 text-white'
            : 'border-dark-600 text-gray-400 hover:border-dark-500'
        } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input
            type="radio"
            name="mode"
            value="client"
            checked={mode === 'client'}
            onChange={() => setMode('client')}
            disabled={isConnected}
            className="sr-only"
          />
          <Radio className={`w-4 h-4 ${mode === 'client' ? 'text-resonite-blue' : ''}`} />
          <span>{t('plugins.wsRelay.mode.client')}</span>
        </label>
      </div>

      <div className="border-t border-dark-700 pt-4">
        {/* Host Mode */}
        {mode === 'host' && (
          <div className="space-y-4">
            {!isConnected ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('plugins.wsRelay.host.targetAddress')}
                  </label>
                  <input
                    type="text"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    placeholder="ws://localhost:49994"
                    className="input w-full"
                    disabled={isConnecting}
                  />
                </div>
                <button
                  onClick={startHost}
                  disabled={isConnecting || !targetAddress}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>{t('plugins.wsRelay.host.start')}</span>
                </button>
              </>
            ) : (
              <>
                {/* Access Key Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('plugins.wsRelay.host.accessKey')}
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 font-mono text-xl text-white tracking-widest">
                      {accessKey}
                    </div>
                    <button
                      onClick={() => accessKey && copyToClipboard(accessKey)}
                      className="btn-secondary p-3"
                      title={t('plugins.wsRelay.copy')}
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Connected Clients */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    {t('plugins.wsRelay.host.connectedClients')}: {connectedClients.length}
                  </label>
                  {connectedClients.length > 0 && (
                    <div className="bg-dark-800 rounded-lg p-3 space-y-2">
                      {connectedClients.map((client) => (
                        <div key={client.id} className="text-sm text-gray-400">
                          • {client.id.substring(0, 8)}...
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={stopHost}
                  className="btn-danger flex items-center space-x-2"
                >
                  <Square className="w-4 h-4" />
                  <span>{t('plugins.wsRelay.host.stop')}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Client Mode */}
        {mode === 'client' && (
          <div className="space-y-4">
            {!isConnected ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('plugins.wsRelay.client.accessKey')}
                  </label>
                  <input
                    type="text"
                    value={inputAccessKey}
                    onChange={(e) => setInputAccessKey(e.target.value.toUpperCase())}
                    placeholder="AB3CD5"
                    className="input w-full font-mono text-lg tracking-widest uppercase"
                    maxLength={6}
                    disabled={isConnecting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('plugins.wsRelay.client.localPort')}
                  </label>
                  <input
                    type="number"
                    value={localPort}
                    onChange={(e) => setLocalPort(e.target.value)}
                    placeholder="33333"
                    className="input w-32"
                    disabled={isConnecting}
                  />
                </div>
                <button
                  onClick={connectClient}
                  disabled={isConnecting || !inputAccessKey}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  <span>{t('plugins.wsRelay.client.connect')}</span>
                </button>
              </>
            ) : (
              <>
                {/* Local Address Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('plugins.wsRelay.client.localAddress')}
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 font-mono text-white">
                      {localAddress}
                    </div>
                    <button
                      onClick={() => localAddress && copyToClipboard(localAddress)}
                      className="btn-secondary p-3"
                      title={t('plugins.wsRelay.copy')}
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('plugins.wsRelay.client.useThisAddress')}
                  </p>
                </div>

                <button
                  onClick={disconnectClient}
                  className="btn-danger flex items-center space-x-2"
                >
                  <Square className="w-4 h-4" />
                  <span>{t('plugins.wsRelay.client.disconnect')}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Error Display */}
        {status === 'error' && errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default WebSocketRelayPlugin;
