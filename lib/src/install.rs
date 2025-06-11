use std::path::{Path, PathBuf};
use std::error::Error;
use std::fs;

use crate::depotdownloader::DepotDownloader;

/// Resoniteのインストール情報を保持する構造体
pub struct ResoniteInstall {
    pub install_dir: String,
    pub branch: String,
    pub username: Option<String>,
    pub password: Option<String>,
    // auth_code は DepotDownloader では自動処理されるため不要
}

impl ResoniteInstall {
    /// 新しいResoniteInstallインスタンスを作成する
    pub fn new(
        install_dir: String,
        branch: String,
        username: Option<String>,
        password: Option<String>,
        _auth_code: Option<String>, // DepotDownloaderでは未使用
    ) -> Self {
        ResoniteInstall {
            install_dir,
            branch,
            username,
            password,
        }
    }

    /// 実行可能ファイルの存在確認とパスの取得
    pub fn get_executable_path(&self) -> Result<PathBuf, Box<dyn Error>> {
        let path = Path::new(&self.install_dir);
        let resonite_exe = path.join("Resonite.exe");

        if !resonite_exe.exists() {
            return Err(format!(
                "Resonite executable not found at {}. Please install it first.",
                resonite_exe.display()
            )
            .into());
        }

        Ok(resonite_exe)
    }

    /// Resoniteをインストールする
    pub fn install(&self, depot_downloader: &DepotDownloader) -> Result<(), Box<dyn Error>> {
        println!(
            "Installing Resonite {} branch to {}",
            self.branch, self.install_dir
        );

        // Create the installation directory if it doesn't exist
        let path = Path::new(&self.install_dir);
        if !path.exists() {
            fs::create_dir_all(path)?;
        }

        // Use DepotDownloader to download Resonite
        depot_downloader.download_resonite(
            &self.install_dir,
            &self.branch,
            self.username.as_deref(),
            self.password.as_deref(),
        )?;

        println!("Installation successful!");
        Ok(())
    }

    /// Resoniteを更新する
    pub fn update(&self, depot_downloader: &DepotDownloader) -> Result<(), Box<dyn Error>> {
        println!(
            "Updating Resonite {} branch in {}",
            self.branch, self.install_dir
        );

        // For DepotDownloader, update is the same as install
        depot_downloader.download_resonite(
            &self.install_dir,
            &self.branch,
            self.username.as_deref(),
            self.password.as_deref(),
        )?;

        println!("Update successful!");
        Ok(())
    }

    /// アップデートがあるかチェックする
    pub fn check_updates(&self, depot_downloader: &DepotDownloader) -> Result<bool, Box<dyn Error>> {
        println!(
            "Checking updates for Resonite {} branch in {}",
            self.branch, self.install_dir
        );

        // Use DepotDownloader to check for updates
        depot_downloader.check_updates(
            &self.install_dir,
            &self.branch,
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

    /// 指定されたブランチのResoniteをプロファイルで起動する
    pub fn launch_with_profile(
        &self,
        branch: &str,
        profile_path: &Path,
    ) -> Result<(), Box<dyn Error>> {
        use std::process::Command;
        use crate::profile::Profile;

        // Load profile
        let profile = Profile::load(profile_path)?;

        // Get Resonite executable path
        let resonite_path = self.find_resonite_executable(branch)?;

        println!(
            "Launching Resonite ({} branch) with profile '{}'",
            branch, profile.name
        );
        println!("Executable: {}", resonite_path.display());
        println!("Arguments: {:?}", profile.args);

        // Launch Resonite
        Command::new(resonite_path).args(&profile.args).spawn()?;

        // Don't wait for Resonite to exit
        println!("Resonite launched successfully!");

        Ok(())
    }
}
