import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Users, Globe, Lock, Loader2, AlertCircle, Power, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

interface Friend {
  user_id: string;
  online_status: 'Online' | 'Away' | 'Busy' | 'Invisible' | 'Offline';
  world_name: string | null;
}

interface LoginForm {
  identity: string;
  password: string;
}

export default function FriendsTab() {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [friends, setFriends] = useState<Map<string, Friend>>(new Map());
  const [loginForm, setLoginForm] = useState<LoginForm>({ identity: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const unlistenRef = useRef<(() => void) | null>(null);

  // Status colors mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'text-green-400';
      case 'Away': return 'text-yellow-400';
      case 'Busy': return 'text-red-400';
      case 'Invisible': return 'text-gray-400';
      case 'Offline': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  // World icon based on world name
  const getWorldIcon = (world_name: string | null) => {
    if (!world_name || world_name === 'Private') {
      return <Lock className="w-4 h-4 text-gray-400" />;
    }
    return <Globe className="w-4 h-4 text-blue-400" />;
  };

  // Connect to Resonite friends API
  const connectToFriends = async () => {
    if (!loginForm.identity || !loginForm.password) {
      setError(t('friends.errors.loginRequired'));
      return;
    }

    setIsConnecting(true);
    setError(null);
    setConnectionStatus(t('friends.status.connecting'));

    try {
      // Set up event listeners before starting connection
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      
      // Listen for friend status updates
      const unlistenFriendUpdates = await listen('friend-status-update', (event: any) => {
        console.log('[FRIENDS DEBUG] Received friend-status-update:', event.payload);
        const friendData = event.payload as Friend;
        setFriends(prevFriends => {
          const newFriends = new Map(prevFriends);
          newFriends.set(friendData.user_id, friendData);
          return newFriends;
        });
      });

      // Listen for connection status updates
      const unlistenConnectionStatus = await listen('friends-connection-status', (event: any) => {
        console.log('[FRIENDS DEBUG] Received friends-connection-status:', event.payload);
        const status = event.payload.status;
        const message = event.payload.message;
        
        if (status === 'connected' || status === 'signalr_ready') {
          setIsConnected(true);
          setConnectionStatus(t('friends.status.connected'));
        } else if (status === 'disconnected') {
          setIsConnected(false);
          setFriends(new Map());
          setConnectionStatus('');
          setError(null);
        } else if (status === 'error') {
          setError(message);
          setIsConnected(false);
          setConnectionStatus('');
        } else {
          setConnectionStatus(message);
        }
      });

      // Store cleanup functions
      unlistenRef.current = () => {
        unlistenFriendUpdates();
        unlistenConnectionStatus();
      };

      // Call Tauri backend to establish connection
      await invoke('connect_resonite_friends', {
        credentials: {
          identity: loginForm.identity,
          password: loginForm.password
        }
      });

      setIsConnecting(false);
    } catch (err) {
      setError(String(err));
      setIsConnecting(false);
      setConnectionStatus('');
    }
  };

  // Disconnect from friends API
  const disconnect = async () => {
    try {
      await invoke('disconnect_resonite_friends');
      setIsConnected(false);
      setFriends(new Map());
      setConnectionStatus('');
      
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const friendsArray = Array.from(friends.values()).sort((a, b) => {
    // Sort by online status first (online users first)
    const statusOrder = { 'Online': 0, 'Away': 1, 'Busy': 2, 'Invisible': 3, 'Offline': 4 };
    const aOrder = statusOrder[a.online_status] ?? 5;
    const bOrder = statusOrder[b.online_status] ?? 5;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Then sort alphabetically by user_id
    return a.user_id.localeCompare(b.user_id);
  });

  return (
    <div className="h-full flex flex-col bg-dark-950">
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-dark-700/30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center space-x-3">
                <Users className="w-8 h-8 text-resonite-blue" />
                <span>{t('friends.title')}</span>
              </h1>
              <p className="text-gray-400 mt-1">{t('friends.description')}</p>
            </div>
            
            {isConnected && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">{connectionStatus}</span>
                </div>
                <button
                  onClick={disconnect}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Power className="w-4 h-4" />
                  <span>{t('friends.disconnect')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!isConnected ? (
            // Login Form
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto"
            >
              <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <User className="w-5 h-5 text-resonite-blue" />
                  <span>{t('friends.login.title')}</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('friends.login.identity')}
                    </label>
                    <input
                      type="text"
                      value={loginForm.identity}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, identity: e.target.value }))}
                      placeholder="Username, Email, or User ID"
                      className="input-primary w-full"
                      disabled={isConnecting}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('friends.login.identityHelp')}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('friends.login.password')}
                    </label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      className="input-primary w-full"
                      disabled={isConnecting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isConnecting) {
                          connectToFriends();
                        }
                      }}
                    />
                  </div>
                  
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
                    >
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-red-300 text-sm">{error}</p>
                      </div>
                    </motion.div>
                  )}
                  
                  {connectionStatus && !error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3"
                    >
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                        <p className="text-blue-300 text-sm">{connectionStatus}</p>
                      </div>
                    </motion.div>
                  )}
                  
                  <button
                    onClick={connectToFriends}
                    disabled={isConnecting || !loginForm.identity || !loginForm.password}
                    className="btn-primary w-full flex items-center justify-center space-x-2"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('friends.login.connecting')}</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        <span>{t('friends.login.connect')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            // Friends List
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {t('friends.list.title')} ({friendsArray.length})
                </h3>
                <button
                  onClick={() => invoke('refresh_friends_status')}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t('friends.list.refresh')}</span>
                </button>
              </div>
              
              {friendsArray.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">{t('friends.list.empty')}</p>
                </motion.div>
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence>
                    {friendsArray.map((friend) => (
                      <motion.div
                        key={friend.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="card hover:bg-dark-800/30 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-10 h-10 bg-resonite-blue/20 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-resonite-blue" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-white font-medium truncate">
                                  {friend.user_id}
                                </p>
                                <span className={`text-sm font-medium ${getStatusColor(friend.online_status)}`}>
                                  {friend.online_status}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2 mt-1">
                                {getWorldIcon(friend.world_name)}
                                <p className="text-gray-400 text-sm truncate">
                                  {friend.world_name || t('friends.list.privateWorld')}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className={`w-3 h-3 rounded-full ${
                            friend.online_status === 'Online' ? 'bg-green-400' :
                            friend.online_status === 'Away' ? 'bg-yellow-400' :
                            friend.online_status === 'Busy' ? 'bg-red-400' :
                            'bg-gray-500'
                          }`}></div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}