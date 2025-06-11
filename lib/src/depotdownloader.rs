use std::path::{Path, PathBuf};
use std::error::Error;
use std::process::{Command, Output, Stdio};

/// DepotDownloaderを操作するための構造体
pub struct DepotDownloader {
    path: PathBuf,
}

impl DepotDownloader {
    /// 指定されたパスにあるDepotDownloaderを使用する新しいインスタンスを作成
    pub fn new(depot_downloader_path: &Path) -> Self {
        DepotDownloader {
            path: depot_downloader_path.to_path_buf(),
        }
    }

    /// デフォルトの場所を使用して新しいインスタンスを作成
    /// DepotDownloaderバイナリはreleaseフォルダに配置される
    pub fn with_default_path(base_dir: &Path) -> Self {
        let depot_downloader_exe = if cfg!(target_os = "windows") {
            base_dir.join("DepotDownloader.exe")
        } else if cfg!(target_os = "macos") {
            base_dir.join("DepotDownloader")
        } else {
            base_dir.join("DepotDownloader")
        };

        DepotDownloader {
            path: depot_downloader_exe,
        }
    }

    /// DepotDownloaderの存在を確認する
    pub fn check_exists(&self) -> Result<(), Box<dyn Error>> {
        if !self.path.exists() {
            return Err(format!(
                "DepotDownloader executable not found: {}. Please place DepotDownloader binary in the release folder.",
                self.path.display()
            )
            .into());
        }

        Ok(())
    }

    /// 認証引数を構築する
    pub fn build_auth_args(
        &self,
        username: Option<&str>,
        password: Option<&str>,
    ) -> Vec<String> {
        let mut args = Vec::new();

        if let Some(username) = username {
            args.push("-username".to_string());
            args.push(username.to_string());
            
            if let Some(password) = password {
                args.push("-password".to_string());
                args.push(password.to_string());
            }
        }

        args
    }

    /// 対話型Steamログインを実行する
    pub fn interactive_login(&self, username: &str) -> Result<(), Box<dyn Error>> {
        println!("Interactive Steam login for user: {}", username);
        println!("This will save your credentials for future use.");
        println!("You will be prompted for your password and Steam Guard code if needed.");

        // DepotDownloaderでは認証情報を保存するために-remember-passwordオプションを使用
        let args = vec![
            "-app".to_string(),
            "1".to_string(), // ダミーアプリID（認証テスト用）
            "-username".to_string(),
            username.to_string(),
            "-remember-password".to_string(),
        ];

        // Run DepotDownloader with the login command in interactive mode
        let mut cmd = Command::new(&self.path)
            .args(&args)
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()?;

        // Wait for the command to complete
        let status = cmd.wait()?;

        if status.success() {
            println!("\nLogin successful! Your credentials have been saved by DepotDownloader.");
            println!("You can now use other commands without specifying login details.");
            Ok(())
        } else {
            println!("\nLogin failed. Please try again.");
            Err("Steam login failed".into())
        }
    }

    /// ResoniteのダウンロードのためのDepotDownloader引数を構築する
    pub fn build_resonite_args(
        &self,
        install_dir: &str,
        branch: &str,
        manifest_id: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
    ) -> Vec<String> {
        let mut args = Vec::new();

        // Resonite AppID
        args.push("-app".to_string());
        args.push("2519830".to_string());

        // Depot IDを指定
        args.push("-depot".to_string());
        args.push("2519832".to_string());

        // ブランチを指定（prereleaseの場合）
        if branch == "prerelease" {
            args.push("-branch".to_string());
            args.push("prerelease".to_string());
        }

        // ManifestIDが指定されている場合は追加
        if let Some(manifest) = manifest_id {
            args.push("-manifest".to_string());
            args.push(manifest.to_string());
        }

        // インストールディレクトリを指定
        args.push("-dir".to_string());
        args.push(install_dir.to_string());

        // 認証情報を追加
        let auth_args = self.build_auth_args(username, password);
        args.extend(auth_args);

        // ファイル検証を有効にする
        args.push("-validate".to_string());

        args
    }

    /// 指定された引数でDepotDownloaderを実行する
    pub fn run(&self, args: &[String]) -> Result<Output, Box<dyn Error>> {
        println!("Using DepotDownloader path: {}", self.path.display());
        println!("Running with args: {:?}", args);

        // Run DepotDownloader with the provided arguments
        let output = Command::new(&self.path).args(args).output()?;

        Ok(output)
    }

    /// Resoniteをダウンロード/更新する
    pub fn download_resonite(
        &self,
        install_dir: &str,
        branch: &str,
        manifest_id: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
    ) -> Result<(), Box<dyn Error>> {
        let args = self.build_resonite_args(install_dir, branch, manifest_id, username, password);
        
        let output = self.run(&args)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("DepotDownloader failed: {}", stderr).into());
        }

        println!("Resonite download completed successfully");
        Ok(())
    }

    /// アップデート確認（DepotDownloaderでは直接的な確認方法はないため、manifest-onlyを使用）
    pub fn check_updates(
        &self,
        install_dir: &str,
        branch: &str,
        manifest_id: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
    ) -> Result<bool, Box<dyn Error>> {
        let mut args = self.build_resonite_args(install_dir, branch, manifest_id, username, password);
        
        // manifest-onlyオプションを追加してマニフェストのみを取得
        args.push("-manifest-only".to_string());

        let output = self.run(&args)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Update check failed: {}", stderr).into());
        }

        // DepotDownloaderの出力を解析して更新の有無を判定
        // 実装は実際の出力形式に応じて調整が必要
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // 簡易的な実装: 出力に特定のキーワードがあるかチェック
        // 実際の実装では、マニフェストIDやタイムスタンプを比較する必要がある
        Ok(stdout.contains("manifest"))
    }
}