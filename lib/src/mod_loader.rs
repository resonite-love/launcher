use std::path::{Path, PathBuf};
use std::fs;
use reqwest;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

#[derive(Debug, Serialize, Deserialize)]
pub struct ModLoaderInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub installation_path: Option<PathBuf>,
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

const GITHUB_API_URL: &str = "https://api.github.com/repos/resonite-modding-group/ResoniteModLoader/releases/latest";
const HARMONY_URL: &str = "https://github.com/pardeike/Harmony/releases/download/v2.3.3.0/Harmony.2.3.3.0.nupkg";

pub struct ModLoader {
    game_path: PathBuf,
}

impl ModLoader {
    pub fn new(game_path: PathBuf) -> Self {
        Self { game_path }
    }

    /// ResoniteModLoaderの状態を確認
    pub fn get_status(&self) -> Result<ModLoaderInfo> {
        let libraries_path = self.game_path.join("Libraries");
        let mod_loader_dll = libraries_path.join("ResoniteModLoader.dll");
        let rml_libs_path = self.game_path.join("rml_libs");
        let harmony_dll = rml_libs_path.join("0Harmony.dll");

        let installed = mod_loader_dll.exists() && harmony_dll.exists();
        
        let version = if installed {
            // ここではファイルのバージョン情報を取得するか、既知のバージョンを返す
            Some("3.0.0".to_string())
        } else {
            None
        };

        let installation_path = if installed {
            Some(libraries_path)
        } else {
            None
        };

        Ok(ModLoaderInfo {
            installed,
            version,
            installation_path,
        })
    }

    /// ResoniteModLoaderをインストール
    pub async fn install(&self) -> Result<String> {
        // 必要なディレクトリを作成
        let libraries_path = self.game_path.join("Libraries");
        let rml_libs_path = self.game_path.join("rml_libs");
        let rml_mods_path = self.game_path.join("rml_mods");

        fs::create_dir_all(&libraries_path)?;
        fs::create_dir_all(&rml_libs_path)?;
        fs::create_dir_all(&rml_mods_path)?;

        // 最新リリース情報を取得
        let release = self.get_latest_release().await?;
        
        // ResoniteModLoader.dllをダウンロード
        let mod_loader_asset = release.assets.iter()
            .find(|asset| asset.name == "ResoniteModLoader.dll")
            .ok_or_else(|| anyhow!("ResoniteModLoader.dll not found in release assets"))?;

        self.download_file(&mod_loader_asset.browser_download_url, &libraries_path.join("ResoniteModLoader.dll")).await?;

        // 0Harmony.dllをダウンロードして展開
        self.download_harmony(&rml_libs_path).await?;

        Ok(format!("ResoniteModLoader {} をインストールしました", release.tag_name))
    }

    /// ResoniteModLoaderをアンインストール
    pub fn uninstall(&self) -> Result<String> {
        let libraries_path = self.game_path.join("Libraries");
        let mod_loader_dll = libraries_path.join("ResoniteModLoader.dll");
        let rml_libs_path = self.game_path.join("rml_libs");
        let rml_mods_path = self.game_path.join("rml_mods");

        // ファイルを削除
        if mod_loader_dll.exists() {
            fs::remove_file(&mod_loader_dll)?;
        }

        // rml_libsディレクトリを削除
        if rml_libs_path.exists() {
            fs::remove_dir_all(&rml_libs_path)?;
        }

        // rml_modsディレクトリは残す（ユーザーのMODがある可能性）

        Ok("ResoniteModLoaderをアンインストールしました".to_string())
    }

    /// 起動引数にModLoaderの読み込みを追加する必要があるかチェック
    pub fn needs_launch_arg_update(&self, current_args: &[String]) -> bool {
        let required_arg = "-LoadAssembly";
        let required_value = "%GAME_DIR%/Libraries/ResoniteModLoader.dll";
        
        // 現在の引数に既に含まれているかチェック
        for (i, arg) in current_args.iter().enumerate() {
            if arg == required_arg {
                if i + 1 < current_args.len() && current_args[i + 1] == required_value {
                    return false; // 既に正しく設定されている
                }
            }
        }
        true // 追加が必要
    }

    /// 起動引数にModLoader用の引数を追加
    pub fn add_launch_args(&self, current_args: &mut Vec<String>) {
        if self.needs_launch_arg_update(current_args) {
            current_args.push("-LoadAssembly".to_string());
            current_args.push("%GAME_DIR%/Libraries/ResoniteModLoader.dll".to_string());
        }
    }

    /// 起動引数からModLoader用の引数を除去
    pub fn remove_launch_args(&self, current_args: &mut Vec<String>) {
        let mut i = 0;
        while i < current_args.len() {
            if current_args[i] == "-LoadAssembly" && 
               i + 1 < current_args.len() && 
               current_args[i + 1] == "%GAME_DIR%/Libraries/ResoniteModLoader.dll" {
                current_args.remove(i);
                current_args.remove(i); // 次の要素も削除
            } else {
                i += 1;
            }
        }
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

    /// Harmonyライブラリをダウンロードして展開
    async fn download_harmony(&self, rml_libs_path: &Path) -> Result<()> {
        // 簡易実装：事前にビルドされた0Harmony.dllを直接ダウンロード
        // 実際の実装では、NuGetパッケージを展開する必要がある
        let _harmony_dll_url = "https://github.com/pardeike/Harmony/releases/download/v2.3.3.0/Harmony.2.3.3.0.zip";
        
        // 一時的な解決策として、既知の直接URLを使用
        // 実際の実装では、zipファイルをダウンロードして展開する
        let _harmony_direct_url = "https://www.nuget.org/api/v2/package/Lib.Harmony/2.3.3";
        
        // とりあえず簡単な実装として、Harmonyの公開されているDLLを使用
        // 本来はNuGetパッケージから抽出する必要がある
        let harmony_url = "https://github.com/resonite-modding-group/ResoniteModLoader/releases/download/3.0.0/0Harmony.dll";
        
        self.download_file(harmony_url, &rml_libs_path.join("0Harmony.dll")).await?;
        Ok(())
    }
}