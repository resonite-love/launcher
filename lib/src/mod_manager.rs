use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::fs;
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
    pub file_format: Option<String>, // "dll" or "nsis"
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
    pub mod_source: String,
    pub version: String,
    pub file_name: String,
    pub file_size: Option<u64>,
    pub published_at: String,
    pub download_url: Option<String>,
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
        // キャッシュされたMOD情報を取得
        let cache_url = "https://raw.githubusercontent.com/resonite-love/resonite-mod-cache/refs/heads/master/cache/mods.json";
        
        let response = self.client.get(cache_url).send().await?;
        let mods_text = response.text().await?;
        let mods: Vec<ModInfo> = serde_json::from_str(&mods_text)?;
        
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
                ("dll", self.profile_dir.join("Game").join("MonkeyLoader").join("Mods"))
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
        };
        
        // インストール済みMOD一覧に追加
        self.add_to_installed_mods(&installed_mod)?;
        
        Ok(installed_mod)
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
                let monkey_mods_dir = self.profile_dir.join("Game").join("MonkeyLoader").join("Mods");
                (dll_asset, "dll", monkey_mods_dir)
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
        let mods: Vec<InstalledMod> = serde_json::from_str(&content)?;
        
        // ファイルが実際に存在するもののみ返す
        Ok(mods.into_iter()
            .filter(|mod_info| mod_info.dll_path.exists())
            .collect())
    }

    /// rml_modsフォルダをスキャンして全MODファイルを検出
    pub fn scan_mod_folder(&self) -> Result<Vec<UnmanagedMod>, Box<dyn Error + Send + Sync>> {
        if !self.mods_dir.exists() {
            return Ok(Vec::new());
        }

        let mut unmanaged_mods = Vec::new();
        let known_mods = self.get_installed_mods().unwrap_or_default();
        
        // rml_modsフォルダ内の全.dllファイルを取得
        for entry in fs::read_dir(&self.mods_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() && path.extension().map_or(false, |ext| ext == "dll") {
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
                    
                    unmanaged_mods.push(UnmanagedMod {
                        file_name: file_name.clone(),
                        file_path: path,
                        file_size,
                        modified_time,
                        dll_name: file_name.trim_end_matches(".dll").to_string(),
                        matched_mod_info: None, // 後でマッチングを行う
                        calculated_sha256: None, // 後でハッシュを計算
                        detected_version: None, // 後でバージョンを検出
                    });
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
                
                // 対応するMOD情報を探す
                let matched_mod = manifest_mods.iter().find(|manifest_mod| {
                    manifest_mod.source_location == hash_entry.mod_source
                });
                
                if let Some(matched_mod) = matched_mod {
                    unmanaged_mod.matched_mod_info = Some(matched_mod.clone());
                    continue;
                }
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
        // ハッシュベースでバージョンを検出
        let detected_version = if let Some(hash) = &unmanaged_mod.calculated_sha256 {
            if let Some(hash_entry) = self.find_mod_by_hash(hash).await {
                Some(hash_entry.version)
            } else {
                None
            }
        } else {
            None
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
            installed_version: detected_version.unwrap_or_else(|| "unknown".to_string()),
            installed_date: unmanaged_mod.modified_time.clone(),
            dll_path: unmanaged_mod.file_path.clone(),
            mod_loader_type: Some("ResoniteModLoader".to_string()), // 未管理MODはRMLと仮定
            file_format: Some("dll".to_string()),
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
        
        // 既存のMODをアンインストール
        self.uninstall_mod(mod_name)?;
        
        // 指定されたバージョンをインストール
        self.install_mod_from_cache(mod_info, Some(target_version), None).await
    }

    /// MODのダウングレード
    pub async fn downgrade_mod(&self, mod_name: &str, target_version: &str) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
        self.update_mod(mod_name, target_version).await
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
        
        // 既存のMODをアンインストール
        self.uninstall_mod(mod_name)?;
        
        // 新しいバージョンをインストール
        self.install_mod_from_cache(mod_info, Some(upgrade_version), None).await
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
    pub async fn fetch_hash_lookup_table(&self) -> Result<HashMap<String, Vec<HashLookupEntry>>, Box<dyn Error + Send + Sync>> {
        let cache_url = "https://raw.githubusercontent.com/resonite-love/resonite-mod-cache/refs/heads/master/cache/hash-lookup.json";
        
        let response = self.client.get(cache_url).send().await?;
        let lookup_text = response.text().await?;
        let lookup_table: HashMap<String, Vec<HashLookupEntry>> = serde_json::from_str(&lookup_text)?;
        
        Ok(lookup_table)
    }
    
    /// SHA256ハッシュから対応するMOD情報を検索
    pub async fn find_mod_by_hash(&self, hash: &str) -> Option<HashLookupEntry> {
        match self.fetch_hash_lookup_table().await {
            Ok(lookup_table) => {
                lookup_table.get(hash)
                    .and_then(|entries| entries.first())
                    .cloned()
            }
            Err(_) => None
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