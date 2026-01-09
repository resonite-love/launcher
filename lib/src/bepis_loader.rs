use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

use crate::thunderstore::{ThunderstoreClient, ThunderstorePackage};

/// BepisLoaderのステータス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BepisLoaderStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub hookfxr_enabled: bool,
    pub plugins_dir: PathBuf,
    pub plugins_count: usize,
}

/// BepisLoaderインストール情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BepisLoaderInfo {
    pub version: String,
    pub install_date: String,
    pub package_full_name: String,
}

/// BepisLoaderでインストールしたMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledBepisMod {
    pub name: String,
    pub full_name: String,
    pub description: String,
    pub version: String,
    pub install_date: String,
    pub installed_files: Vec<PathBuf>,
    pub is_dependency: bool,
}

/// インストール済みMODリスト
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct InstalledBepisModList {
    pub mods: Vec<InstalledBepisMod>,
}

/// BepisLoader管理
pub struct BepisLoader {
    game_dir: PathBuf,
    profile_dir: PathBuf,
    thunderstore: ThunderstoreClient,
}

impl BepisLoader {
    /// 新しいBepisLoaderを作成
    pub fn new(profile_dir: PathBuf) -> Self {
        let game_dir = profile_dir.join("Game");
        let cache_dir = profile_dir.clone();

        BepisLoader {
            game_dir,
            profile_dir,
            thunderstore: ThunderstoreClient::new(cache_dir),
        }
    }

    /// BepInEx/pluginsディレクトリのパスを取得
    pub fn get_plugins_dir(&self) -> PathBuf {
        self.game_dir.join("BepInEx").join("plugins")
    }

    /// hookfxr.iniのパスを取得
    fn get_hookfxr_ini_path(&self) -> PathBuf {
        self.game_dir.join("hookfxr.ini")
    }

    /// BepisLoader情報ファイルのパスを取得
    fn get_info_file_path(&self) -> PathBuf {
        self.profile_dir.join("bepisloader_info.json")
    }

    /// インストール済みMODリストファイルのパスを取得
    fn get_installed_mods_file_path(&self) -> PathBuf {
        self.profile_dir.join("bepis_installed_mods.json")
    }

    /// インストール済みMODリストを読み込む
    fn load_installed_mods_list(&self) -> InstalledBepisModList {
        let file_path = self.get_installed_mods_file_path();
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                if let Ok(list) = serde_json::from_str(&content) {
                    return list;
                }
            }
        }
        InstalledBepisModList::default()
    }

    /// インストール済みMODリストを保存する
    fn save_installed_mods_list(&self, list: &InstalledBepisModList) -> Result<(), Box<dyn Error + Send + Sync>> {
        let file_path = self.get_installed_mods_file_path();
        let content = serde_json::to_string_pretty(list)?;
        fs::write(&file_path, content)?;
        Ok(())
    }

    /// BepisLoaderのステータスを取得
    pub fn get_status(&self) -> BepisLoaderStatus {
        let info_file = self.get_info_file_path();
        let installed = info_file.exists();

        let version = if installed {
            self.get_installed_info()
                .map(|info| info.version)
                .ok()
        } else {
            None
        };

        let hookfxr_enabled = self.is_hookfxr_enabled();
        let plugins_dir = self.get_plugins_dir();
        let plugins_count = self.count_plugins();

        BepisLoaderStatus {
            installed,
            version,
            hookfxr_enabled,
            plugins_dir,
            plugins_count,
        }
    }

    /// インストール済み情報を取得
    pub fn get_installed_info(&self) -> Result<BepisLoaderInfo, Box<dyn Error + Send + Sync>> {
        let info_file = self.get_info_file_path();
        let content = fs::read_to_string(&info_file)?;
        let info: BepisLoaderInfo = serde_json::from_str(&content)?;
        Ok(info)
    }

    /// hookfxr.iniが有効かチェック
    fn is_hookfxr_enabled(&self) -> bool {
        let ini_path = self.get_hookfxr_ini_path();
        if let Ok(content) = fs::read_to_string(&ini_path) {
            content.lines().any(|line| {
                let trimmed = line.trim().to_lowercase();
                trimmed.starts_with("enable") && trimmed.contains("true")
            })
        } else {
            false
        }
    }

    /// プラグイン数をカウント
    fn count_plugins(&self) -> usize {
        let plugins_dir = self.get_plugins_dir();
        if !plugins_dir.exists() {
            return 0;
        }

        fs::read_dir(&plugins_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path().extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext == "dll")
                            .unwrap_or(false)
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    /// BepisLoaderをインストール
    pub async fn install(&self) -> Result<BepisLoaderInfo, Box<dyn Error + Send + Sync>> {
        // Thunderstoreからパッケージを取得
        let package = self.thunderstore
            .get_bepis_loader_package()
            .await?
            .ok_or("BepisLoader package not found on Thunderstore")?;

        self.install_from_package(&package, None).await
    }

    /// 特定バージョンをインストール
    pub async fn install_version(&self, version: &str) -> Result<BepisLoaderInfo, Box<dyn Error + Send + Sync>> {
        let package = self.thunderstore
            .get_bepis_loader_package()
            .await?
            .ok_or("BepisLoader package not found on Thunderstore")?;

        self.install_from_package(&package, Some(version)).await
    }

    /// パッケージからインストール
    async fn install_from_package(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
    ) -> Result<BepisLoaderInfo, Box<dyn Error + Send + Sync>> {
        // 依存関係を解決してインストール
        let dependencies = self.thunderstore.resolve_dependencies(package, version).await?;

        for dep in &dependencies {
            println!("Installing dependency: {}", dep.full_name);
            self.install_thunderstore_package(dep, None).await?;
        }

        // BepisLoader本体をインストール
        println!("Installing BepisLoader: {}", package.full_name);
        self.install_thunderstore_package(package, version).await?;

        // hookfxr.iniは設定しない（起動引数--hookfxr-enableで制御）

        // バージョン情報を取得
        let installed_version = if let Some(v) = version {
            v.to_string()
        } else {
            package.versions.first()
                .map(|v| v.version_number.clone())
                .unwrap_or_else(|| "unknown".to_string())
        };

        // インストール情報を保存
        let info = BepisLoaderInfo {
            version: installed_version,
            install_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            package_full_name: package.full_name.clone(),
        };

        self.save_info(&info)?;

        Ok(info)
    }

    /// Thunderstoreパッケージをインストール
    async fn install_thunderstore_package(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
    ) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        // ダウンロード
        let temp_dir = self.profile_dir.join("temp");
        let zip_path = self.thunderstore
            .download_package(package, version, &temp_dir)
            .await?;

        // 展開先を決定
        let extracted_files = self.extract_bepisloader_package(&zip_path)?;

        // 一時ファイルを削除
        let _ = fs::remove_file(&zip_path);
        let _ = fs::remove_dir_all(&temp_dir);

        Ok(extracted_files)
    }

    /// BepisLoaderパッケージを展開
    fn extract_bepisloader_package(&self, zip_path: &PathBuf) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        let file = fs::File::open(zip_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        let mut extracted_files = Vec::new();

        // ディレクトリを作成
        fs::create_dir_all(&self.game_dir)?;
        fs::create_dir_all(self.get_plugins_dir())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_name = file.name().to_string();

            if file.is_dir() {
                continue;
            }

            // ファイルの配置先を決定
            let dest_path = self.determine_file_destination(&file_name)?;

            if let Some(dest) = dest_path {
                // 親ディレクトリを作成
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }

                let mut contents = Vec::new();
                file.read_to_end(&mut contents)?;
                fs::write(&dest, contents)?;

                println!("Extracted: {} -> {}", file_name, dest.display());
                extracted_files.push(dest);
            }
        }

        Ok(extracted_files)
    }

    /// ファイルの配置先を決定
    fn determine_file_destination(&self, file_name: &str) -> Result<Option<PathBuf>, Box<dyn Error + Send + Sync>> {
        // BepInExPack/ プレフィックスを除去（Thunderstoreパッケージ形式）
        let normalized_path = file_name
            .strip_prefix("BepInExPack/")
            .unwrap_or(file_name);

        // BepisLoader関連ファイル（ルートに配置）
        let root_files = [
            "BepisLoader.dll",
            "BepisLoader.deps.json",
            "BepisLoader.runtimeconfig.json",
            "hostfxr.dll",
            "hookfxr.ini",
        ];

        let file_base = normalized_path.rsplit('/').next().unwrap_or(normalized_path);

        // ルートファイルの場合
        for root_file in &root_files {
            if file_base == *root_file {
                return Ok(Some(self.game_dir.join(root_file)));
            }
        }

        // BepInExフォルダ構成の場合
        if normalized_path.starts_with("BepInEx/") {
            let relative_path = normalized_path.strip_prefix("BepInEx/").unwrap_or(normalized_path);
            if !relative_path.is_empty() {
                return Ok(Some(self.game_dir.join("BepInEx").join(relative_path)));
            }
        }

        // Rendererフォルダの場合
        if normalized_path.starts_with("Renderer/") {
            let relative_path = normalized_path.strip_prefix("Renderer/").unwrap_or(normalized_path);
            if !relative_path.is_empty() {
                return Ok(Some(self.game_dir.join("Renderer").join(relative_path)));
            }
        }

        // plugins/フォルダの場合
        if normalized_path.starts_with("plugins/") {
            let relative_path = normalized_path.strip_prefix("plugins/").unwrap_or(normalized_path);
            if !relative_path.is_empty() {
                return Ok(Some(self.get_plugins_dir().join(relative_path)));
            }
        }

        // icon.png, README.md, CHANGELOG.md, manifest.json はスキップ
        let skip_files = ["icon.png", "README.md", "CHANGELOG.md", "manifest.json"];
        if skip_files.iter().any(|&f| file_base == f) {
            return Ok(None);
        }

        // .dllファイルはpluginsに配置
        if file_base.ends_with(".dll") {
            return Ok(Some(self.get_plugins_dir().join(file_base)));
        }

        Ok(None)
    }

    /// hookfxr.iniを設定
    pub fn configure_hookfxr(&self, enable: bool) -> Result<(), Box<dyn Error + Send + Sync>> {
        let ini_path = self.get_hookfxr_ini_path();

        let content = if enable {
            "[hookfxr]\nenable=true\n"
        } else {
            "[hookfxr]\nenable=false\n"
        };

        fs::write(&ini_path, content)?;
        Ok(())
    }

    /// BepisLoaderをアンインストール
    pub fn uninstall(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // BepisLoader関連ファイルを削除
        let files_to_remove = [
            self.game_dir.join("BepisLoader.dll"),
            self.game_dir.join("BepisLoader.deps.json"),
            self.game_dir.join("BepisLoader.runtimeconfig.json"),
            self.game_dir.join("hostfxr.dll"),
            self.game_dir.join("hookfxr.ini"),
        ];

        for file in &files_to_remove {
            if file.exists() {
                fs::remove_file(file)?;
            }
        }

        // BepInExディレクトリを削除
        let bepinex_dir = self.game_dir.join("BepInEx");
        if bepinex_dir.exists() {
            fs::remove_dir_all(&bepinex_dir)?;
        }

        // インストール情報を削除
        let info_file = self.get_info_file_path();
        if info_file.exists() {
            fs::remove_file(&info_file)?;
        }

        Ok(())
    }

    /// 起動引数を取得
    pub fn get_launch_args(&self) -> Vec<String> {
        let status = self.get_status();

        if status.installed && status.hookfxr_enabled {
            vec!["--hookfxr-enable".to_string()]
        } else {
            vec![]
        }
    }

    /// インストール情報を保存
    fn save_info(&self, info: &BepisLoaderInfo) -> Result<(), Box<dyn Error + Send + Sync>> {
        let info_file = self.get_info_file_path();
        let content = serde_json::to_string_pretty(info)?;
        fs::write(&info_file, content)?;
        Ok(())
    }

    /// Thunderstoreクライアントへの参照を取得
    pub fn thunderstore(&self) -> &ThunderstoreClient {
        &self.thunderstore
    }

    /// MODをインストール（Thunderstoreから）
    pub async fn install_mod(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
    ) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        let mut all_files = Vec::new();

        // 依存関係をインストール
        let dependencies = self.thunderstore.resolve_dependencies(package, version).await?;
        for dep in &dependencies {
            // BepisLoader本体はスキップ（既にインストール済みのはず）
            if dep.full_name.contains("BepisLoader") {
                continue;
            }
            println!("Installing dependency: {}", dep.full_name);
            let files = self.install_mod_package_internal(dep, None, true).await?;
            all_files.extend(files);
        }

        // MOD本体をインストール
        let files = self.install_mod_package_internal(package, version, false).await?;
        all_files.extend(files);

        Ok(all_files)
    }

    /// 単一のMODパッケージをインストール（game_dirにRenderer等も展開）
    async fn install_mod_package(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
    ) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        self.install_mod_package_internal(package, version, false).await
    }

    /// 単一のMODパッケージをインストール（内部実装）
    async fn install_mod_package_internal(
        &self,
        package: &ThunderstorePackage,
        version: Option<&str>,
        is_dependency: bool,
    ) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        // ダウンロード
        let temp_dir = self.profile_dir.join("temp");
        let zip_path = self.thunderstore
            .download_package(package, version, &temp_dir)
            .await?;

        // 展開（game_dirとplugins_dirを別々に指定）
        let extracted_files = self.thunderstore.extract_package_with_game_dir(
            &zip_path,
            &self.game_dir,
            &self.get_plugins_dir(),
        )?;

        // 一時ファイルを削除
        let _ = fs::remove_file(&zip_path);
        let _ = fs::remove_dir_all(&temp_dir);

        // インストール済みMODリストに追加
        let installed_version = if let Some(v) = version {
            v.to_string()
        } else {
            package.versions.first()
                .map(|v| v.version_number.clone())
                .unwrap_or_else(|| "unknown".to_string())
        };

        let description = package.versions.first()
            .map(|v| v.description.clone())
            .unwrap_or_default();

        let installed_mod = InstalledBepisMod {
            name: package.name.clone(),
            full_name: package.full_name.clone(),
            description,
            version: installed_version,
            install_date: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            installed_files: extracted_files.clone(),
            is_dependency,
        };

        // 既存のリストに追加（同名MODは上書き）
        let mut mod_list = self.load_installed_mods_list();
        mod_list.mods.retain(|m| m.full_name != package.full_name);
        mod_list.mods.push(installed_mod);
        self.save_installed_mods_list(&mod_list)?;

        Ok(extracted_files)
    }

    /// インストール済みプラグイン一覧を取得
    pub fn get_installed_plugins(&self) -> Result<Vec<PathBuf>, Box<dyn Error + Send + Sync>> {
        let plugins_dir = self.get_plugins_dir();
        if !plugins_dir.exists() {
            return Ok(Vec::new());
        }

        let plugins: Vec<PathBuf> = fs::read_dir(&plugins_dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext == "dll")
                    .unwrap_or(false)
            })
            .collect();

        Ok(plugins)
    }

    /// インストール済みMODリストを取得
    pub fn get_installed_mods(&self) -> Vec<InstalledBepisMod> {
        self.load_installed_mods_list().mods
    }

    /// MODをアンインストール
    pub fn uninstall_mod(&self, full_name: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut mod_list = self.load_installed_mods_list();

        // 該当MODを検索
        let mod_to_remove = mod_list.mods.iter().find(|m| m.full_name == full_name).cloned();

        if let Some(installed_mod) = mod_to_remove {
            // ファイルを削除
            for file_path in &installed_mod.installed_files {
                if file_path.exists() {
                    let _ = fs::remove_file(file_path);
                    println!("Removed: {}", file_path.display());
                }
            }

            // リストから削除
            mod_list.mods.retain(|m| m.full_name != full_name);
            self.save_installed_mods_list(&mod_list)?;
        }

        Ok(())
    }
}
