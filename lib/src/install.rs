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

    /// プロファイルにResoniteをインストールする（バックグラウンド）
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

    /// プロファイルにResoniteをインストールする（インタラクティブ、2FA対応）
    pub fn install_interactive(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<(), Box<dyn Error>> {
        println!(
            "Installing Resonite {} branch to profile '{}' (Interactive Mode)",
            self.branch, self.profile_name
        );

        // プロファイルの存在確認
        let profile = profile_manager.get_profile(&self.profile_name)?;
        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let game_dir = profile_dir.join("Game");

        // ゲームディレクトリを作成
        if !game_dir.exists() {
            fs::create_dir_all(&game_dir)?;
        }

        // DepotDownloaderでResoniteをダウンロード（インタラクティブ）
        depot_downloader.download_resonite_interactive(
            &game_dir.to_string_lossy(),
            &self.branch,
            self.manifest_id.as_deref(),
            self.username.as_deref(),
            self.password.as_deref(),
        )?;

        println!("Installation process launched in separate window!");
        println!("Please check the command prompt window for Steam 2FA prompts.");
        Ok(())
    }

    /// プロファイルにResoniteをインストールする（インタラクティブ、監視付き）
    pub fn install_interactive_with_monitoring<F>(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager, on_complete: F) -> Result<(), Box<dyn Error>> 
    where 
        F: Fn(bool) + Send + 'static,
    {
        println!(
            "Installing Resonite {} branch to profile '{}' (Interactive Mode with Monitoring)",
            self.branch, self.profile_name
        );

        // プロファイルの存在確認
        let profile = profile_manager.get_profile(&self.profile_name)?;
        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let game_dir = profile_dir.join("Game");

        // ゲームディレクトリを作成
        if !game_dir.exists() {
            fs::create_dir_all(&game_dir)?;
        }

        let game_dir_str = game_dir.to_string_lossy().to_string();

        // プロファイル更新のためのクローン
        let profile_name_for_update = self.profile_name.clone();
        let branch_for_update = self.branch.clone();
        let manifest_id_for_update = self.manifest_id.clone();
        let profile_manager_clone = profile_manager.clone();
        
        depot_downloader.monitor_interactive_download(
            &game_dir_str,
            Box::new(move |success| {
                if success {
                    println!("Installation completed for profile: {}", profile_name_for_update);
                    
                    // プロファイル情報を更新
                    if let Ok(mut profile) = profile_manager_clone.get_profile(&profile_name_for_update) {
                        let game_info = GameInfo {
                            branch: branch_for_update.clone(),
                            manifest_id: manifest_id_for_update.clone(),
                            depot_id: "2519832".to_string(),
                            installed: true,
                            last_updated: Some(Utc::now().to_rfc3339()),
                        };
                        
                        profile.update_game_info(game_info);
                        
                        if let Err(e) = profile_manager_clone.update_profile(&profile) {
                            eprintln!("Failed to update profile after installation: {}", e);
                        } else {
                            println!("Profile '{}' updated successfully with game info", profile_name_for_update);
                        }
                    }
                }
                on_complete(success);
            })
        )?;

        // DepotDownloaderでResoniteをダウンロード（インタラクティブ）
        depot_downloader.download_resonite_interactive(
            &game_dir_str,
            &self.branch,
            self.manifest_id.as_deref(),
            self.username.as_deref(),
            self.password.as_deref(),
        )?;

        println!("Installation process launched in separate window with monitoring!");
        println!("Please check the command prompt window for Steam 2FA prompts.");
        println!("You will be notified when installation completes.");
        Ok(())
    }

    /// プロファイルのResoniteを更新する（バックグラウンド）
    pub fn update(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<(), Box<dyn Error>> {
        println!(
            "Updating Resonite {} branch in profile '{}'",
            self.branch, self.profile_name
        );

        // For DepotDownloader, update is the same as install
        self.install(depot_downloader, profile_manager)
    }

    /// プロファイルのResoniteを更新する（インタラクティブ、2FA対応） 
    pub fn update_interactive(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager) -> Result<(), Box<dyn Error>> {
        println!(
            "Updating Resonite {} branch in profile '{}' (Interactive Mode)",
            self.branch, self.profile_name
        );

        // For DepotDownloader, update is the same as install
        self.install_interactive(depot_downloader, profile_manager)
    }

    /// プロファイルのResoniteを更新する（インタラクティブ、監視付き）
    pub fn update_interactive_with_monitoring<F>(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager, on_complete: F) -> Result<(), Box<dyn Error>> 
    where 
        F: Fn(bool) + Send + 'static,
    {
        println!(
            "Updating Resonite {} branch in profile '{}' (Interactive Mode with Monitoring)",
            self.branch, self.profile_name
        );

        // For DepotDownloader, update is the same as install with monitoring
        self.install_interactive_with_monitoring(depot_downloader, profile_manager, on_complete)
    }

    /// プロファイルにResoniteをインストールする（自動フォールバック付き）
    /// バックグラウンドインストールを試行し、失敗したらインタラクティブモードにフォールバック
    pub fn install_with_fallback<F>(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager, on_status: F) -> Result<(), Box<dyn Error>> 
    where 
        F: Fn(&str, bool) + Send + 'static + Clone,
    {
        println!(
            "Installing Resonite {} branch to profile '{}' (Auto-fallback Mode)",
            self.branch, self.profile_name
        );

        // プロファイルの存在確認
        let profile = profile_manager.get_profile(&self.profile_name)?;
        let profile_dir = profile_manager.get_profile_dir(&self.profile_name);
        let game_dir = profile_dir.join("Game");

        // ゲームディレクトリを作成
        if !game_dir.exists() {
            fs::create_dir_all(&game_dir)?;
        }

        // まず通常のバックグラウンドインストールを試行
        on_status("バックグラウンドインストールを試行中...", false);
        
        let background_result = depot_downloader.download_resonite(
            &game_dir.to_string_lossy(),
            &self.branch,
            self.manifest_id.as_deref(),
            self.username.as_deref(),
            self.password.as_deref(),
        );

        match background_result {
            Ok(_) => {
                // バックグラウンドインストールが成功
                println!("Background installation succeeded for profile: {}", self.profile_name);
                
                // プロファイル情報を更新
                let mut profile = profile_manager.get_profile(&self.profile_name)?;
                let game_info = GameInfo {
                    branch: self.branch.clone(),
                    manifest_id: self.manifest_id.clone(),
                    depot_id: "2519832".to_string(),
                    installed: true,
                    last_updated: Some(Utc::now().to_rfc3339()),
                };
                
                profile.update_game_info(game_info);
                profile_manager.update_profile(&profile)?;
                
                on_status("インストールが完了しました", true);
                Ok(())
            }
            Err(e) => {
                // バックグラウンドインストールが失敗 - インタラクティブモードにフォールバック
                println!("Background installation failed: {}. Falling back to interactive mode.", e);
                on_status("バックグラウンドインストールが失敗しました。Steam認証が必要な可能性があります。\nコマンドウィンドウでインタラクティブインストールを開始します...", false);

                // インタラクティブモードで再試行
                self.install_interactive_with_monitoring(depot_downloader, profile_manager, move |success| {
                    if success {
                        on_status("インタラクティブインストールが完了しました", true);
                    } else {
                        on_status("インタラクティブインストールも失敗しました", true);
                    }
                })?;

                Ok(())
            }
        }
    }

    /// プロファイルのResoniteを更新する（自動フォールバック付き）
    pub fn update_with_fallback<F>(&self, depot_downloader: &DepotDownloader, profile_manager: &ProfileManager, on_status: F) -> Result<(), Box<dyn Error>> 
    where 
        F: Fn(&str, bool) + Send + 'static + Clone,
    {
        println!(
            "Updating Resonite {} branch in profile '{}' (Auto-fallback Mode)",
            self.branch, self.profile_name
        );

        // For DepotDownloader, update is the same as install with fallback
        self.install_with_fallback(depot_downloader, profile_manager, on_status)
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

        // Resoniteを起動（プロファイルディレクトリをカレントディレクトリに設定）
        Command::new(resonite_path)
            .args(&expanded_args)
            .current_dir(&profile_dir)
            .spawn()?;

        println!("Resonite launched successfully!");
        Ok(())
    }
}
