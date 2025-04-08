use std::path::{Path, PathBuf};
use std::error::Error;
use std::process::{Command, Output, Stdio};

/// SteamCMDを操作するための構造体
pub struct SteamCmd {
    path: PathBuf,
}

impl SteamCmd {
    /// 指定されたパスにあるSteamCMDを使用する新しいインスタンスを作成
    pub fn new(steam_cmd_path: &Path) -> Self {
        SteamCmd {
            path: steam_cmd_path.to_path_buf(),
        }
    }

    /// デフォルトの場所を使用して新しいインスタンスを作成
    pub fn with_default_path(base_dir: &Path) -> Self {
        let steamcmd_dir = base_dir.join("steamcmd");
        let steamcmd_exe = if cfg!(target_os = "windows") {
            steamcmd_dir.join("steamcmd.exe")
        } else {
            steamcmd_dir.join("steamcmd")
        };

        SteamCmd {
            path: steamcmd_exe,
        }
    }

    /// SteamCMDの存在を確認する
    pub fn check_exists(&self) -> Result<(), Box<dyn Error>> {
        let steamcmd_dir = self.path.parent().ok_or("Invalid steamcmd path")?;

        // Check if steamcmd directory exists
        if !steamcmd_dir.exists() {
            return Err(format!(
                "steamcmd directory not found: {}. Please create it and install steamcmd there.",
                steamcmd_dir.display()
            )
            .into());
        }

        // Check if steamcmd executable exists
        if !self.path.exists() {
            return Err(format!(
                "steamcmd executable not found: {}. Please install steamcmd in the correct location.",
                self.path.display()
            )
            .into());
        }

        Ok(())
    }

    /// ログイン引数を構築する
    pub fn build_login_args(
        &self,
        username: Option<&str>,
        password: Option<&str>,
        auth_code: Option<&str>,
    ) -> Vec<String> {
        let mut args = Vec::new();

        args.push("+login".to_string());

        match (username, password) {
            (Some(username), Some(password)) => {
                args.push(username.to_string());
                args.push(password.to_string());

                // Steam Guardコードが提供されている場合はそれを追加
                if let Some(auth_code) = auth_code {
                    args.push(auth_code.to_string());
                }
            }
            (Some(username), None) => {
                args.push(username.to_string());
                // パスワードが提供されていない場合、steamcmdはパスワードの入力を求めます

                // Steam Guardコードが提供されている場合はそれを追加
                if let Some(auth_code) = auth_code {
                    // パスワードの入力後にコードが求められるため、ここでは効果がない可能性があります
                    args.push("password_placeholder".to_string()); // ダミーパスワード
                    args.push(auth_code.to_string());
                    println!("警告: パスワードなしでSteam GuardコードをCLIに直接渡すことはできない場合があります。");
                    println!(
                        "      対話的なプロンプトが表示された場合は、パスワードとSteam Guardコードを入力してください。"
                    );
                }
            }
            _ => {
                // 認証情報が提供されていない場合は匿名ログインにフォールバックします
                args.push("anonymous".to_string());
            }
        }

        args
    }

    /// 対話型Steamログインを実行する
    pub fn interactive_login(&self, username: &str) -> Result<(), Box<dyn Error>> {
        println!("Interactive Steam login for user: {}", username);
        println!("This will save your credentials for future use.");
        println!("You will be prompted for your password and Steam Guard code.");

        // Prepare the login command
        let args = vec![
            "+login".to_string(),
            username.to_string(),
            "+quit".to_string(), // 自動終了コマンドを追加
        ];

        // Run steamcmd with the login command in interactive mode
        let mut cmd = Command::new(&self.path)
            .args(&args)
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()?;

        // Wait for the command to complete
        let status = cmd.wait()?;

        if status.success() {
            println!("\nLogin successful! Your credentials have been saved by steamcmd.");
            println!("You can now use other commands without specifying login details.");
            Ok(())
        } else {
            println!("\nLogin failed. Please try again.");
            Err("Steam login failed".into())
        }
    }

    /// 指定された引数でSteamCMDを実行する
    pub fn run(&self, args: &[String]) -> Result<Output, Box<dyn Error>> {
        println!("Using steamcmd path: {}", self.path.display());

        // Run steamcmd with the provided arguments
        let output = Command::new(&self.path).args(args).output()?;

        Ok(output)
    }
}
