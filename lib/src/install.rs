use std::path::{Path, PathBuf};
use std::error::Error;
use std::fs;
use regex::Regex;
use std::process::Output;
use std::io::{self, Write};

use crate::steamcmd::SteamCmd;

/// Resoniteのインストール情報を保持する構造体
pub struct ResoniteInstall {
    pub install_dir: String,
    pub branch: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub auth_code: Option<String>, // Steam Guard コード
}

impl ResoniteInstall {
    /// 新しいResoniteInstallインスタンスを作成する
    pub fn new(
        install_dir: String,
        branch: String,
        username: Option<String>,
        password: Option<String>,
        auth_code: Option<String>,
    ) -> Self {
        ResoniteInstall {
            install_dir,
            branch,
            username,
            password,
            auth_code,
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
    pub fn install(&self, steam_cmd: &SteamCmd) -> Result<(), Box<dyn Error>> {
        println!(
            "Installing Resonite {} branch to {}",
            self.branch, self.install_dir
        );

        // Create the installation directory if it doesn't exist
        let path = Path::new(&self.install_dir);
        if !path.exists() {
            fs::create_dir_all(path)?;
        }

        // Build the steamcmd command
        let mut args = steam_cmd.build_login_args(
            self.username.as_deref(),
            self.password.as_deref(),
            self.auth_code.as_deref(),
        );

        args.append(&mut vec![
            "+force_install_dir".to_string(),
            self.install_dir.clone(),
            "+app_update".to_string(),
            "2519830".to_string(),
        ]);

        // Add branch if prerelease
        if self.branch == "prerelease" {
            args.push("-beta".to_string());
            args.push("prerelease".to_string());
        }

        // Add validation and quit commands
        args.push("validate".to_string());
        args.push("+quit".to_string());

        // Run steamcmd
        let output = steam_cmd.run(&args)?;

        // Process output
        self.process_installation_output(output)
    }

    /// Resoniteを更新する
    pub fn update(&self, steam_cmd: &SteamCmd) -> Result<(), Box<dyn Error>> {
        println!(
            "Updating Resonite {} branch in {}",
            self.branch, self.install_dir
        );

        // The update command is the same as the install command for steamcmd
        // Build the steamcmd command
        let mut args = steam_cmd.build_login_args(
            self.username.as_deref(),
            self.password.as_deref(),
            self.auth_code.as_deref(),
        );

        args.append(&mut vec![
            "+force_install_dir".to_string(),
            self.install_dir.clone(),
            "+app_update".to_string(),
            "2519830".to_string(),
        ]);

        // Add branch if prerelease
        if self.branch == "prerelease" {
            args.push("-beta".to_string());
            args.push("prerelease".to_string());
        }

        // Add validation and quit commands
        args.push("validate".to_string());
        args.push("+quit".to_string());

        // Run steamcmd
        let output = steam_cmd.run(&args)?;

        // Process output
        if output.status.success() {
            println!("Update successful!");

            // Check if any files were updated
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("already up to date") {
                println!("Resonite is already up to date.");
            } else {
                println!("Resonite files were updated.");
            }
        } else {
            println!("Update failed!");
            io::stdout().write_all(&output.stdout)?;
            io::stderr().write_all(&output.stderr)?;
        }

        Ok(())
    }

    /// アップデートがあるかチェックする
    pub fn check_updates(&self, steam_cmd: &SteamCmd) -> Result<bool, Box<dyn Error>> {
        println!(
            "Checking updates for Resonite {} branch in {}",
            self.branch, self.install_dir
        );

        // Build the steamcmd command with -verify_only option
        let mut args = steam_cmd.build_login_args(
            self.username.as_deref(),
            self.password.as_deref(),
            self.auth_code.as_deref(),
        );

        args.append(&mut vec![
            "+force_install_dir".to_string(),
            self.install_dir.clone(),
            "+app_update".to_string(),
            "2519830".to_string(),
            "-verify_only".to_string(),
        ]);

        // Add branch if prerelease
        if self.branch == "prerelease" {
            args.push("-beta".to_string());
            args.push("prerelease".to_string());
        }

        // Add quit command
        args.push("+quit".to_string());

        // Run steamcmd
        let output = steam_cmd.run(&args)?;

        // Process output
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);

            // Check for update indicators in output
            if stdout.contains("already up to date") {
                println!("Resonite is up to date. No updates available.");
                Ok(false)
            } else if stdout.contains("update will be") || stdout.contains("downloading") {
                println!("Updates are available for Resonite.");

                // Try to extract version information using regex
                let re = Regex::new(r"Update to ([\d\.]+)")?;
                if let Some(caps) = re.captures(&stdout) {
                    println!("Available version: {}", &caps[1]);
                }
                Ok(true)
            } else {
                println!("Could not determine update status. Check the full output:");
                io::stdout().write_all(&output.stdout)?;
                Ok(false)
            }
        } else {
            println!("Check failed!");
            io::stdout().write_all(&output.stdout)?;
            io::stderr().write_all(&output.stderr)?;
            Err("Update check failed".into())
        }
    }

    /// インストール出力を処理する
    fn process_installation_output(&self, output: Output) -> Result<(), Box<dyn Error>> {
        if output.status.success() {
            println!("Installation successful!");
            Ok(())
        } else {
            println!("Installation failed!");
            io::stdout().write_all(&output.stdout)?;
            io::stderr().write_all(&output.stderr)?;
            Err("Installation failed".into())
        }
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
