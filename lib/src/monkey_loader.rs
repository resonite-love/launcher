use std::path::{Path, PathBuf};
use std::fs;
use reqwest;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonkeyLoaderInfo {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

const GITHUB_API_URL: &str = "https://api.github.com/repos/ResoniteModdingGroup/MonkeyLoader.GamePacks.Resonite/releases/latest";

pub struct MonkeyLoader {
    game_path: PathBuf,
}

impl MonkeyLoader {
    pub fn new(game_path: PathBuf) -> Self {
        Self { game_path }
    }

    /// MonkeyLoaderの状態を確認
    pub fn get_status(&self) -> Result<MonkeyLoaderInfo> {
        let winhttp_dll = self.game_path.join("winhttp.dll");
        let run_script = self.game_path.join("run_monkeyloader.sh");
        
        let installed = winhttp_dll.exists() || run_script.exists();
        
        let version = if installed {
            // バージョン情報の取得（後で実装を改善）
            self.detect_version()
        } else {
            None
        };

        Ok(MonkeyLoaderInfo {
            installed,
            version,
        })
    }

    /// MonkeyLoaderをインストール
    pub async fn install(&self) -> Result<String> {
        // 最新リリース情報を取得
        let release = self.get_latest_release().await?;
        
        // MonkeyLoader GamePackのzipファイルを見つける
        let gamepack_asset = release.assets.iter()
            .find(|asset| asset.name.starts_with("MonkeyLoader-") && asset.name.contains("Resonite") && asset.name.ends_with(".zip"))
            .ok_or_else(|| anyhow!("MonkeyLoader GamePack for Resonite not found in release assets"))?;

        // 一時ファイルにダウンロード
        let temp_path = self.game_path.join("monkeyloader_temp.zip");
        self.download_file(&gamepack_asset.browser_download_url, &temp_path).await?;

        // ZIPファイルを展開
        self.extract_zip(&temp_path, &self.game_path)?;

        // 一時ファイルを削除
        fs::remove_file(&temp_path)?;

        Ok(format!("MonkeyLoader {} をインストールしました", release.tag_name))
    }

    /// MonkeyLoaderをアンインストール
    pub fn uninstall(&self) -> Result<String> {
        // MonkeyLoader関連ファイルを削除
        let files_to_remove = vec![
            "winhttp.dll",
            "run_monkeyloader.sh",
            "doorstop_config.ini",
            "MonkeyLoader.dll",
        ];

        for file in files_to_remove {
            let file_path = self.game_path.join(file);
            if file_path.exists() {
                fs::remove_file(&file_path)?;
            }
        }

        // MonkeyLoaderディレクトリを削除
        let monkeyloader_dir = self.game_path.join("MonkeyLoader");
        if monkeyloader_dir.exists() {
            fs::remove_dir_all(&monkeyloader_dir)?;
        }

        Ok("MonkeyLoaderをアンインストールしました".to_string())
    }

    /// 起動引数の調整が必要かチェック（MonkeyLoaderは基本的に不要）
    pub fn needs_launch_arg_update(&self, current_args: &[String]) -> bool {
        // MonkeyLoaderは通常起動引数を必要としない
        // ただし、無効化フラグがある場合はチェック
        for arg in current_args {
            if arg == "--doorstop-enabled" {
                return true; // 無効化フラグがある場合は更新が必要
            }
        }
        false
    }

    /// 起動引数から無効化フラグを削除
    pub fn remove_disable_args(&self, current_args: &mut Vec<String>) {
        current_args.retain(|arg| !arg.starts_with("--doorstop-enabled"));
    }

    /// バージョンを検出（実装は後で改善）
    fn detect_version(&self) -> Option<String> {
        // 現在は固定値を返す（後でファイルから読み取るように改善）
        Some("Unknown".to_string())
    }

    /// GitHubから最新リリース情報を取得
    async fn get_latest_release(&self) -> Result<GitHubRelease> {
        let client = reqwest::Client::new();
        let response = client
            .get(GITHUB_API_URL)
            .header("User-Agent", "ResoniteTools")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch release info: {}", response.status()));
        }

        let release: GitHubRelease = response.json().await?;
        Ok(release)
    }

    /// ファイルをダウンロード
    async fn download_file(&self, url: &str, destination: &Path) -> Result<()> {
        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("User-Agent", "ResoniteTools")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download file: {}", response.status()));
        }

        let bytes = response.bytes().await?;
        fs::write(destination, bytes)?;
        Ok(())
    }

    /// ZIPファイルを展開
    fn extract_zip(&self, zip_path: &Path, destination: &Path) -> Result<()> {
        let file = fs::File::open(zip_path)?;
        let mut archive = ZipArchive::new(file)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = destination.join(file.name());

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(&p)?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        Ok(())
    }
}