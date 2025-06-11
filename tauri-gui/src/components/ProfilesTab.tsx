import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface ProfileInfo {
  name: string;
  description: string;
}

function ProfilesTab() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadProfiles();
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

  const launchProfile = async (profileName: string, branch: string) => {
    try {
      setIsLoading(true);
      const result = await invoke<string>('launch_resonite', {
        branch,
        profileName,
      });
      
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `起動に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissMessage = () => setMessage(null);

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
              <div>操作</div>
            </div>
            
            {profiles.map((profile) => (
              <div key={profile.name} className="profiles-grid">
                <div>{profile.name}</div>
                <div>{profile.description || '-'}</div>
                <div>
                  <button
                    className="button"
                    onClick={() => launchProfile(profile.name, 'release')}
                    disabled={isLoading}
                    style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    リリース版で起動
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => launchProfile(profile.name, 'prerelease')}
                    disabled={isLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    プレリリース版で起動
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilesTab;