import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

function InstallationTab() {
  const [branch, setBranch] = useState('release');
  const [installPath, setInstallPath] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<boolean | null>(null);

  const installResonite = async () => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('install_resonite', {
        branch,
        installPath: installPath || null,
        username: username || null,
        password: password || null,
      });
      
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `インストールに失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const updateResonite = async () => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('update_resonite', {
        branch,
        installPath: installPath || null,
        username: username || null,
        password: password || null,
      });
      
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `更新に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const checkUpdates = async () => {
    try {
      setIsLoading(true);
      const hasUpdates = await invoke<boolean>('check_updates', {
        branch,
        installPath: installPath || null,
        username: username || null,
        password: password || null,
      });
      
      setUpdateStatus(hasUpdates);
      setMessage({
        type: 'info',
        text: hasUpdates ? '更新が利用可能です' : 'Resoniteは最新版です',
      });
    } catch (err) {
      setMessage({ type: 'error', text: `更新確認に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const performSteamLogin = async () => {
    if (!username.trim()) {
      setMessage({ type: 'error', text: 'ユーザー名を入力してください' });
      return;
    }

    try {
      setIsLoading(true);
      const result = await invoke<string>('steam_login', {
        username: username.trim(),
      });
      
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `Steamログインに失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissMessage = () => {
    setMessage(null);
    setUpdateStatus(null);
  };

  return (
    <div>
      <h2>Resoniteのインストールと更新</h2>

      {message && (
        <div className={`alert ${message.type}`}>
          <p>{message.text}</p>
          <button className="button secondary" onClick={dismissMessage}>
            閉じる
          </button>
        </div>
      )}

      {updateStatus !== null && (
        <div className={`alert ${updateStatus ? 'info' : 'success'}`}>
          <p>{updateStatus ? '更新が利用可能です' : 'Resoniteは最新版です'}</p>
          <button className="button secondary" onClick={dismissMessage}>
            確認を閉じる
          </button>
        </div>
      )}

      {/* ブランチ選択 */}
      <div className="card">
        <h3>設定</h3>
        
        <div className="form-group">
          <label>ブランチ:</label>
          <div className="branch-selector">
            <label>
              <input
                type="radio"
                value="release"
                checked={branch === 'release'}
                onChange={(e) => setBranch(e.target.value)}
              />
              リリース版
            </label>
            <label>
              <input
                type="radio"
                value="prerelease"
                checked={branch === 'prerelease'}
                onChange={(e) => setBranch(e.target.value)}
              />
              プレリリース版
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="installPath">インストール先（オプション）:</label>
          <input
            id="installPath"
            type="text"
            value={installPath}
            onChange={(e) => setInstallPath(e.target.value)}
            placeholder="デフォルトパスを使用する場合は空白のまま"
          />
        </div>
      </div>

      {/* Steam認証情報 */}
      <div className="card">
        <h3>Steam認証情報（オプション）</h3>
        
        <div className="form-group">
          <label htmlFor="username">ユーザー名:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Steamユーザー名"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">パスワード:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Steamパスワード（オプション）"
          />
        </div>

        <button
          className="button secondary"
          onClick={performSteamLogin}
          disabled={isLoading || !username.trim()}
        >
          {isLoading ? 'ログイン中...' : 'Steamログイン（認証情報保存）'}
        </button>
      </div>

      {/* 操作ボタン */}
      <div className="card">
        <h3>操作</h3>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="button"
            onClick={installResonite}
            disabled={isLoading}
          >
            {isLoading ? '実行中...' : 'インストール'}
          </button>

          <button
            className="button"
            onClick={updateResonite}
            disabled={isLoading}
          >
            {isLoading ? '実行中...' : '更新'}
          </button>

          <button
            className="button secondary"
            onClick={checkUpdates}
            disabled={isLoading}
          >
            {isLoading ? '確認中...' : '更新確認'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallationTab;