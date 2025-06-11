use std::path::{Path, PathBuf};
use std::error::Error;
use std::fs;
use chrono::Utc;

use crate::depotdownloader::DepotDownloader;
use crate::profile::{GameInfo, ProfileManager};

/// Resoniteのプロファイルベースインストール情報を保持する構造体
pub struct ResoniteInstall {
    pub profile_name: String,
    pub branch: String,
    pub manifest_id: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl ResoniteInstall {
    /// 新しいResoniteInstallインスタンスを作成する
    pub fn new(
        profile_name: String,
        branch: String,
        manifest_id: Option<String>,
        username: Option<String>,
        password: Option<String>,
    ) -> Self {
        ResoniteInstall {
            profile_name,
            branch,
            manifest_id,
            username,
            password,
        }
    }

    /// 実行可能ファイルの存在確認とパスの取得
    pub fn get_executable_path(&self, profile_manager: &ProfileManager) -> Result<PathBuf, Box<dyn Error>> {
        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let resonite_exe = profile_dir.join("Game").join("Resonite.exe");

        if !resonite_exe.exists() {
            return Err(format!(
                "Resonite executable not found at {}. Please install the game to this profile first.",
                resonite_exe.display()
            )
            .into());
        }

        Ok(resonite_exe)
    }

    /// プロファイルにResoniteをインストールする
    pub fn install(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<(), Box<dyn Error>> {
        println!(
            "Installing Resonite {} branch to profile '{}'",
            self.branch, self.profile_name
        );

        // プロファイルの存在確認
        let mut profile = profile_manager.get_profile(&self.profile_name)?;
        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let game_dir = profile_dir.join("Game");

        // ゲームディレクトリを作成
        if !game_dir.exists() {
            fs::create_dir_all(&game_dir)?;
        }

        // DepotDownloaderでResoniteをダウンロード
        depot_downloader.download_resonite(
            &game_dir.to_string_lossy(),
            &self.branch,
            self.manifest_id.as_deref(),
            self.username.as_deref(),
            self.password.as_deref(),
        )?;

        // プロファイルのゲーム情報を更新
        let game_info = GameInfo {
            branch: self.branch.clone(),
            manifest_id: self.manifest_id.clone(),
            depot_id: "2519832".to_string(),
            installed: true,
            last_updated: Some(Utc::now().to_rfc3339()),
        };
        
        profile.update_game_info(game_info);
        profile_manager.update_profile(&profile)?;

        println!("Installation successful!");
        Ok(())
    }

    /// プロファイルのResoniteを更新する
    pub fn update(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<(), Box<dyn Error>> {
        println!(
            "Updating Resonite {} branch in profile '{}'",
            self.branch, self.profile_name
        );

        // For DepotDownloader, update is the same as install
        self.install(depot_downloader, profile_manager)
    }

    /// プロファイルのアップデートがあるかチェックする
    pub fn check_updates(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<bool, Box<dyn Error>> {
        println!(
            "Checking updates for Resonite {} branch in profile '{}'",
            self.branch, self.profile_name
        );

        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let game_dir = profile_dir.join("Game");

        // Use DepotDownloader to check for updates
        depot_downloader.check_updates(
            &game_dir.to_string_lossy(),
            &self.branch,
            self.manifest_id.as_deref(),
            self.username.as_deref(),
            self.password.as_deref(),
        )
    }

}

/// Resoniteのインストールマネージャ
pub struct ResoniteInstallManager {
    base_dir: PathBuf,
}

impl ResoniteInstallManager {
    /// 新しいインストールマネージャを作成する
    pub fn new(base_dir: &Path) -> Self {
        ResoniteInstallManager {
            base_dir: base_dir.to_path_buf(),
        }
    }

    /// インストールパスを決定する
    pub fn determine_install_path(&self, path_arg: Option<&str>, branch: &str) -> String {
        if let Some(path) = path_arg {
            path.to_string()
        } else {
            // Create a subdirectory with the branch name
            let install_path = self.base_dir.join(branch);
            install_path.to_string_lossy().to_string()
        }
    }

    /// 特定のブランチのResonite実行可能ファイルを見つける
    pub fn find_resonite_executable(&self, branch: &str) -> Result<PathBuf, Box<dyn Error>> {
        let branch_dir = self.base_dir.join(branch);
        let resonite_exe = branch_dir.join("Resonite.exe");

        if !resonite_exe.exists() {
            return Err(format!(
                "Resonite executable not found at {}. Please install it first.",
                resonite_exe.display()
            )
            .into());
        }

        Ok(resonite_exe)
    }

    /// プロファイルでResoniteを起動する
    pub fn launch_with_profile(
        &self,
        profile_name: &str,
        profile_manager: &ProfileManager,
    ) -> Result<(), Box<dyn Error>> {
        use std::process::Command;

        // プロファイルを読み込み
        let profile = profile_manager.get_profile(profile_name)?;
        let profile_dir = profile_manager.get_profile_dir(profile_name);

        // ゲームがインストールされているかチェック
        if !profile.has_game_installed() {
            return Err(format!("Game is not installed in profile '{}'", profile_name).into());
        }

        // Resonite実行ファイルのパスを取得
        let resonite_path = profile.get_resonite_exe(&profile_dir);
        if !resonite_path.exists() {
            return Err(format!("Resonite executable not found at {}", resonite_path.display()).into());
        }

        // 起動引数を展開
        let expanded_args = profile.expand_args(&profile_dir);

        println!(
            "Launching Resonite with profile '{}'",
            profile.name
        );
        println!("Executable: {}", resonite_path.display());
        println!("Arguments: {:?}", expanded_args);

        // Resoniteを起動
        Command::new(resonite_path).args(&expanded_args).spawn()?;

        println!("Resonite launched successfully!");
        Ok(())
    }
}
