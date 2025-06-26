use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::fs;
use std::time::Duration;
use reqwest;
use sha2::{Sha256, Digest};

/// MODマニフェストから取得したMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfo {
    pub name: String,
    pub description: String,
    pub category: Option<String>,
    pub source_location: String,
    pub author: String,
    pub latest_version: Option<String>,
    pub latest_download_url: Option<String>,
    pub releases: Vec<ModRelease>,
    pub tags: Option<Vec<String>>,
    pub flags: Option<Vec<String>>,
    pub last_updated: Option<String>,
}

/// MODの個別リリース情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModRelease {
    pub version: String,
    pub download_url: Option<String>,
    pub release_url: String,
    pub published_at: String,
    pub prerelease: bool,
    pub draft: bool,
    pub changelog: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub sha256: Option<String>,
}

/// インストール済みMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledMod {
    pub name: String,
    pub description: String,
    pub source_location: String,
    pub installed_version: String,
    pub installed_date: String,
    pub dll_path: PathBuf,
    #[serde(default)]
    pub mod_loader_type: Option<String>, // "ResoniteModLoader" or "MonkeyLoader"
    #[serde(default)]
    pub file_format: Option<String>, // "dll" or "nupkg"
    #[serde(default)]
    pub enabled: Option<bool>, // MODの有効/無効状態
}

/// 未管理MOD情報（手動で追加されたMOD）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnmanagedMod {
    pub file_name: String,
    pub file_path: PathBuf,
    pub file_size: u64,
    pub modified_time: String,
    pub dll_name: String,
    pub matched_mod_info: Option<ModInfo>,
    pub calculated_sha256: Option<String>,
    pub detected_version: Option<String>,
}

/// ハッシュルックアップエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashLookupEntry {
    pub mod_name: String,
    pub version: String,
    pub download_url: String,
    pub file_name: String,
    pub file_size: u64,
}

/// アップグレード可能なMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpgradeableMod {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub description: String,
    pub source_location: String,
}

/// GitHubリリース情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub assets: Vec<GitHubAsset>,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub draft: Option<bool>,
    #[serde(default)]
    pub prerelease: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub download_count: Option<u64>,
}

/// ファイル配置先の選択肢
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDestination {
    pub path: String,
    pub description: String,
}

/// 複数ファイルの配置選択要求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiFileInstallRequest {
    pub assets: Vec<GitHubAsset>,
    pub available_destinations: Vec<FileDestination>,
    pub releases: Vec<GitHubRelease>,
    pub selected_version: String,
}

/// ユーザーのファイル配置選択
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInstallChoice {
    pub asset_name: String,
    pub destination_path: String,
}

/// MODマニフェストの構造
#[derive(Debug, Deserialize)]
struct ModManifest {
    objects: HashMap<String, AuthorEntry>,
}

#[derive(Debug, Deserialize)]
struct AuthorEntry {
    author: HashMap<String, Author>,
    entries: HashMap<String, ModEntry>,
}

#[derive(Debug, Deserialize)]
struct Author {
    url: String,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    support: Option<String>,
    #[serde(default)]
    website: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModEntry {
    name: String,
    description: String,
    category: String, // 必須フィールドに変更
    #[serde(rename = "sourceLocation")]
    source_location: String,
    #[serde(default)]
    tags: Option<Vec<String>>,
    #[serde(default)]
    flags: Option<Vec<String>>,
    #[serde(default)]
    versions: Option<HashMap<String, ModVersion>>,
    #[serde(default)]
    platforms: Option<Vec<String>>,
    #[serde(default)]
    dependencies: Option<HashMap<String, DependencyInfo>>,
    #[serde(default)]
    conflicts: Option<HashMap<String, ConflictInfo>>,
    #[serde(rename = "additionalAuthors", default)]
    additional_authors: Option<HashMap<String, HashMap<String, Author>>>,
}

#[derive(Debug, Deserialize)]
struct DependencyInfo {
    version: String,
}

#[derive(Debug, Deserialize)]
struct ConflictInfo {
    version: String,
}

#[derive(Debug, Deserialize)]
struct ModVersion {
    #[serde(default)]
    artifacts: Option<Vec<Artifact>>,
    #[serde(rename = "releaseUrl", default)]
    release_url: Option<String>,
    #[serde(default)]
    changelog: Option<String>,
    #[serde(default)]
    dependencies: Option<HashMap<String, DependencyInfo>>,
}

#[derive(Debug, Deserialize)]
struct Artifact {
    url: String,
    #[serde(default)]
    sha256: Option<String>,
}

/// MOD管理システム
pub struct ModManager {
    profile_dir: PathBuf,
    mods_dir: PathBuf,
    installed_mods_file: PathBuf,
    client: reqwest::Client,
}

impl ModManager {
    /// 新しいModManagerを作成
    pub fn new(profile_dir: PathBuf) -> Self {
        let mods_dir = profile_dir.join("Game").join("rml_mods");
        let installed_mods_file = profile_dir.join("installed_mods.json");
        
        ModManager {
            profile_dir,
            mods_dir,
            installed_mods_file,
            client: reqwest::Client::new(),
        }
    }

    /// キャッシュされたMOD一覧を取得
    pub async fn fetch_mod_manifest(&self) -> Result<Vec<ModInfo>, Box<dyn Error + Send + Sync>> {
        // ローカルキャッシュファイルのパス
        let cache_file = self.profile_dir.join("mod_manifest_cache.json");
        let cache_metadata_file = self.profile_dir.join("mod_manifest_cache_meta.json");
        
        // キャッシュの有効期限（10分）
        let cache_duration = Duration::from_secs(10 * 60);
        
        // キャッシュの確認
        if let Ok(metadata_content) = fs::read_to_string(&cache_metadata_file) {
            if let Ok(cache_time) = serde_json::from_str::<u64>(&metadata_content) {
                let cache_timestamp = std::time::UNIX_EPOCH + Duration::from_secs(cache_time);
                let now = std::time::SystemTime::now();
                
                if let Ok(elapsed) = now.duration_since(cache_timestamp) {
                    if elapsed < cache_duration {
                        // キャッシュが有効な場合、キャッシュから読み込み
                        if let Ok(cache_content) = fs::read_to_string(&cache_file) {
                            if let Ok(cached_mods) = serde_json::from_str::<Vec<ModInfo>>(&cache_content) {
                                println!("Using cached MOD manifest (age: {}s)", elapsed.as_secs());
                                return Ok(cached_mods);
                            }
                        }
                    }
                }
            }
        }
        
        // キャッシュが無効または存在しない場合、リモートから取得
        println!("Fetching MOD manifest from remote source...");
        let cache_url = "https://raw.githubusercontent.com/resonite-love/resonite-mod-cache/master/cache/mods.json";
        
        let response = self.client.get(cache_url).send().await?;
        let mods_text = response.text().await?;
        let mods: Vec<ModInfo> = serde_json::from_str(&mods_text)?;
        
        // キャッシュに保存
        if let Err(e) = fs::write(&cache_file, &mods_text) {
            eprintln!("Failed to write MOD manifest cache: {}", e);
        }
        
        let now_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        if let Err(e) = fs::write(&cache_metadata_file, serde_json::to_string(&now_timestamp).unwrap_or_default()) {
            eprintln!("Failed to write MOD manifest cache metadata: {}", e);
        }
        
        Ok(mods)
    }

    /// GitHubリポジトリから最新リリース情報を取得
    pub async fn get_latest_release_info(&self, repo_url: &str) -> Result<(Option<String>, Option<String>), Box<dyn Error + Send + Sync>> {
        // GitHubリポジトリURLからAPI URLを生成
        let api_url = self.github_repo_to_api_url(repo_url)?;
        
        let response = self.client
            .get(&format!("{}/releases/latest", api_url))
            .header("User-Agent", "resonite-tools")
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Ok((None, None));
        }
        
        let response_text = response.text().await?;
        let release: GitHubRelease = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse GitHub release JSON: {}", e))?;
        
        // .dllファイルを含むアセットを探す
        let dll_asset = release.assets.iter()
            .find(|asset| asset.name.ends_with(".dll"));
            
        let download_url = dll_asset.map(|asset| asset.browser_download_url.clone());
        
        Ok((Some(release.tag_name), download_url))
    }

    /// GitHubリポジトリから全てのリリース一覧を取得
    pub async fn get_all_releases(&self, repo_url: &str) -> Result<Vec<GitHubRelease>, Box<dyn Error + Send + Sync>> {
        let api_url = self.github_repo_to_api_url(repo_url)?;
        
        let response = self.client
            .get(&format!("{}/releases", api_url))
            .header("User-Agent", "resonite-tools")
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(format!("GitHub API request failed: {}", response.status()).into());
        }
        
        let response_text = response.text().await?;
        let releases: Vec<GitHubRelease> = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse GitHub releases JSON: {}", e))?;
        
        Ok(releases)
    }

    /// 指定されたMODの全バージョン情報を取得
    pub async fn get_mod_versions(&self, mod_info: &ModInfo) -> Result<Vec<ModRelease>, Box<dyn Error + Send + Sync>> {
        // キャッシュされたリリース情報がある場合はそれを使用
        if !mod_info.releases.is_empty() {
            return Ok(mod_info.releases.clone());
        }
        
        // フォールバック: GitHubから直接取得
        let github_releases = self.get_all_releases(&mod_info.source_location).await?;
        
        let mut mod_releases = Vec::new();
        for release in github_releases {
            // DLLファイルを含むアセットを探す
            let dll_asset = release.assets.iter()
                .find(|asset| asset.name.ends_with(".dll"));
            
            if let Some(asset) = dll_asset {
                mod_releases.push(ModRelease {
                    version: release.tag_name.clone(),
                    download_url: Some(asset.browser_download_url.clone()),
                    release_url: format!("{}/releases/tag/{}", mod_info.source_location, release.tag_name),
                    published_at: release.published_at.unwrap_or_default(),
                    prerelease: release.prerelease.unwrap_or(false),
                    draft: release.draft.unwrap_or(false),
                    changelog: release.body.clone(),
                    file_name: Some(asset.name.clone()),
                    file_size: asset.size,
                    sha256: None, // キャッシュから取得される場合のみ設定
                });
            }
        }
        
        Ok(mod_releases)
    }

    /// MODをインストール（キャッシュ情報を活用）
    pub async fn install_mod_from_cache(&self, mod_info: &ModInfo, version: Option<&str>, mod_loader_type: Option<&str>) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        // 指定されたバージョンまたは最新バージョンのリリース情報を取得
        let release = if let Some(target_version) = version {
            mod_info.releases.iter()
                .find(|r| r.version == target_version)
                .ok_or(format!("Version {} not found", target_version))?
        } else {
            mod_info.releases.first()
                .ok_or("No releases available")?
        };
        
        let download_url = release.download_url.as_ref()
            .ok_or("No download URL available for this release")?;
        
        // ファイル名を取得
        let file_name = release.file_name.as_deref()
            .or_else(|| download_url.split('/').last())
            .ok_or("Cannot determine file name")?;
        
        // ファイル形式とインストール先を決定
        let (file_format, install_dir) = if mod_loader_type == Some("MonkeyLoader") {
            if file_name.ends_with(".nupkg") {
                ("nupkg", self.profile_dir.join("Game").join("MonkeyLoader").join("Mods"))
            } else if file_name.ends_with(".dll") {
                ("dll", self.mods_dir.clone()) // MonkeyLoaderでもDLLはrml_modsフォルダに
            } else {
                return Err("Downloaded file is not a DLL or NuGet package for MonkeyLoader".into());
            }
        } else {
            if !file_name.ends_with(".dll") {
                return Err("Downloaded file is not a DLL".into());
            }
            ("dll", self.mods_dir.clone())
        };
        
        // インストールディレクトリを作成
        fs::create_dir_all(&install_dir)?;
        
        // ファイルをダウンロード
        let file_response = self.client.get(download_url).send().await?;
        let file_content = file_response.bytes().await?;
        
        let file_path = install_dir.join(file_name);
        fs::write(&file_path, file_content)?;
        
        let installed_mod = InstalledMod {
            name: mod_info.name.clone(),
            description: release.changelog.clone().unwrap_or_else(|| mod_info.description.clone()),
            source_location: mod_info.source_location.clone(),
            installed_version: release.version.clone(),
            installed_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            dll_path: file_path,
            mod_loader_type: mod_loader_type.map(|s| s.to_string()),
            file_format: Some(file_format.to_string()),
            enabled: Some(true), // 新規インストール時は有効
        };
        
        // インストール済みMOD一覧に追加
        self.add_to_installed_mods(&installed_mod)?;
        
        Ok(installed_mod)
    }

    /// GitHubリリースの複数ファイルをチェックし、選択が必要かどうかを判定
    pub async fn check_multi_file_install(&self, repo_url: &str, version: Option<&str>) -> Result<Option<MultiFileInstallRequest>, Box<dyn Error + Send + Sync>> {
        let api_url = self.github_repo_to_api_url(repo_url)?;
        
        // 全てのリリースを取得
        let all_releases_url = format!("{}/releases", api_url);
        let all_releases_response = self.client
            .get(&all_releases_url)
            .header("User-Agent", "resonite-tools")
            .send()
            .await?;
            
        if !all_releases_response.status().is_success() {
            return Err(format!("GitHub API request failed: {}", all_releases_response.status()).into());
        }
        
        let all_releases_text = all_releases_response.text().await?;
        let all_releases: Vec<GitHubRelease> = serde_json::from_str(&all_releases_text)
            .map_err(|e| format!("Failed to parse GitHub releases JSON: {}. Response: {}", e, &all_releases_text[..200.min(all_releases_text.len())]))?;
        
        // 指定されたバージョンまたは最新リリースを選択
        let selected_release = if let Some(version) = version {
            all_releases.iter()
                .find(|r| r.tag_name == version)
                .ok_or(format!("Version {} not found", version))?
        } else {
            all_releases.first()
                .ok_or("No releases found")?
        };
        
        let selected_version = selected_release.tag_name.clone();
        
        // ソースコードとアーカイブファイルを除外したファイルを抽出
        let installable_assets: Vec<GitHubAsset> = selected_release.assets.iter()
            .filter(|asset| {
                let name_lower = asset.name.to_lowercase();
                // ソースコード関連ファイルを除外
                !name_lower.contains("source") &&
                !name_lower.contains("src") &&
                // 一般的なアーカイブファイルを除外
                !name_lower.ends_with(".zip") &&
                !name_lower.ends_with(".tar.gz") &&
                !name_lower.ends_with(".rar") &&
                !name_lower.ends_with(".7z") &&
                // GitHubのデフォルトソースアーカイブを除外
                !name_lower.starts_with("source-code")
            })
            .cloned()
            .collect();
        
        // 2つ以上のファイルがある場合、選択が必要
        if installable_assets.len() >= 2 {
            let available_destinations = vec![
                FileDestination {
                    path: "rml_mods".to_string(),
                    description: "ResoniteModLoader / rml_mods フォルダ".to_string(),
                },
                FileDestination {
                    path: "Mods".to_string(),
                    description: "MonkeyLoader / Mods フォルダ".to_string(),
                },
                FileDestination {
                    path: "Libraries".to_string(),
                    description: "Resonite / Libraries フォルダ".to_string(),
                },
                FileDestination {
                    path: "RuntimeData".to_string(),
                    description: "Resonite / RuntimeData フォルダ".to_string(),
                },
                FileDestination {
                    path: "skip".to_string(),
                    description: "インストールしない".to_string(),
                },
            ];
            
            Ok(Some(MultiFileInstallRequest {
                assets: installable_assets,
                available_destinations,
                releases: all_releases,
                selected_version,
            }))
        } else {
            Ok(None)
        }
    }

    /// 複数ファイルをユーザーの選択に基づいてインストール
    pub async fn install_multiple_files(&self, repo_url: &str, version: Option<&str>, choices: Vec<FileInstallChoice>) -> Result<Vec<InstalledMod>, Box<dyn Error + Send + Sync>> {
        let api_url = self.github_repo_to_api_url(repo_url)?;
        
        // リリース情報を再取得
        let release_url = if let Some(version) = version {
            format!("{}/releases/tags/{}", api_url, version)
        } else {
            format!("{}/releases/latest", api_url)
        };
        
        let response = self.client
            .get(&release_url)
            .header("User-Agent", "resonite-tools")
            .send()
            .await?;
            
        let response_text = response.text().await?;
        let release: GitHubRelease = serde_json::from_str(&response_text)?;
        
        let mut installed_mods = Vec::new();
        
        for choice in choices {
            // スキップが選択された場合は何もしない
            if choice.destination_path == "skip" {
                continue;
            }
            
            // 選択されたアセットを見つける
            let asset = release.assets.iter()
                .find(|a| a.name == choice.asset_name)
                .ok_or(format!("Asset {} not found", choice.asset_name))?;
            
            // インストール先ディレクトリを決定
            let install_dir = match choice.destination_path.as_str() {
                "rml_mods" => self.mods_dir.clone(),
                "Mods" => self.profile_dir.join("Game").join("MonkeyLoader").join("Mods"),
                "Libraries" => self.profile_dir.join("Game").join("Resonite_Data").join("Managed"),
                "RuntimeData" => self.profile_dir.join("Game").join("RuntimeData"),
                _ => return Err(format!("Invalid destination: {}", choice.destination_path).into()),
            };
            
            // ファイル形式を判定（拡張子から）
            let file_format = if let Some(ext) = std::path::Path::new(&asset.name).extension() {
                ext.to_string_lossy().to_string()
            } else {
                "unknown".to_string()
            };
            
            // インストールディレクトリを作成
            fs::create_dir_all(&install_dir)?;
            
            // ファイルをダウンロード
            let file_response = self.client.get(&asset.browser_download_url).send().await?;
            let file_content = file_response.bytes().await?;
            
            let file_path = install_dir.join(&asset.name);
            fs::write(&file_path, file_content)?;
            
            // MODローダータイプを判定
            let mod_loader_type = if choice.destination_path == "Mods" {
                Some("MonkeyLoader".to_string())
            } else {
                None
            };
            
            let installed_mod = InstalledMod {
                name: asset.name.trim_end_matches(&format!(".{}", file_format)).to_string(),
                description: release.body.clone().unwrap_or_default(),
                source_location: repo_url.to_string(),
                installed_version: release.tag_name.clone(),
                installed_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                dll_path: file_path,
                mod_loader_type,
                file_format: Some(file_format.to_string()),
                enabled: Some(true),
            };
            
            // インストール済みMOD一覧に追加
            self.add_to_installed_mods(&installed_mod)?;
            installed_mods.push(installed_mod);
        }
        
        Ok(installed_mods)
    }

    /// GitHubリポジトリからMODをインストール（フォールバック）
    pub async fn install_mod_from_github(&self, repo_url: &str, version: Option<&str>, mod_loader_type: Option<&str>) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        let api_url = self.github_repo_to_api_url(repo_url)?;
        
        // 指定されたバージョンまたは最新リリースを取得
        let release_url = if let Some(version) = version {
            format!("{}/releases/tags/{}", api_url, version)
        } else {
            format!("{}/releases/latest", api_url)
        };
        
        let response = self.client
            .get(&release_url)
            .header("User-Agent", "resonite-tools")
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(format!("GitHub API request failed: {}", response.status()).into());
        }
        
        // レスポンステキストを取得してデバッグ
        let response_text = response.text().await?;
        
        let release: GitHubRelease = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse GitHub release JSON: {}. Response: {}", e, &response_text[..200.min(response_text.len())]))?;
        
        // MODローダータイプに応じてファイルを探す
        let (asset, file_format, install_dir) = if mod_loader_type == Some("MonkeyLoader") {
            // MonkeyLoaderの場合、NuGetパッケージファイルまたはDLLファイルを探す
            if let Some(nupkg_asset) = release.assets.iter().find(|asset| asset.name.ends_with(".nupkg")) {
                let monkey_mods_dir = self.profile_dir.join("Game").join("MonkeyLoader").join("Mods");
                (nupkg_asset, "nupkg", monkey_mods_dir)
            } else if let Some(dll_asset) = release.assets.iter().find(|asset| asset.name.ends_with(".dll")) {
                (dll_asset, "dll", self.mods_dir.clone()) // MonkeyLoaderでもDLLはrml_modsフォルダに
            } else {
                return Err("No NuGet package or DLL file found in release for MonkeyLoader".into());
            }
        } else {
            // ResoniteModLoaderの場合、DLLファイルのみ
            let dll_asset = release.assets.iter()
                .find(|asset| asset.name.ends_with(".dll"))
                .ok_or("No DLL file found in release")?;
            (dll_asset, "dll", self.mods_dir.clone())
        };
        
        // インストールディレクトリを作成
        fs::create_dir_all(&install_dir)?;
        
        // ファイルをダウンロード
        let file_response = self.client.get(&asset.browser_download_url).send().await?;
        let file_content = file_response.bytes().await?;
        
        let file_path = install_dir.join(&asset.name);
        fs::write(&file_path, file_content)?;
        
        let installed_mod = InstalledMod {
            name: asset.name.trim_end_matches(&format!(".{}", file_format)).to_string(),
            description: release.body.unwrap_or_default(),
            source_location: repo_url.to_string(),
            installed_version: release.tag_name,
            installed_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            dll_path: file_path,
            mod_loader_type: mod_loader_type.map(|s| s.to_string()),
            file_format: Some(file_format.to_string()),
            enabled: Some(true), // 新規インストール時は有効
        };
        
        // インストール済みMOD一覧に追加
        self.add_to_installed_mods(&installed_mod)?;
        
        Ok(installed_mod)
    }

    /// インストール済みMOD一覧を取得
    pub fn get_installed_mods(&self) -> Result<Vec<InstalledMod>, Box<dyn Error + Send + Sync>> {
        if !self.installed_mods_file.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.installed_mods_file)?;
        let mut mods: Vec<InstalledMod> = serde_json::from_str(&content)?;
        
        // マイグレーションが必要かチェック
        let mut needs_migration = false;
        for mod_info in &mut mods {
            if mod_info.mod_loader_type.is_none() || mod_info.file_format.is_none() || mod_info.enabled.is_none() {
                needs_migration = true;
                
                // ファイル形式を拡張子から判定
                let file_format = if mod_info.dll_path.extension().and_then(|ext| ext.to_str()) == Some("nupkg") {
                    "nupkg"
                } else if mod_info.dll_path.extension().and_then(|ext| ext.to_str()) == Some("disabled") {
                    // .disabledファイルの場合、元の拡張子を確認
                    let path_str = mod_info.dll_path.to_string_lossy();
                    if path_str.contains(".nupkg.disabled") {
                        "nupkg"
                    } else {
                        "dll"
                    }
                } else {
                    "dll"
                };
                
                // MODローダータイプを判定
                let mod_loader_type = if file_format == "nupkg" {
                    "MonkeyLoader"
                } else {
                    "ResoniteModLoader"
                };
                
                // 有効状態を判定（.disabledでなければ有効）
                let enabled = !mod_info.dll_path.extension().and_then(|ext| ext.to_str()).map_or(false, |ext| ext == "disabled");
                
                // フィールドを更新
                if mod_info.mod_loader_type.is_none() {
                    mod_info.mod_loader_type = Some(mod_loader_type.to_string());
                }
                if mod_info.file_format.is_none() {
                    mod_info.file_format = Some(file_format.to_string());
                }
                if mod_info.enabled.is_none() {
                    mod_info.enabled = Some(enabled);
                }
            }
        }
        
        // マイグレーションが実行された場合、ファイルを更新
        if needs_migration {
            self.save_installed_mods(&mods)?;
        }
        
        // ファイルが実際に存在するもののみ返す
        Ok(mods.into_iter()
            .filter(|mod_info| mod_info.dll_path.exists())
            .collect())
    }

    /// MODフォルダをスキャンして全MODファイルを検出（RMLとMonkeyLoader両方）
    pub fn scan_mod_folder(&self) -> Result<Vec<UnmanagedMod>, Box<dyn Error + Send + Sync>> {
        let mut unmanaged_mods = Vec::new();
        let known_mods = self.get_installed_mods().unwrap_or_default();
        
        // スキャンするディレクトリのリスト
        let scan_dirs = vec![
            (self.mods_dir.clone(), vec!["dll"]), // RML mods と MonkeyLoader dll mods
            (self.profile_dir.join("Game").join("MonkeyLoader").join("Mods"), vec!["nupkg"]), // MonkeyLoader nupkg mods のみ
        ];
        
        for (dir, extensions) in scan_dirs {
            if !dir.exists() {
                continue;
            }
            
            // フォルダ内の全ファイルを取得
            for entry in fs::read_dir(&dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if extensions.contains(&ext) {
                        let file_name = path.file_name()
                            .and_then(|name| name.to_str())
                            .unwrap_or_default()
                            .to_string();
                        
                        // 既知のMODリストに含まれているかチェック
                        let is_managed = known_mods.iter().any(|known_mod| {
                            known_mod.dll_path == path
                        });
                        
                        if !is_managed {
                            // ファイル情報を取得
                            let metadata = fs::metadata(&path)?;
                            let file_size = metadata.len();
                            let modified_time = metadata.modified()
                                .map(|time| {
                                    let datetime: chrono::DateTime<chrono::Utc> = time.into();
                                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                                })
                                .unwrap_or_default();
                            
                            // dll_nameを拡張子に基づいて設定
                            let dll_name = if file_name.ends_with(".dll") {
                                file_name.trim_end_matches(".dll").to_string()
                            } else if file_name.ends_with(".nupkg") {
                                file_name.trim_end_matches(".nupkg").to_string()
                            } else {
                                file_name.clone()
                            };
                            
                            unmanaged_mods.push(UnmanagedMod {
                                file_name: file_name.clone(),
                                file_path: path,
                                file_size,
                                modified_time,
                                dll_name,
                                matched_mod_info: None, // 後でマッチングを行う
                                calculated_sha256: None, // 後でハッシュを計算
                                detected_version: None, // 後でバージョンを検出
                            });
                        }
                    }
                }
            }
        }
        
        Ok(unmanaged_mods)
    }

    /// 未管理MODとマニフェストMODのマッチングを試行
    pub async fn match_unmanaged_mods(&self, mut unmanaged_mods: Vec<UnmanagedMod>) -> Result<Vec<UnmanagedMod>, Box<dyn Error + Send + Sync>> {
        let manifest_mods = self.fetch_mod_manifest().await.unwrap_or_default();
        
        for unmanaged_mod in &mut unmanaged_mods {
            // ファイルのSHA256ハッシュを計算
            let file_hash = self.calculate_file_sha256(&unmanaged_mod.file_path)?;
            unmanaged_mod.calculated_sha256 = Some(file_hash.clone());
            
            // ハッシュベースでのマッチングを最初に試行
            let hash_match = self.find_mod_by_hash(&file_hash).await;
            
            if let Some(hash_entry) = hash_match {
                // ハッシュマッチが見つかった場合、バージョンを設定
                unmanaged_mod.detected_version = Some(hash_entry.version.clone());
                println!("Hash match found for {}: version {}", unmanaged_mod.dll_name, hash_entry.version);
                
                // 対応するMOD情報を探す（MOD名ベースでマッチング）
                let matched_mod = manifest_mods.iter().find(|manifest_mod| {
                    manifest_mod.name == hash_entry.mod_name
                });
                
                if let Some(matched_mod) = matched_mod {
                    unmanaged_mod.matched_mod_info = Some(matched_mod.clone());
                    println!("Matched mod info found for {}", unmanaged_mod.dll_name);
                    continue;
                } else {
                    println!("No matched mod info found for {} (looking for '{}')", unmanaged_mod.dll_name, hash_entry.mod_name);
                }
            } else {
                println!("No hash match found for {} (hash: {})", unmanaged_mod.dll_name, file_hash);
            }
            
            // ハッシュでマッチしない場合は従来のファイル名ベースマッチング
            let potential_match = manifest_mods.iter().find(|manifest_mod| {
                // MOD名がファイル名に含まれているかチェック
                let mod_name_normalized = manifest_mod.name.to_lowercase().replace(" ", "").replace("-", "").replace("_", "");
                let file_name_normalized = unmanaged_mod.dll_name.to_lowercase().replace(" ", "").replace("-", "").replace("_", "");
                
                file_name_normalized.contains(&mod_name_normalized) || 
                mod_name_normalized.contains(&file_name_normalized) ||
                // より柔軟なマッチング
                manifest_mod.name.to_lowercase().split_whitespace().any(|word| 
                    file_name_normalized.contains(&word.to_lowercase())
                )
            });
            
            if let Some(matched_mod) = potential_match {
                unmanaged_mod.matched_mod_info = Some(matched_mod.clone());
            }
        }
        
        Ok(unmanaged_mods)
    }

    /// 未管理MODを管理システムに追加
    pub async fn add_unmanaged_mod_to_system(&self, unmanaged_mod: &UnmanagedMod) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        // 既に検出されたバージョンを使用、なければハッシュベースで検出
        let detected_version = if let Some(version) = &unmanaged_mod.detected_version {
            println!("Using pre-detected version for {}: {}", unmanaged_mod.dll_name, version);
            Some(version.clone())
        } else if let Some(hash) = &unmanaged_mod.calculated_sha256 {
            println!("No pre-detected version, trying hash lookup for {}", unmanaged_mod.dll_name);
            if let Some(hash_entry) = self.find_mod_by_hash(hash).await {
                println!("Hash lookup successful for {}: {}", unmanaged_mod.dll_name, hash_entry.version);
                Some(hash_entry.version)
            } else {
                println!("Hash lookup failed for {}", unmanaged_mod.dll_name);
                None
            }
        } else {
            println!("No hash available for {}", unmanaged_mod.dll_name);
            None
        };
        
        // ファイル形式とMODローダータイプを判定
        let file_format = if unmanaged_mod.file_path.extension().and_then(|ext| ext.to_str()) == Some("nupkg") {
            "nupkg"
        } else {
            "dll"
        };
        
        let mod_loader_type = if file_format == "nupkg" {
            "MonkeyLoader"
        } else if unmanaged_mod.file_path.to_string_lossy().contains("MonkeyLoader") && file_format == "nupkg" {
            "MonkeyLoader"
        } else {
            // DLLファイルはパスに関係なくResoniteModLoaderとして扱う（rml_modsフォルダに配置されるため）
            "ResoniteModLoader"
        };

        // InstallModの情報を構築
        let installed_mod = InstalledMod {
            name: unmanaged_mod.dll_name.clone(),
            description: unmanaged_mod.matched_mod_info
                .as_ref()
                .map(|info| info.description.clone())
                .unwrap_or_else(|| format!("手動で追加されたMOD: {}", unmanaged_mod.dll_name)),
            source_location: unmanaged_mod.matched_mod_info
                .as_ref()
                .map(|info| info.source_location.clone())
                .unwrap_or_else(|| format!("file://{}", unmanaged_mod.file_path.display())),
            installed_version: {
                let version = detected_version.unwrap_or_else(|| "unknown".to_string());
                println!("Final installed_version for {}: {}", unmanaged_mod.dll_name, version);
                version
            },
            installed_date: unmanaged_mod.modified_time.clone(),
            dll_path: unmanaged_mod.file_path.clone(),
            mod_loader_type: Some(mod_loader_type.to_string()),
            file_format: Some(file_format.to_string()),
            enabled: Some(true), // 未管理MODは有効と仮定
        };

        // インストール済みMOD一覧に追加
        self.add_to_installed_mods(&installed_mod)?;
        
        Ok(installed_mod)
    }

    /// 複数の未管理MODを一括で管理システムに追加
    pub async fn add_multiple_unmanaged_mods(&self, unmanaged_mods: &[UnmanagedMod]) -> Result<Vec<InstalledMod>, Box<dyn Error + Send + Sync>> {
        let mut added_mods = Vec::new();
        
        for unmanaged_mod in unmanaged_mods {
            match self.add_unmanaged_mod_to_system(unmanaged_mod).await {
                Ok(installed_mod) => added_mods.push(installed_mod),
                Err(e) => {
                    eprintln!("Failed to add mod {}: {}", unmanaged_mod.dll_name, e);
                    // エラーがあっても他のMODの処理を続行
                }
            }
        }
        
        Ok(added_mods)
    }

    /// MODを更新（バージョン変更）
    pub async fn update_mod(&self, mod_name: &str, target_version: &str) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        // 既存のMOD情報を取得
        let installed_mods = self.get_installed_mods()?;
        let existing_mod = installed_mods.iter()
            .find(|m| m.name == mod_name)
            .ok_or(format!("MOD '{}' is not installed", mod_name))?;
        
        // MODマニフェストから情報を取得
        let all_mods = self.fetch_mod_manifest().await?;
        let mod_info = all_mods.iter()
            .find(|m| m.name == mod_name || m.source_location == existing_mod.source_location)
            .ok_or(format!("MOD '{}' not found in manifest", mod_name))?;
        
        // ターゲットバージョンのリリース情報を取得してファイル形式を確認
        let target_release = mod_info.releases.iter()
            .find(|r| r.version == target_version)
            .ok_or(format!("Target version {} not found", target_version))?;
        
        // ファイル名から形式を判定
        let file_name = target_release.file_name.as_deref()
            .or_else(|| target_release.download_url.as_ref().and_then(|url| url.split('/').last()))
            .ok_or("Cannot determine file name for target version")?;
        
        // ターゲットバージョンのMODローダータイプを決定
        let target_mod_loader_type = if file_name.ends_with(".nupkg") {
            Some("MonkeyLoader")
        } else if file_name.ends_with(".dll") {
            Some("ResoniteModLoader")
        } else {
            None
        };
        
        println!("Updating {} from {} to {} (old format: {}, new format: {})", 
                mod_name, 
                existing_mod.installed_version,
                target_version,
                existing_mod.file_format.as_deref().unwrap_or("unknown"),
                if file_name.ends_with(".nupkg") { "nupkg" } else { "dll" });
        
        // 既存のMODをアンインストール
        self.uninstall_mod(mod_name)?;
        
        // 指定されたバージョンをインストール（適切なMODローダータイプを指定）
        self.install_mod_from_cache(mod_info, Some(target_version), target_mod_loader_type).await
    }

    /// MODのダウングレード
    pub async fn downgrade_mod(&self, mod_name: &str, target_version: &str) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        self.update_mod(mod_name, target_version).await
    }

    /// アップグレード可能なMODのリストを取得
    pub async fn get_upgradeable_mods(&self) -> Result<Vec<UpgradeableMod>, Box<dyn Error + Send + Sync>> {
        // インストール済みMODとマニフェストを取得
        let installed_mods = self.get_installed_mods()?;
        let all_mods = self.fetch_mod_manifest().await?;
        
        println!("DEBUG: get_upgradeable_mods called");
        println!("DEBUG: Found {} installed mods", installed_mods.len());
        println!("DEBUG: Found {} manifest mods", all_mods.len());
        
        let mut upgradeable_mods = Vec::new();
        
        for installed_mod in &installed_mods {
            // マニフェストから対応するMOD情報を探す
            let manifest_mod = all_mods.iter().find(|m| 
                m.name == installed_mod.name || m.source_location == installed_mod.source_location
            );
            
            if let Some(mod_info) = manifest_mod {
                if let Some(latest_version) = &mod_info.latest_version {
                    println!("DEBUG: Checking mod '{}': current='{}', latest='{}'", 
                             installed_mod.name, installed_mod.installed_version, latest_version);
                    
                    // バージョン比較（より新しいバージョンがあるか確認）
                    if latest_version != &installed_mod.installed_version {
                        println!("DEBUG: Found upgradeable mod: {} {} -> {}", 
                                 installed_mod.name, installed_mod.installed_version, latest_version);
                        upgradeable_mods.push(UpgradeableMod {
                            name: installed_mod.name.clone(),
                            current_version: installed_mod.installed_version.clone(),
                            latest_version: latest_version.clone(),
                            description: mod_info.description.clone(),
                            source_location: mod_info.source_location.clone(),
                        });
                    }
                }
            } else {
                println!("DEBUG: No manifest mod found for installed mod: {}", installed_mod.name);
            }
        }
        
        println!("DEBUG: Returning {} upgradeable mods", upgradeable_mods.len());
        Ok(upgradeable_mods)
    }

    /// アップデート可能なMODを一括でアップグレード
    pub async fn bulk_upgrade_mods(&self) -> Result<Vec<InstalledMod>, Box<dyn Error + Send + Sync>> {
        // インストール済みMODとマニフェストを取得
        let installed_mods = self.get_installed_mods()?;
        let all_mods = self.fetch_mod_manifest().await?;
        
        let mut upgraded_mods = Vec::new();
        let mut failed_upgrades = Vec::new();
        
        for installed_mod in &installed_mods {
            // マニフェストから対応するMOD情報を探す
            let manifest_mod = all_mods.iter().find(|m| 
                m.name == installed_mod.name || m.source_location == installed_mod.source_location
            );
            
            if let Some(mod_info) = manifest_mod {
                if let Some(latest_version) = &mod_info.latest_version {
                    // バージョン比較（簡易的にstring比較、より新しいバージョンがあるか確認）
                    if latest_version != &installed_mod.installed_version {
                        println!("Upgrading {} from {} to {}", 
                                installed_mod.name, 
                                installed_mod.installed_version, 
                                latest_version);
                        
                        match self.upgrade_mod(&installed_mod.name, Some(latest_version)).await {
                            Ok(upgraded_mod) => {
                                upgraded_mods.push(upgraded_mod);
                                println!("Successfully upgraded {}", installed_mod.name);
                            }
                            Err(e) => {
                                let error_msg = format!("Failed to upgrade {}: {}", installed_mod.name, e);
                                eprintln!("{}", error_msg);
                                failed_upgrades.push(error_msg);
                            }
                        }
                    } else {
                        println!("{} is already up to date ({})", installed_mod.name, latest_version);
                    }
                } else {
                    println!("No latest version available for {}", installed_mod.name);
                }
            } else {
                println!("MOD {} not found in manifest, skipping", installed_mod.name);
            }
        }
        
        if !failed_upgrades.is_empty() {
            println!("Failed upgrades: {}", failed_upgrades.join(", "));
        }
        
        println!("Bulk upgrade completed: {} upgraded, {} failed", 
                upgraded_mods.len(), 
                failed_upgrades.len());
        
        Ok(upgraded_mods)
    }

    /// MODのアップグレード
    pub async fn upgrade_mod(&self, mod_name: &str, target_version: Option<&str>) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        // 既存のMOD情報を取得
        let installed_mods = self.get_installed_mods()?;
        let existing_mod = installed_mods.iter()
            .find(|m| m.name == mod_name)
            .ok_or(format!("MOD '{}' is not installed", mod_name))?;
        
        // MODマニフェストから情報を取得
        let all_mods = self.fetch_mod_manifest().await?;
        let mod_info = all_mods.iter()
            .find(|m| m.name == mod_name || m.source_location == existing_mod.source_location)
            .ok_or(format!("MOD '{}' not found in manifest", mod_name))?;
        
        // ターゲットバージョンを決定（指定されない場合は最新）
        let upgrade_version = if let Some(version) = target_version {
            version
        } else {
            mod_info.latest_version.as_deref()
                .ok_or("No latest version available")?
        };
        
        // 新しいバージョンのリリース情報を取得してファイル形式を確認
        let target_release = mod_info.releases.iter()
            .find(|r| r.version == upgrade_version)
            .ok_or(format!("Target version {} not found", upgrade_version))?;
        
        // ファイル名から形式を判定
        let file_name = target_release.file_name.as_deref()
            .or_else(|| target_release.download_url.as_ref().and_then(|url| url.split('/').last()))
            .ok_or("Cannot determine file name for target version")?;
        
        // 新しいバージョンのMODローダータイプを決定
        let new_mod_loader_type = if file_name.ends_with(".nupkg") {
            Some("MonkeyLoader")
        } else if file_name.ends_with(".dll") {
            Some("ResoniteModLoader")
        } else {
            None
        };
        
        println!("Upgrading {} from {} to {} (old format: {}, new format: {})", 
                mod_name, 
                existing_mod.installed_version,
                upgrade_version,
                existing_mod.file_format.as_deref().unwrap_or("unknown"),
                if file_name.ends_with(".nupkg") { "nupkg" } else { "dll" });
        
        // 既存のMODをアンインストール
        self.uninstall_mod(mod_name)?;
        
        // 新しいバージョンをインストール（適切なMODローダータイプを指定）
        self.install_mod_from_cache(mod_info, Some(upgrade_version), new_mod_loader_type).await
    }

    /// MODをアンインストール
    pub fn uninstall_mod(&self, mod_name: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut installed_mods = self.get_installed_mods()?;
        
        if let Some(pos) = installed_mods.iter().position(|m| m.name == mod_name) {
            let mod_to_remove = installed_mods.remove(pos);
            
            // DLLファイルを削除
            if mod_to_remove.dll_path.exists() {
                fs::remove_file(&mod_to_remove.dll_path)?;
            }
            
            // インストール済みMOD一覧を更新
            self.save_installed_mods(&installed_mods)?;
        }
        
        Ok(())
    }

    /// MODを無効化（拡張子を.disabledに変更）
    pub fn disable_mod(&self, mod_name: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut installed_mods = self.get_installed_mods()?;
        
        if let Some(mod_info) = installed_mods.iter_mut().find(|m| m.name == mod_name) {
            let current_path = &mod_info.dll_path;
            
            // 既に無効化されているかチェック
            if current_path.extension().and_then(|ext| ext.to_str()) == Some("disabled") {
                return Err("MOD is already disabled".into());
            }
            
            // 現在のパスに.disabledを追加
            let current_path_str = current_path.to_string_lossy();
            let disabled_path_str = format!("{}.disabled", current_path_str);
            let disabled_path = PathBuf::from(disabled_path_str);
            
            // ファイルをリネーム
            if current_path.exists() {
                fs::rename(current_path, &disabled_path)?;
            }
            
            // パスと状態を更新
            mod_info.dll_path = disabled_path;
            mod_info.enabled = Some(false);
            
            // インストール済みMOD一覧を更新
            self.save_installed_mods(&installed_mods)?;
        } else {
            return Err(format!("MOD '{}' not found", mod_name).into());
        }
        
        Ok(())
    }

    /// MODを有効化（.disabled拡張子を削除）
    pub fn enable_mod(&self, mod_name: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut installed_mods = self.get_installed_mods()?;
        
        if let Some(mod_info) = installed_mods.iter_mut().find(|m| m.name == mod_name) {
            let current_path = &mod_info.dll_path;
            
            // 無効化されているかチェック
            if current_path.extension().and_then(|ext| ext.to_str()) != Some("disabled") {
                return Err("MOD is already enabled".into());
            }
            
            // .disabledを削除した元のパスを復元
            let current_path_str = current_path.to_string_lossy();
            let enabled_path_str = if current_path_str.ends_with(".disabled") {
                // .disabledを単純に削除
                current_path_str.strip_suffix(".disabled").unwrap().to_string()
            } else {
                return Err("Invalid disabled file format".into());
            };
            
            let enabled_path = PathBuf::from(enabled_path_str);
            
            // ファイルをリネーム
            if current_path.exists() {
                fs::rename(current_path, &enabled_path)?;
            }
            
            // パスと状態を更新
            mod_info.dll_path = enabled_path;
            mod_info.enabled = Some(true);
            
            // インストール済みMOD一覧を更新
            self.save_installed_mods(&installed_mods)?;
        } else {
            return Err(format!("MOD '{}' not found", mod_name).into());
        }
        
        Ok(())
    }

    /// 手動でGitHubリポジトリURLを解析
    fn github_repo_to_api_url(&self, repo_url: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
        let url = repo_url.trim_end_matches('/');
        
        if let Some(captures) = regex::Regex::new(r"github\.com/([^/]+)/([^/]+)")?.captures(url) {
            let owner = captures.get(1).unwrap().as_str();
            let repo = captures.get(2).unwrap().as_str();
            Ok(format!("https://api.github.com/repos/{}/{}", owner, repo))
        } else {
            Err("Invalid GitHub repository URL".into())
        }
    }

    /// インストール済みMOD一覧に追加
    fn add_to_installed_mods(&self, new_mod: &InstalledMod) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut installed_mods = self.get_installed_mods()?;
        
        // 同じ名前のMODがある場合は更新
        if let Some(pos) = installed_mods.iter().position(|m| m.name == new_mod.name) {
            installed_mods[pos] = new_mod.clone();
        } else {
            installed_mods.push(new_mod.clone());
        }
        
        self.save_installed_mods(&installed_mods)
    }

    /// インストール済みMOD一覧を保存
    fn save_installed_mods(&self, mods: &[InstalledMod]) -> Result<(), Box<dyn Error + Send + Sync>> {
        let content = serde_json::to_string_pretty(mods)?;
        fs::write(&self.installed_mods_file, content)?;
        Ok(())
    }
    
    /// ファイルのSHA256ハッシュを計算
    pub fn calculate_file_sha256(&self, file_path: &std::path::Path) -> Result<String, Box<dyn Error + Send + Sync>> {
        let file_content = fs::read(file_path)?;
        let mut hasher = Sha256::new();
        hasher.update(&file_content);
        let hash = hasher.finalize();
        Ok(format!("{:x}", hash))
    }
    
    /// ハッシュルックアップテーブルを取得
    pub async fn fetch_hash_lookup_table(&self) -> Result<HashMap<String, HashLookupEntry>, Box<dyn Error + Send + Sync>> {
        let cache_url = "https://raw.githubusercontent.com/resonite-love/resonite-mod-cache/master/cache/hash-lookup.json";
        
        let response = self.client.get(cache_url).send().await?;
        let lookup_text = response.text().await?;
        let lookup_table: HashMap<String, HashLookupEntry> = serde_json::from_str(&lookup_text)?;
        
        Ok(lookup_table)
    }
    
    /// SHA256ハッシュから対応するMOD情報を検索
    pub async fn find_mod_by_hash(&self, hash: &str) -> Option<HashLookupEntry> {
        match self.fetch_hash_lookup_table().await {
            Ok(lookup_table) => {
                println!("Hash lookup table fetched successfully, {} entries", lookup_table.len());
                match lookup_table.get(hash) {
                    Some(entry) => {
                        println!("Found hash match for {}: {}", hash, entry.mod_name);
                        Some(entry.clone())
                    }
                    None => {
                        println!("Hash {} not found in lookup table", hash);
                        None
                    }
                }
            }
            Err(e) => {
                println!("Failed to fetch hash lookup table: {}", e);
                None
            }
        }
    }
    
    /// 未管理MODのバージョンをハッシュベースで検出
    pub async fn detect_mod_version_by_hash(&self, unmanaged_mod: &UnmanagedMod) -> Option<String> {
        if let Some(hash) = &unmanaged_mod.calculated_sha256 {
            if let Some(hash_entry) = self.find_mod_by_hash(hash).await {
                return Some(hash_entry.version);
            }
        }
        None
    }
}