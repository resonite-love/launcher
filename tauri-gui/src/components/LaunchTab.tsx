import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface ProfileInfo {
  name: string;
  description: string;
}

function LaunchTab() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [branch, setBranch] = useState('release');
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

  const launchProfile = async (profileName: string) => {
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
      <h2>Resoniteの起動</h2>

      {message && (
        <div className={`alert ${message.type}`}>
          <p>{message.text}</p>
          <button className="button secondary" onClick={dismissMessage}>
            閉じる
          </button>
        </div>
      )}

      {/* ブランチ選択 */}
      <div className="card">
        <h3>起動設定</h3>
        
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
      </div>

      {/* プロファイル選択と起動 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>起動するプロファイルを選択</h3>
          <button className="button secondary" onClick={loadProfiles}>
            プロファイル一覧を更新
          </button>
        </div>

        {profiles.length === 0 ? (
          <div>
            <p>プロファイルがありません。プロファイルタブで作成してください。</p>
            <p style={{ color: '#ccc', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              プロファイルを作成することで、Resoniteを特定の設定で起動できます。
            </p>
          </div>
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
                    onClick={() => launchProfile(profile.name)}
                    disabled={isLoading}
                  >
                    {isLoading ? '起動中...' : `${branch}ブランチで起動`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="card">
          <h3>使用方法</h3>
          <ul style={{ color: '#ccc', lineHeight: '1.6' }}>
            <li>上記のプロファイルから起動したいものを選択してください</li>
            <li>ブランチ設定で「リリース版」または「プレリリース版」を選択できます</li>
            <li>プロファイルには個別のデータパスと起動オプションが設定されています</li>
            <li>Resoniteが起動したら、このアプリケーションを閉じても問題ありません</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default LaunchTab;