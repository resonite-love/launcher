import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

interface ProfileInfo {
  name: string;
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
}

interface GameInstallRequest {
  profile_name: string;
  branch: string;
  manifest_id?: string;
  username?: string;
  password?: string;
}

interface SteamCredentials {
  username: string;
  password: string;
}

function ProfilesTab() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // ゲームインストール用の状態
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [installBranch, setInstallBranch] = useState('release');
  const [manifestId, setManifestId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Steamクレデンシャル管理用の状態
  const [savedCredentials, setSavedCredentials] = useState<SteamCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');

  useEffect(() => {
    loadProfiles();
    loadSavedCredentials();

    // インストール完了イベントをリッスン
    const unlistenCompleted = listen('installation-completed', (event) => {
      const data = event.payload as {
        profile_name: string;
        branch: string;
        success: boolean;
        message: string;
      };
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        // プロファイル一覧を自動更新
        loadProfiles();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    });

    // インストールステータス更新イベントをリッスン
    const unlistenStatus = listen('installation-status', (event) => {
      const data = event.payload as {
        profile_name: string;
        branch: string;
        message: string;
        is_complete: boolean;
      };
      
      // リアルタイムでステータスを表示
      if (!data.is_complete) {
        setMessage({ type: 'info', text: data.message });
      }
    });

    // クリーンアップ
    return () => {
      unlistenCompleted.then(f => f());
      unlistenStatus.then(f => f());
    };
  }, []);

  const loadProfiles = async () => {
    try {
      const profileList = await invoke<ProfileInfo[]>('get_profiles');
      setProfiles(profileList);
    } catch (err) {
      setMessage({ type: 'error', text: `プロファイルの取得に失敗しました: ${err}` });
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      setMessage({ type: 'error', text: 'プロファイル名を入力してください' });
      return;
    }

    try {
      setIsLoading(true);
      const result = await invoke<string>('create_profile', {
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
      });
      
      setMessage({ type: 'success', text: result });
      setNewProfileName('');
      setNewProfileDescription('');
      await loadProfiles();
    } catch (err) {
      setMessage({ type: 'error', text: `プロファイルの作成に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const launchProfile = async (profileName: string) => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('launch_resonite', {
        profileName,
      });
      
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `起動に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const openInstallModal = (profileName: string) => {
    setSelectedProfile(profileName);
    setInstallBranch('release');
    setManifestId('');
    // 保存されたクレデンシャルがある場合は自動設定
    setUsername(savedCredentials?.username || '');
    setPassword(savedCredentials?.password || '');
    setShowInstallModal(true);
  };

  const closeInstallModal = () => {
    setShowInstallModal(false);
    setSelectedProfile('');
  };

  const installGame = async () => {
    if (!selectedProfile) return;

    try {
      setIsLoading(true);
      const request: GameInstallRequest = {
        profile_name: selectedProfile,
        branch: installBranch,
        manifest_id: manifestId || undefined,
        username: username || undefined,
        password: password || undefined,
      };

      const result = await invoke<string>('install_game_to_profile_interactive', { request });
      setMessage({ type: 'info', text: result });
      closeInstallModal();
    } catch (err) {
      setMessage({ type: 'error', text: `ゲームのインストールに失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const updateGame = async (profileName: string) => {
    const profile = profiles.find(p => p.name === profileName);
    if (!profile || !profile.has_game) return;

    try {
      setIsLoading(true);
      const request: GameInstallRequest = {
        profile_name: profileName,
        branch: profile.branch || 'release',
        manifest_id: profile.manifest_id,
        // 保存されたクレデンシャルを自動使用
        username: savedCredentials?.username || undefined,
        password: savedCredentials?.password || undefined,
      };

      const result = await invoke<string>('update_profile_game_interactive', { request });
      setMessage({ type: 'info', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `ゲームの更新に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissMessage = () => setMessage(null);

  // Steamクレデンシャル関連の関数
  const loadSavedCredentials = async () => {
    try {
      const credentials = await invoke<SteamCredentials | null>('load_steam_credentials');
      setSavedCredentials(credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  const openCredentialsModal = () => {
    setCredentialsUsername(savedCredentials?.username || '');
    setCredentialsPassword(savedCredentials?.password || '');
    setShowCredentialsModal(true);
  };

  const closeCredentialsModal = () => {
    setShowCredentialsModal(false);
    setCredentialsUsername('');
    setCredentialsPassword('');
  };

  const saveCredentials = async () => {
    if (!credentialsUsername.trim()) {
      setMessage({ type: 'error', text: 'Steamユーザー名を入力してください' });
      return;
    }

    try {
      setIsLoading(true);
      const credentials: SteamCredentials = {
        username: credentialsUsername.trim(),
        password: credentialsPassword,
      };

      await invoke<string>('save_steam_credentials', { credentials });
      setMessage({ type: 'success', text: 'Steamクレデンシャルが保存されました' });
      setSavedCredentials(credentials);
      closeCredentialsModal();
    } catch (err) {
      setMessage({ type: 'error', text: `クレデンシャルの保存に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const clearCredentials = async () => {
    try {
      setIsLoading(true);
      await invoke<string>('clear_steam_credentials');
      setMessage({ type: 'success', text: 'Steamクレデンシャルが削除されました' });
      setSavedCredentials(null);
    } catch (err) {
      setMessage({ type: 'error', text: `クレデンシャルの削除に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>プロファイル管理</h2>

      {message && (
        <div className={`alert ${message.type}`}>
          <p>{message.text}</p>
          <button className="button secondary" onClick={dismissMessage}>
            閉じる
          </button>
        </div>
      )}

      {/* Steamクレデンシャル管理 */}
      <div className="card">
        <h3>Steam設定</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {savedCredentials ? (
            <>
              <span style={{ color: '#4fd69c' }}>
                ✓ ユーザー名: {savedCredentials.username}
              </span>
              <button
                className="button secondary"
                onClick={openCredentialsModal}
                disabled={isLoading}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                編集
              </button>
              <button
                className="button secondary"
                onClick={clearCredentials}
                disabled={isLoading}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                削除
              </button>
            </>
          ) : (
            <>
              <span style={{ color: '#ccc' }}>Steamクレデンシャルが設定されていません</span>
              <button
                className="button"
                onClick={openCredentialsModal}
                disabled={isLoading}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                設定
              </button>
            </>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: '#aaa', margin: 0 }}>
          ℹ️ Steamクレデンシャルを保存すると、ゲームのインストールや更新時に自動的に使用されます。
        </p>
      </div>

      {/* 新規プロファイル作成 */}
      <div className="card">
        <h3>新規プロファイル作成</h3>
        <div className="form-group">
          <label htmlFor="profileName">プロファイル名:</label>
          <input
            id="profileName"
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="プロファイル名を入力"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="profileDescription">説明:</label>
          <input
            id="profileDescription"
            type="text"
            value={newProfileDescription}
            onChange={(e) => setNewProfileDescription(e.target.value)}
            placeholder="プロファイルの説明（オプション）"
          />
        </div>
        
        <button
          className="button"
          onClick={createProfile}
          disabled={isLoading || !newProfileName.trim()}
        >
          {isLoading ? '作成中...' : 'プロファイルを作成'}
        </button>
      </div>

      {/* プロファイル一覧 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>プロファイル一覧</h3>
          <button className="button secondary" onClick={loadProfiles}>
            更新
          </button>
        </div>

        {profiles.length === 0 ? (
          <p>プロファイルがありません。新規作成してください。</p>
        ) : (
          <div>
            <div className="profiles-grid header">
              <div>名前</div>
              <div>説明</div>
              <div>ゲーム状態</div>
              <div>操作</div>
            </div>
            
            {profiles.map((profile) => (
              <div key={profile.name} className="profiles-grid">
                <div>{profile.name}</div>
                <div>{profile.description || '-'}</div>
                <div>
                  {profile.has_game ? (
                    <span style={{ color: '#4fd69c' }}>
                      ✓ {profile.branch}
                      {profile.version && (
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                          v{profile.version}
                        </div>
                      )}
                      {profile.manifest_id && (
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>
                          ({profile.manifest_id.slice(0, 8)}...)
                        </div>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: '#ccc' }}>ゲーム未インストール</span>
                  )}
                </div>
                <div>
                  {profile.has_game ? (
                    <>
                      <button
                        className="button"
                        onClick={() => launchProfile(profile.name)}
                        disabled={isLoading}
                        style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        起動
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => updateGame(profile.name)}
                        disabled={isLoading}
                        style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        title="バックグラウンド更新を試行し、Steam認証が必要な場合は自動的にコマンドウィンドウが開きます"
                      >
                        更新
                      </button>
                    </>
                  ) : (
                    <button
                      className="button"
                      onClick={() => openInstallModal(profile.name)}
                      disabled={isLoading}
                      style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      title="バックグラウンドインストールを試行し、Steam認証が必要な場合は自動的にコマンドウィンドウが開きます"
                    >
                      ゲームをインストール
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ゲームインストールモーダル */}
      {showInstallModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#2d2d2d',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3>プロファイル '{selectedProfile}' にゲームをインストール</h3>
            <div style={{ backgroundColor: '#444', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>
                ℹ️ 最初にバックグラウンドインストールを試行し、Steam認証が必要な場合は自動的にコマンドウィンドウが開きます。
              </p>
            </div>
            
            <div className="form-group">
              <label>ブランチ:</label>
              <div className="branch-selector">
                <label>
                  <input
                    type="radio"
                    value="release"
                    checked={installBranch === 'release'}
                    onChange={(e) => setInstallBranch(e.target.value)}
                  />
                  リリース版
                </label>
                <label>
                  <input
                    type="radio"
                    value="prerelease"
                    checked={installBranch === 'prerelease'}
                    onChange={(e) => setInstallBranch(e.target.value)}
                  />
                  プレリリース版
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="manifestId">マニフェストID（オプション）:</label>
              <input
                id="manifestId"
                type="text"
                value={manifestId}
                onChange={(e) => setManifestId(e.target.value)}
                placeholder="特定バージョンを指定する場合"
              />
            </div>

            <div className="form-group">
              <label htmlFor="steamUsername">Steamユーザー名（オプション）:</label>
              <input
                id="steamUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Steamユーザー名"
              />
            </div>

            <div className="form-group">
              <label htmlFor="steamPassword">Steamパスワード（オプション）:</label>
              <input
                id="steamPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Steamパスワード"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="button secondary"
                onClick={closeInstallModal}
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button
                className="button"
                onClick={installGame}
                disabled={isLoading}
              >
                {isLoading ? 'インストール中...' : 'インストール（自動フォールバック）'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steamクレデンシャル設定モーダル */}
      {showCredentialsModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#2d2d2d',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3>Steamクレデンシャル設定</h3>
            <div style={{ backgroundColor: '#444', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>
                🔒 クレデンシャルはローカルに暗号化されて保存され、インストール・更新時に自動使用されます。
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="credentialsUsername">Steamユーザー名:</label>
              <input
                id="credentialsUsername"
                type="text"
                value={credentialsUsername}
                onChange={(e) => setCredentialsUsername(e.target.value)}
                placeholder="Steamユーザー名"
              />
            </div>

            <div className="form-group">
              <label htmlFor="credentialsPassword">Steamパスワード:</label>
              <input
                id="credentialsPassword"
                type="password"
                value={credentialsPassword}
                onChange={(e) => setCredentialsPassword(e.target.value)}
                placeholder="Steamパスワード"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="button secondary"
                onClick={closeCredentialsModal}
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button
                className="button"
                onClick={saveCredentials}
                disabled={isLoading || !credentialsUsername.trim()}
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilesTab;