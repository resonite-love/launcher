use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

/// Thunderstoreパッケージ情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThunderstorePackage {
    pub name: String,
    pub full_name: String,
    pub owner: String,
    pub package_url: String,
    pub date_created: String,
    pub date_updated: String,
    pub uuid4: String,
    pub rating_score: i32,
    pub is_pinned: bool,
    pub is_deprecated: bool,
    pub has_nsfw_content: bool,
    pub categories: Vec<String>,
    pub versions: Vec<ThunderstoreVersion>,
}

/// Thunderstoreパッケージバージョン情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThunderstoreVersion {
    pub name: String,
    pub full_name: String,
    pub version_number: String,
    pub uuid4: String,
    pub description: String,
    pub icon: String,
    pub download_url: String,
    pub downloads: i64,
    pub file_size: i64,
    pub date_created: String,
    pub website_url: String,
    pub is_active: bool,
    pub dependencies: Vec<String>,
}

/// Thunderstoreカテゴリ情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThunderstoreCategory {
    pub name: String,
    pub slug: String,
}

/// キャッシュメタデータ
#[derive(Debug, Serialize, Deserialize)]
struct CacheMetadata {
    timestamp: u64,
}

/// Thunderstore APIクライアント
pub struct ThunderstoreClient {
    base_url: String,
    client: reqwest::Client,
    cache_dir: PathBuf,
}

impl ThunderstoreClient {
    /// 新しいThunderstoreClientを作成
    pub fn new(cache_dir: PathBuf) -> Self {
        ThunderstoreClient {
            base_url: "https://thunderstore.io/c/resonite/api/v1".to_string(),
            client: reqwest::Client::new(),
            cache_dir,
        }
    }

    /// パッケージ一覧を取得
    pub async fn fetch_packages(&self) -> Result<Vec<ThunderstorePackage>, Box<dyn Error + Send + Sync>> {
        let cache_file = self.cache_dir.join("thunderstore_packages.json");
        let cache_meta_file = self.cache_dir.join("thunderstore_packages_meta.json");

        // キャッシュの有効期限（15分）
        let cache_duration = Duration::from_secs(15 * 60);

        // キャッシュ確認
        if let Ok(meta_content) = fs::read_to_string(&cache_meta_file) {
            if let Ok(meta) = serde_json::from_str::<CacheMetadata>(&meta_content) {
                let cache_timestamp = std::time::UNIX_EPOCH + Duration::from_secs(meta.timestamp);
                let now = std::time::SystemTime::now();

                if let Ok(elapsed) = now.duration_since(cache_timestamp) {
                    if elapsed < cache_duration {
                        if let Ok(cache_content) = fs::read_to_string(&cache_file) {
                            if let Ok(packages) = serde_json::from_str::<Vec<ThunderstorePackage>>(&cache_content) {
                                println!("Using cached Thunderstore packages (age: {}s)", elapsed.as_secs());
                                return Ok(packages);
                            }
                        }
                    }
                }
            }
        }

        // APIから取得
        println!("Fetching Thunderstore packages from API...");
        let url = format!("{}/package/", self.base_url);

        let response = self.client
            .get(&url)
            .header("User-Agent", "RESO-Launcher")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Thunderstore API request failed: {}", response.status()).into());
        }

        let packages_text = response.text().await?;
        let packages: Vec<ThunderstorePackage> = serde_json::from_str(&packages_text)?;

        // キャッシュに保存
        fs::create_dir_all(&self.cache_dir)?;

        if let Err(e) = fs::write(&cache_file, &packages_text) {
            eprintln!("Failed to write Thunderstore cache: {}", e);
        }

        let now_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let meta = CacheMetadata { timestamp: now_timestamp };
        if let Err(e) = fs::write(&cache_meta_file, serde_json::to_string(&meta).unwrap_or_default()) {
            eprintln!("Failed to write Thunderstore cache metadata: {}", e);
        }

        Ok(packages)
    }

    /// 特定のパッケージを取得
    pub async fn fetch_package(&self, uuid: &str) -> Result<ThunderstorePackage, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/package/{}/", self.base_url, uuid);

        let response = self.client
            .get(&url)
            .header("User-Agent", "RESO-Launcher")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Thunderstore API request failed: {}", response.status()).into());
        }

        let package: ThunderstorePackage = response.json().await?;
        Ok(package)
    }

    /// カテゴリ一覧を取得
    pub async fn fetch_categories(&self) -> Result<Vec<ThunderstoreCategory>, Box<dyn Error + Send + Sync>> {
        let url = "https://thunderstore.io/api/experimental/community/resonite/category/";

        let response = self.client
            .get(url)
            .header("User-Agent", "RESO-Launcher")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Thunderstore API request failed: {}", response.status()).into());
        }

        let categories: Vec<ThunderstoreCategory> = response.json().await?;
        Ok(categories)
    }

    /// パッケージをフルネームで検索
    pub async fn find_package_by_full_name(&self, full_name: &str) -> Result<Option<ThunderstorePackage>, Box<dyn Error + Send + Sync>> {
        let packages = self.fetch_packages().await?;
        Ok(packages.into_iter().find(|p| p.full_name == full_name))
    }

    /// パッケージをダウンロード
    pub async fn download_package(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
        dest_dir: &PathBuf,
    ) -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
        // バージョンを決定
        let target_version = if let Some(v) = version {
            package.versions.iter()
                .find(|ver| ver.version_number == v)
                .ok_or(format!("Version {} not found", v))?
        } else {
            package.versions.first()
                .ok_or("No versions available")?
        };

        // ダウンロードURLからZIPを取得
        let response = self.client
            .get(&target_version.download_url)
            .header("User-Agent", "RESO-Launcher")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to download package: {}", response.status()).into());
        }

        let bytes = response.bytes().await?;

        // 一時ファイルに保存
        let zip_path = dest_dir.join(format!("{}.zip", target_version.full_name));
        fs::create_dir_all(dest_dir)?;
        fs::write(&zip_path, &bytes)?;

        Ok(zip_path)
    }

    /// パッケージを展開してインストール
    pub async fn install_package(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
        plugins_dir: &PathBuf,
    ) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        // ダウンロード
        let temp_dir = self.cache_dir.join("temp");
        let zip_path = self.download_package(package, version, &temp_dir).await?;

        // ZIPを展開
        let extracted_files = self.extract_package(&zip_path, plugins_dir)?;

        // 一時ファイルを削除
        let _ = fs::remove_file(&zip_path);

        Ok(extracted_files)
    }

    /// ZIPパッケージを展開
    fn extract_package(&self, zip_path: &PathBuf, dest_dir: &PathBuf) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        use std::io::Read;

        let file = fs::File::open(zip_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        let mut extracted_files = Vec::new();

        fs::create_dir_all(dest_dir)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_name = file.name().to_string();

            // plugins/ フォルダ内のファイルのみ抽出（または.dllファイル）
            if file_name.starts_with("plugins/") || file_name.ends_with(".dll") {
                let dest_name = if file_name.starts_with("plugins/") {
                    file_name.strip_prefix("plugins/").unwrap_or(&file_name)
                } else {
                    &file_name
                };

                if dest_name.is_empty() || file.is_dir() {
                    continue;
                }

                let dest_path = dest_dir.join(dest_name);

                // 親ディレクトリを作成
                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                let mut contents = Vec::new();
                file.read_to_end(&mut contents)?;
                fs::write(&dest_path, contents)?;

                extracted_files.push(dest_path);
            }
        }

        Ok(extracted_files)
    }

    /// 依存関係を解決
    pub async fn resolve_dependencies(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
    ) -> Result<Vec<ThunderstorePackage>, Box<dyn Error + Send + Sync>> {
        let all_packages = self.fetch_packages().await?;
        let packages_map: HashMap<String, ThunderstorePackage> = all_packages
            .into_iter()
            .map(|p| (p.full_name.clone(), p))
            .collect();

        let target_version = if let Some(v) = version {
            package.versions.iter()
                .find(|ver| ver.version_number == v)
                .ok_or(format!("Version {} not found", v))?
        } else {
            package.versions.first()
                .ok_or("No versions available")?
        };

        let mut resolved = Vec::new();
        let mut visited = std::collections::HashSet::new();

        self.resolve_deps_recursive(
            &target_version.dependencies,
            &packages_map,
            &mut resolved,
            &mut visited,
        )?;

        Ok(resolved)
    }

    fn resolve_deps_recursive(
        &self,
        dependencies: &[String],
        packages_map: &HashMap<String, ThunderstorePackage>,
        resolved: &mut Vec<ThunderstorePackage>,
        visited: &mut std::collections::HashSet<String>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        for dep_str in dependencies {
            // 依存関係形式: "Owner-PackageName-Version"
            let parts: Vec<&str> = dep_str.rsplitn(2, '-').collect();
            if parts.len() < 2 {
                continue;
            }

            let _version = parts[0];
            let full_name_without_version = parts[1];

            if visited.contains(full_name_without_version) {
                continue;
            }
            visited.insert(full_name_without_version.to_string());

            if let Some(pkg) = packages_map.get(full_name_without_version) {
                // 再帰的に依存関係を解決
                if let Some(latest) = pkg.versions.first() {
                    self.resolve_deps_recursive(
                        &latest.dependencies,
                        packages_map,
                        resolved,
                        visited,
                    )?;
                }
                resolved.push(pkg.clone());
            }
        }

        Ok(())
    }

    /// BepisLoader関連パッケージを取得
    pub async fn get_bepis_loader_package(&self) -> Result<Option<ThunderstorePackage>, Box<dyn Error + Send + Sync>> {
        self.find_package_by_full_name("ResoniteModding-BepisLoader").await
    }

    /// MOD（Libraries以外）のパッケージ一覧を取得
    pub async fn get_mod_packages(&self) -> Result<Vec<ThunderstorePackage>, Box<dyn Error + Send + Sync>> {
        let packages = self.fetch_packages().await?;
        Ok(packages.into_iter()
            .filter(|p| !p.is_deprecated)
            .filter(|p| !p.categories.contains(&"Libraries".to_string()))
            .collect())
    }

    /// キャッシュをクリア
    pub fn clear_cache(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let cache_file = self.cache_dir.join("thunderstore_packages.json");
        let cache_meta_file = self.cache_dir.join("thunderstore_packages_meta.json");

        if cache_file.exists() {
            fs::remove_file(&cache_file)?;
        }
        if cache_meta_file.exists() {
            fs::remove_file(&cache_meta_file)?;
        }

        Ok(())
    }
}
