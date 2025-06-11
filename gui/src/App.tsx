import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import HomeTab from './components/HomeTab';
import ProfilesTab from './components/ProfilesTab';
import './App.css';

interface AppStatus {
  initialized: boolean;
  depot_downloader_available: boolean;
  exe_dir: string | null;
}

type Tab = 'home' | 'profiles';

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      const status = await invoke<AppStatus>('initialize_app');
      setAppStatus(status);
      
      if (!status.depot_downloader_available) {
        setError('DepotDownloader not found. Please place DepotDownloader.exe in the application directory.');
      }
    } catch (err) {
      setError(`Failed to initialize application: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          <p>アプリケーションを初期化中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="main">
          <div className="alert error">
            <h3>エラー</h3>
            <p>{error}</p>
            <button className="button" onClick={initializeApp}>
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Resonite Tools</h1>
        <nav className="nav">
          <button
            className={currentTab === 'home' ? 'active' : ''}
            onClick={() => setCurrentTab('home')}
          >
            ホーム
          </button>
          <button
            className={currentTab === 'profiles' ? 'active' : ''}
            onClick={() => setCurrentTab('profiles')}
          >
            プロファイル管理
          </button>
        </nav>
      </header>

      <main className="main">
        {currentTab === 'home' && <HomeTab />}
        {currentTab === 'profiles' && <ProfilesTab />}
      </main>

      <footer className="status-bar">
        {appStatus?.exe_dir && (
          <span>実行ディレクトリ: {appStatus.exe_dir}</span>
        )}
        {appStatus?.depot_downloader_available ? (
          <span style={{ marginLeft: '1rem', color: '#4fd69c' }}>
            DepotDownloader: 利用可能
          </span>
        ) : (
          <span style={{ marginLeft: '1rem', color: '#f56565' }}>
            DepotDownloader: 利用不可
          </span>
        )}
      </footer>
    </div>
  );
}

export default App;