use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::fs;
use reqwest;

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
    pub tags: Option<Vec<String>>,
    pub flags: Option<Vec<String>>,
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

    /// MODマニフェストからMOD一覧を取得
    pub async fn fetch_mod_manifest(&self) -> Result<Vec<ModInfo>, Box<dyn Error + Send + Sync>> {
        let manifest_url = "https://raw.githubusercontent.com/resonite-modding-group/resonite-mod-manifest/main/manifest.json";
        
        let response = self.client.get(manifest_url).send().await?;
        let manifest_text = response.text().await?;
        let manifest: ModManifest = serde_json::from_str(&manifest_text)?;
        
        let mut mods = Vec::new();
        
        for (author_key, author_entry) in manifest.objects {
            // authorマップから最初の作者情報を取得
            let author_name = author_entry.author.keys().next()
                .unwrap_or(&author_key)
                .clone();
                
            for (mod_key, mod_entry) in author_entry.entries {
                // GitHubリポジトリから最新リリース情報を取得
                let (latest_version, latest_download_url) = self.get_latest_release_info(&mod_entry.source_location).await
                    .unwrap_or((None, None));
                
                mods.push(ModInfo {
                    name: mod_entry.name,
                    description: mod_entry.description,
                    category: Some(mod_entry.category),
                    source_location: mod_entry.source_location,
                    author: author_name.clone(),
                    latest_version,
                    latest_download_url,
                    tags: mod_entry.tags,
                    flags: mod_entry.flags,
                });
            }
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

    /// GitHubリポジトリからMODをインストール
    pub async fn install_mod_from_github(&self, repo_url: &str, version: Option<&str>) -> Result<InstalledMod, Box<dyn Error + Send + Sync>> {
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
        
        // .dllファイルを探す
        let dll_asset = release.assets.iter()
            .find(|asset| asset.name.ends_with(".dll"))
            .ok_or("No DLL file found in release")?;
        
        // MODsディレクトリを作成
        fs::create_dir_all(&self.mods_dir)?;
        
        // ファイルをダウンロード
        let dll_response = self.client.get(&dll_asset.browser_download_url).send().await?;
        let dll_content = dll_response.bytes().await?;
        
        let dll_path = self.mods_dir.join(&dll_asset.name);
        fs::write(&dll_path, dll_content)?;
        
        let installed_mod = InstalledMod {
            name: dll_asset.name.trim_end_matches(".dll").to_string(),
            description: release.body.unwrap_or_default(),
            source_location: repo_url.to_string(),
            installed_version: release.tag_name,
            installed_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            dll_path,
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
}