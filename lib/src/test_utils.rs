/// テスト用ユーティリティモジュール
///
/// このモジュールは`#[cfg(test)]`でのみ利用可能です。

use std::path::PathBuf;
use std::sync::Once;
use tempfile::TempDir;

static INIT: Once = Once::new();

/// 環境変数からSteam認証情報を取得するための構造体
#[derive(Debug, Clone)]
pub struct TestCredentials {
    pub steam_id: String,
    pub steam_password: String,
}

impl TestCredentials {
    /// .envファイルから認証情報を読み込む
    /// テストルートディレクトリを探して.envファイルを読み込む
    pub fn from_env() -> Option<Self> {
        INIT.call_once(|| {
            // プロジェクトルートから.envを読み込む
            if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
                let env_path = PathBuf::from(&manifest_dir).parent().map(|p| p.join(".env"));
                if let Some(path) = env_path {
                    if path.exists() {
                        let _ = dotenvy::from_path(&path);
                    }
                }
            }
        });

        let steam_id = std::env::var("steam_id").ok()?;
        let steam_password = std::env::var("steam_password").ok()?;

        Some(TestCredentials {
            steam_id,
            steam_password,
        })
    }

    /// 認証情報が利用可能かチェック
    pub fn is_available() -> bool {
        Self::from_env().is_some()
    }
}

/// テスト用の一時プロファイルディレクトリを作成
pub struct TestProfileDir {
    pub temp_dir: TempDir,
    pub profiles_dir: PathBuf,
}

impl TestProfileDir {
    /// 新しいテスト用ディレクトリ構造を作成
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let profiles_dir = temp_dir.path().join("profiles");
        std::fs::create_dir_all(&profiles_dir)?;

        Ok(TestProfileDir {
            temp_dir,
            profiles_dir,
        })
    }

    /// ベースディレクトリのパスを取得
    pub fn base_dir(&self) -> PathBuf {
        self.temp_dir.path().to_path_buf()
    }

    /// プロファイルディレクトリのパスを取得
    pub fn profiles_dir(&self) -> &PathBuf {
        &self.profiles_dir
    }

    /// 特定のプロファイル用ディレクトリを作成
    pub fn create_profile_dir(&self, profile_id: &str) -> std::io::Result<PathBuf> {
        let profile_dir = self.profiles_dir.join(profile_id);
        std::fs::create_dir_all(&profile_dir)?;

        // DataPathとGameディレクトリも作成
        std::fs::create_dir_all(profile_dir.join("DataPath"))?;
        std::fs::create_dir_all(profile_dir.join("Game"))?;

        Ok(profile_dir)
    }
}

impl Default for TestProfileDir {
    fn default() -> Self {
        Self::new().expect("Failed to create test directory")
    }
}

/// 統合テストをスキップするためのマクロ
/// Steam認証情報が必要なテストで使用
#[macro_export]
macro_rules! skip_without_credentials {
    () => {
        if !$crate::test_utils::TestCredentials::is_available() {
            eprintln!("Skipping test: Steam credentials not available in .env");
            return;
        }
    };
}

/// 遅いテストをスキップするためのマクロ
/// 環境変数RUN_SLOW_TESTSが設定されていない場合はスキップ
#[macro_export]
macro_rules! skip_slow_test {
    () => {
        if std::env::var("RUN_SLOW_TESTS").is_err() {
            eprintln!("Skipping slow test: Set RUN_SLOW_TESTS=1 to run");
            return;
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_dir_creation() {
        let test_dir = TestProfileDir::new().unwrap();
        assert!(test_dir.profiles_dir().exists());
    }

    #[test]
    fn test_create_profile_dir() {
        let test_dir = TestProfileDir::new().unwrap();
        let profile_dir = test_dir.create_profile_dir("test_profile").unwrap();

        assert!(profile_dir.exists());
        assert!(profile_dir.join("DataPath").exists());
        assert!(profile_dir.join("Game").exists());
    }

    #[test]
    fn test_credentials_structure() {
        // 認証情報の構造体が正しく動作することをテスト
        // 実際の認証情報がなくてもテストは通る
        let _ = TestCredentials::is_available();
    }
}
