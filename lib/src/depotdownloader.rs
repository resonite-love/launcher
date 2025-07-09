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
        let exe_name = if cfg!(target_os = "windows") {
            "DepotDownloader.exe"
        } else if cfg!(target_os = "macos") {
            "DepotDownloader"
        } else {
            "DepotDownloader"
        };

        // 複数の場所でDepotDownloaderを検索
        let possible_paths = vec![
            base_dir.join(exe_name),                    // 実行ファイルと同じディレクトリ
            base_dir.parent().unwrap_or(base_dir).join(exe_name),  // 一つ上のディレクトリ
            base_dir.parent()
                .and_then(|p| p.parent())
                .unwrap_or(base_dir)
                .join(exe_name),                        // 二つ上のディレクトリ（開発時用）
            base_dir.parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .unwrap_or(base_dir)
                .join(exe_name),                        // 三つ上のディレクトリ（プロジェクトルート）
        ];

        // 存在する最初のパスを使用
        let depot_downloader_exe = possible_paths
            .into_iter()
            .find(|path| path.exists())
            .unwrap_or_else(|| base_dir.join(exe_name));

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
            "-no-mobile".to_string(), // モバイル認証を無効化
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
        args.push("-no-mobile".to_string()); // モバイル認証を無効化
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
        // args.push("-validate".to_string());

        args
    }

    /// 指定された引数でDepotDownloaderを実行する（バックグラウンド）
    pub fn run(&self, args: &[String]) -> Result<Output, Box<dyn Error>> {
        println!("Using DepotDownloader path: {}", self.path.display());
        println!("Running with args: {:?}", args);

        // リリースビルドではウィンドウを非表示にしてDepotDownloaderを実行
        #[cfg(all(target_os = "windows", not(debug_assertions)))]
        {
            use std::os::windows::process::CommandExt;
            
            let output = Command::new(&self.path)
                .args(args)
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()?;
            
            Ok(output)
        }

        // デバッグビルドまたはWindows以外では通常通り実行
        #[cfg(any(not(target_os = "windows"), debug_assertions))]
        {
            let output = Command::new(&self.path).args(args).output()?;
            Ok(output)
        }
    }

    /// 指定された引数でDepotDownloaderを別のコマンドウィンドウで実行する（2FA対応）
    pub fn run_interactive(&self, args: &[String]) -> Result<(), Box<dyn Error>> {
        println!("Using DepotDownloader path: {}", self.path.display());
        println!("Running interactively with args: {:?}", args);
        
        // DepotDownloaderの存在確認
        self.check_exists()?;

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            
            // 新しいアプローチ：PowerShellを使用してDepotDownloaderを実行
            let mut cmd = Command::new("powershell");
            cmd.args(&["-NoExit", "-Command"]);
            
            // PowerShellスクリプトを構築
            let depot_path_str = self.path.to_string_lossy();
            
            // 引数を適切にクォートする（スペースが含まれる場合）
            let quoted_args: Vec<String> = args.iter().map(|arg| {
                if arg.contains(' ') {
                    format!("'{}'", arg)
                } else {
                    arg.clone()
                }
            }).collect();
            let args_str = quoted_args.join(" ");
            
            let powershell_script = format!(
                "Write-Host 'Starting DepotDownloader...' -ForegroundColor Green; & '{}' {}; Write-Host ''; Write-Host 'Download completed. Press any key to close this window.' -ForegroundColor Green; Read-Host",
                depot_path_str, args_str
            );
            
            cmd.arg(&powershell_script);
            cmd.creation_flags(0x00000010); // CREATE_NEW_CONSOLE - 新しいコンソールウィンドウを作成
            
            println!("Using DepotDownloader path: {}", depot_path_str);
            println!("Running interactively with args: {:?}", args);
            println!("Launching PowerShell in new console window...");
            
            let _child = cmd.spawn()?;
            println!("DepotDownloader launched in new PowerShell console window");
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Windows以外ではターミナルで実行
            let mut cmd = Command::new(&self.path)
                .args(args)
                .stdin(Stdio::inherit())
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .spawn()?;

            let status = cmd.wait()?;
            
            if !status.success() {
                return Err("DepotDownloader process failed".into());
            }
        }

        Ok(())
    }

    /// Resoniteをダウンロード/更新する（バックグラウンド）
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

    /// Resoniteをダウンロード/更新する（インタラクティブ、2FA対応）
    pub fn download_resonite_interactive(
        &self,
        install_dir: &str,
        branch: &str,
        manifest_id: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
    ) -> Result<(), Box<dyn Error>> {
        let args = self.build_resonite_args(install_dir, branch, manifest_id, username, password);
        
        self.run_interactive(&args)?;

        println!("Resonite download process launched in separate window");
        Ok(())
    }

    /// インタラクティブダウンロードの完了を監視する
    pub fn monitor_interactive_download(
        &self,
        install_dir: &str,
        callback: Box<dyn Fn(bool) + Send + 'static>,
    ) -> Result<(), Box<dyn Error>> {
        use std::thread;
        use std::time::Duration;
        use std::path::Path;

        let install_path = Path::new(install_dir);
        let resonite_exe = install_path.join("Resonite.exe");
        
        println!("Monitoring installation at: {}", resonite_exe.display());

        // バックグラウンドスレッドで監視
        thread::spawn(move || {
            let mut last_exists = resonite_exe.exists();
            let mut last_size = if last_exists {
                std::fs::metadata(&resonite_exe).map(|m| m.len()).unwrap_or(0)
            } else {
                0
            };

            loop {
                thread::sleep(Duration::from_secs(2));

                let current_exists = resonite_exe.exists();
                let current_size = if current_exists {
                    std::fs::metadata(&resonite_exe).map(|m| m.len()).unwrap_or(0)
                } else {
                    0
                };

                // ファイルが新しく作成されたか、サイズが安定した場合に完了と判定
                if current_exists && (!last_exists || (current_size > 0 && current_size == last_size)) {
                    // さらに2秒待ってサイズが変わらないことを確認
                    thread::sleep(Duration::from_secs(2));
                    let final_size = if resonite_exe.exists() {
                        std::fs::metadata(&resonite_exe).map(|m| m.len()).unwrap_or(0)
                    } else {
                        0
                    };

                    if final_size == current_size && final_size > 0 {
                        println!("Installation completed! Resonite.exe detected at: {}", resonite_exe.display());
                        callback(true);
                        break;
                    }
                }

                last_exists = current_exists;
                last_size = current_size;
            }
        });

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
