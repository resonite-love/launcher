import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface Profile {
  name: string;
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
}

interface UpdateNote {
  version: string;
  date: string;
  notes: string[];
}

function HomeTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [updateNotes] = useState<UpdateNote[]>([
    {
      version: "v1.0.0",
      date: "2024-01-15",
      notes: [
        "初期リリース",
        "プロファイル管理機能を追加",
        "Resonite起動機能を追加"
      ]
    }
  ]);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const profileList = await invoke<Profile[]>('get_profiles');
      setProfiles(profileList);
      if (profileList.length > 0 && !selectedProfile) {
        setSelectedProfile(profileList[0].name);
      }
    } catch (err) {
      setMessage({ type: 'error', text: `プロファイルの読み込みに失敗しました: ${err}` });
    }
  };

  const launchResonite = async () => {
    if (!selectedProfile) {
      setMessage({ type: 'error', text: 'プロファイルを選択してください' });
      return;
    }

    try {
      setIsLoading(true);
      const result = await invoke<string>('launch_resonite', {
        profileName: selectedProfile,
      });
      setMessage({ type: 'success', text: result });
    } catch (err) {
      setMessage({ type: 'error', text: `起動に失敗しました: ${err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissMessage = () => {
    setMessage(null);
  };

  return (
    <div className="home-tab">
      {/* Update Notes Section */}
      <div className="update-notes-section">
        <h2>アップデート情報</h2>
        <div className="update-notes">
          {updateNotes.map((update, index) => (
            <div key={index} className="update-note">
              <div className="update-header">
                <span className="version">{update.version}</span>
                <span className="date">{update.date}</span>
              </div>
              <ul className="update-list">
                {update.notes.map((note, noteIndex) => (
                  <li key={noteIndex}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Launch Section */}
      <div className="launch-section">
        <div className="profile-selector">
          <label htmlFor="profile-select">プロファイル:</label>
          <select
            id="profile-select"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="profile-dropdown"
          >
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name} ({profile.branch || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        <button
          className="launch-button"
          onClick={launchResonite}
          disabled={isLoading || !selectedProfile}
        >
          {isLoading ? 'Starting Resonite...' : 'Play Resonite'}
        </button>

        {selectedProfile && (
          <div className="profile-info">
            {profiles.find(p => p.name === selectedProfile) && (
              <div>
                <p><strong>ブランチ:</strong> {profiles.find(p => p.name === selectedProfile)?.branch || 'unknown'}</p>
                <p><strong>説明:</strong> {profiles.find(p => p.name === selectedProfile)?.description || 'なし'}</p>
                <p><strong>ゲーム状態:</strong> {profiles.find(p => p.name === selectedProfile)?.has_game ? 'インストール済み' : '未インストール'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={`alert ${message.type}`}>
          <p>{message.text}</p>
          <button className="button secondary" onClick={dismissMessage}>
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

export default HomeTab;