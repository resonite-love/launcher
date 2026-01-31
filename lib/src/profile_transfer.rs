// プロファイルのエクスポート/インポート機能
//
// .rlprofile形式（ZIP）でプロファイル設定とMOD情報をエクスポート/インポートする

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::bepis_loader::{BepisLoader, InstalledBepisMod};
use crate::mod_loader::ModLoader;
use crate::mod_loader_type::ModLoaderType;
use crate::mod_manager::{InstalledMod, ModManager};
use crate::monkey_loader::MonkeyLoader;
use crate::profile::{Profile, ProfileManager};

/// エクスポートファイルのバージョン
pub const EXPORT_VERSION: u32 = 1;

/// MODのソース種別
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModSource {
    Github,
    Thunderstore,
    Local,
}

/// エクスポートされるMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedMod {
    pub name: String,
    pub source: ModSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_location: Option<String>,
    pub version: String,
    pub file_format: String,
    /// localソースの場合、アーカイブ内のファイルパス
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// MODローダー情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedModLoader {
    #[serde(rename = "type")]
    pub loader_type: ModLoaderType,
    pub version: String,
}


/// ゲーム情報（エクスポート用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedGameInfo {
    pub branch: String,
    pub version: Option<String>,
    pub manifest_id: Option<String>,
}

/// プロファイル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedProfile {
    pub display_name: String,
    pub description: String,
}

/// エクスポートオプション
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub include_config: bool,
}

/// manifest.json の構造
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportManifest {
    pub export_version: u32,
    pub export_date: String,
    pub source_app_version: String,
    pub profile: ExportedProfile,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_info: Option<ExportedGameInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_loader: Option<ExportedModLoader>,
    pub options: ExportOptions,
    pub mods: Vec<ExportedMod>,
}

/// インポート結果のMODステータス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModImportStatus {
    Success,
    VersionNotFound { available_version: Option<String> },
    SourceUnavailable,
    FileNotFound,
    Skipped,
}

/// インポート結果のMOD情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModImportResult {
    pub name: String,
    pub version: String,
    pub status: ModImportStatus,
    pub message: Option<String>,
}

/// インポート結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub profile_name: String,
    pub profile_id: String,
    pub game_info: Option<ExportedGameInfo>,
    pub resonite_installed: Option<String>,
    pub mod_loader_installed: Option<String>,
    pub mods: Vec<ModImportResult>,
    pub config_restored: bool,
}

/// プロファイル転送マネージャー
pub struct ProfileTransfer {
    base_dir: PathBuf,
    app_version: String,
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_profile_dir() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        // ProfileManager::new adds "profiles" to base_dir, so we create structure accordingly
        let profiles_dir = temp_dir.path().join("profiles");
        fs::create_dir_all(&profiles_dir).unwrap();
        
        // Create a test profile
        let profile_dir = profiles_dir.join("test_profile");
        fs::create_dir_all(&profile_dir).unwrap();
        
        let profile = crate::profile::Profile::new("test_profile", "Test Profile", &profile_dir);
        let profile_json = serde_json::to_string_pretty(&profile).unwrap();
        fs::write(profile_dir.join("launchconfig.json"), profile_json).unwrap();
        
        temp_dir
    }

    #[tokio::test]
    async fn test_export_profile_basic() {
        let temp_dir = create_test_profile_dir();
        // ProfileManager::new expects base_dir and adds "profiles" internally
        // So we pass temp_dir.path() as base_dir
        let base_dir = temp_dir.path().to_path_buf();
        let profiles_dir = base_dir.join("profiles");
        let profile_dir = profiles_dir.join("test_profile");
        
        // Verify test setup
        assert!(profiles_dir.exists(), "Profiles dir not created: {:?}", profiles_dir);
        assert!(profile_dir.exists(), "Profile dir not created: {:?}", profile_dir);
        assert!(profile_dir.join("launchconfig.json").exists(), "launchconfig.json not created");
        
        // ProfileTransfer now takes base_dir, not profiles_dir
        let transfer = ProfileTransfer::new(base_dir, "1.0.0".to_string());
        let output_path = temp_dir.path().join("test.rlprofile");
        
        let result = transfer.export_profile("test_profile", &output_path, false).await;
        
        assert!(result.is_ok(), "Export failed: {:?}", result.err());
        assert!(output_path.exists(), "Output file not created");
    }

    #[tokio::test]
    async fn test_export_profile_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let profiles_dir = temp_dir.path().join("profiles");
        fs::create_dir_all(&profiles_dir).unwrap();
        
        // ProfileTransfer now takes base_dir
        let transfer = ProfileTransfer::new(temp_dir.path().to_path_buf(), "1.0.0".to_string());
        let output_path = temp_dir.path().join("test.rlprofile");
        
        let result = transfer.export_profile("nonexistent", &output_path, false).await;
        
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("not found"), "Unexpected error: {}", err);
    }

    #[test]
    fn test_detect_source_github() {
        let transfer = ProfileTransfer::new(PathBuf::new(), "1.0.0".to_string());
        
        assert_eq!(
            transfer.detect_source("https://github.com/user/repo"),
            ModSource::Github
        );
    }

    #[test]
    fn test_detect_source_thunderstore() {
        let transfer = ProfileTransfer::new(PathBuf::new(), "1.0.0".to_string());
        
        assert_eq!(
            transfer.detect_source("https://thunderstore.io/package/author/mod"),
            ModSource::Thunderstore
        );
        assert_eq!(
            transfer.detect_source("Author-ModName"),
            ModSource::Thunderstore
        );
    }

    #[test]
    fn test_detect_source_local() {
        let transfer = ProfileTransfer::new(PathBuf::new(), "1.0.0".to_string());
        
        assert_eq!(
            transfer.detect_source("some/local/path"),
            ModSource::Local
        );
        assert_eq!(
            transfer.detect_source(""),
            ModSource::Local
        );
    }

    #[test]
    fn test_preview_import() {
        // Create a minimal .rlprofile file for testing
        let temp_dir = TempDir::new().unwrap();
        let archive_path = temp_dir.path().join("test.rlprofile");
        
        let manifest = ExportManifest {
            export_version: EXPORT_VERSION,
            export_date: "2024-01-01T00:00:00Z".to_string(),
            source_app_version: "1.0.0".to_string(),
            profile: ExportedProfile {
                display_name: "Test Profile".to_string(),
                description: "Test description".to_string(),
            },
            game_info: None,
            mod_loader: None,
            options: ExportOptions { include_config: false },
            mods: vec![],
        };
        
        // Create ZIP file
        let file = File::create(&archive_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        
        let manifest_json = serde_json::to_string_pretty(&manifest).unwrap();
        zip.start_file("manifest.json", options).unwrap();
        zip.write_all(manifest_json.as_bytes()).unwrap();
        zip.finish().unwrap();
        
        // Test preview
        let transfer = ProfileTransfer::new(PathBuf::new(), "1.0.0".to_string());
        let result = transfer.preview_import(&archive_path);
        
        assert!(result.is_ok(), "Preview failed: {:?}", result.err());
        let loaded_manifest = result.unwrap();
        assert_eq!(loaded_manifest.profile.display_name, "Test Profile");
    }

    #[tokio::test]
    async fn test_export_and_import() {
        // Create source environment
        let source_dir = TempDir::new().unwrap();
        let source_base = source_dir.path().to_path_buf();
        let source_profiles_dir = source_base.join("profiles");
        fs::create_dir_all(&source_profiles_dir).unwrap();
        
        // Create a test profile with some content
        let profile_dir = source_profiles_dir.join("export_test");
        fs::create_dir_all(&profile_dir).unwrap();
        
        let mut profile = crate::profile::Profile::new("export_test", "Export Test Profile", &profile_dir);
        profile.description = "Test profile for export/import".to_string();
        profile.args = vec!["-TestOption".to_string(), "-AnotherOption".to_string()];
        let profile_json = serde_json::to_string_pretty(&profile).unwrap();
        fs::write(profile_dir.join("launchconfig.json"), &profile_json).unwrap();
        
        // Export
        let transfer = ProfileTransfer::new(source_base.clone(), "1.0.0".to_string());
        let export_path = source_dir.path().join("exported.rlprofile");
        let export_result = transfer.export_profile("export_test", &export_path, false).await;
        assert!(export_result.is_ok(), "Export failed: {:?}", export_result.err());
        assert!(export_path.exists(), "Export file not created");
        
        // Verify export file contents
        let file = File::open(&export_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let manifest_file = archive.by_name("manifest.json");
        assert!(manifest_file.is_ok(), "manifest.json not found in archive");
        
        // Create destination environment
        let dest_dir = TempDir::new().unwrap();
        let dest_base = dest_dir.path().to_path_buf();
        let dest_profiles_dir = dest_base.join("profiles");
        fs::create_dir_all(&dest_profiles_dir).unwrap();
        
        // Import
        let dest_transfer = ProfileTransfer::new(dest_base.clone(), "1.0.0".to_string());
        let import_result = dest_transfer.import_profile(&export_path, Some("Imported Profile".to_string())).await;
        assert!(import_result.is_ok(), "Import failed: {:?}", import_result.err());
        
        let result = import_result.unwrap();
        assert_eq!(result.profile_name, "Imported Profile");
        
        // Verify imported profile exists
        let imported_profile_dir = dest_profiles_dir.join(&result.profile_id);
        assert!(imported_profile_dir.exists(), "Imported profile directory not created: {:?}", imported_profile_dir);
        
        // Verify launchconfig.json was imported
        let imported_config_path = imported_profile_dir.join("launchconfig.json");
        assert!(imported_config_path.exists(), "launchconfig.json not imported");
        
        // Verify profile data
        let profile_manager = crate::profile::ProfileManager::new(&dest_base);
        let imported_profile = profile_manager.get_profile(&result.profile_id);
        assert!(imported_profile.is_ok(), "Failed to load imported profile: {:?}", imported_profile.err());
        
        let imported_profile = imported_profile.unwrap();
        assert_eq!(imported_profile.get_display_name(), "Imported Profile");
        // Launch options should be restored from launchconfig.json
        assert!(imported_profile.args.contains(&"-TestOption".to_string()), 
            "Launch options not restored: {:?}", imported_profile.args);
    }

    #[tokio::test]
    async fn test_export_import_with_config() {
        use crate::mod_loader_type::ModLoaderType;
        
        // Create source environment
        let source_dir = TempDir::new().unwrap();
        let source_base = source_dir.path().to_path_buf();
        let source_profiles_dir = source_base.join("profiles");
        fs::create_dir_all(&source_profiles_dir).unwrap();
        
        // Create a test profile with BepisLoader
        let profile_dir = source_profiles_dir.join("config_test");
        let game_dir = profile_dir.join("Game");
        fs::create_dir_all(&game_dir).unwrap();
        
        let mut profile = crate::profile::Profile::new("config_test", "Config Test Profile", &profile_dir);
        profile.mod_loader_type = Some(ModLoaderType::BepisLoader);
        let profile_json = serde_json::to_string_pretty(&profile).unwrap();
        fs::write(profile_dir.join("launchconfig.json"), &profile_json).unwrap();
        
        // Create BepisLoader config files
        let bepinex_config_dir = game_dir.join("BepInEx").join("config");
        fs::create_dir_all(&bepinex_config_dir).unwrap();
        fs::write(bepinex_config_dir.join("test_config.cfg"), "Setting = true").unwrap();
        
        // Export with config
        let transfer = ProfileTransfer::new(source_base.clone(), "1.0.0".to_string());
        let export_path = source_dir.path().join("exported_with_config.rlprofile");
        let export_result = transfer.export_profile("config_test", &export_path, true).await;
        assert!(export_result.is_ok(), "Export with config failed: {:?}", export_result.err());
        
        // Verify config is in archive
        let file = File::open(&export_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();
        let has_config = archive.file_names().any(|n| n.contains("BepInEx") && n.contains("config"));
        assert!(has_config, "Config files not included in export. Files in archive: {:?}", 
            archive.file_names().collect::<Vec<_>>());
        
        // Create destination and import
        let dest_dir = TempDir::new().unwrap();
        let dest_base = dest_dir.path().to_path_buf();
        let dest_profiles_dir = dest_base.join("profiles");
        fs::create_dir_all(&dest_profiles_dir).unwrap();
        
        let dest_transfer = ProfileTransfer::new(dest_base.clone(), "1.0.0".to_string());
        let import_result = dest_transfer.import_profile(&export_path, None).await;
        assert!(import_result.is_ok(), "Import with config failed: {:?}", import_result.err());
        
        let result = import_result.unwrap();
        assert!(result.config_restored, "Config was not restored");
        
        // Verify config files were restored
        let imported_profile_dir = dest_profiles_dir.join(&result.profile_id);
        let imported_config_path = imported_profile_dir.join("Game").join("BepInEx").join("config").join("test_config.cfg");
        assert!(imported_config_path.exists(), "Config file not restored: {:?}", imported_config_path);
    }
}

impl ProfileTransfer {
    pub fn new(base_dir: PathBuf, app_version: String) -> Self {
        Self {
            base_dir,
            app_version,
        }
    }

    /// プロファイルをエクスポート
    pub async fn export_profile(
        &self,
        profile_id: &str,
        output_path: &Path,
        include_config: bool,
    ) -> Result<()> {
        let profile_manager = ProfileManager::new(&self.base_dir);
        let profile = profile_manager
            .get_profile(profile_id)
            .map_err(|e| anyhow!("Failed to get profile: {}", e))?;
        let profile_dir = profile_manager.get_profile_dir(profile_id);
        let game_dir = profile_dir.join("Game");

        // MODローダー情報を取得
        let mod_loader_info = self.get_mod_loader_info(&profile, &profile_dir)?;

        // インストール済みMODを収集
        let mods = self.collect_installed_mods(&profile, &profile_dir, &game_dir)?;

        // ゲーム情報を取得
        let game_info = profile.game_info.as_ref().map(|gi| ExportedGameInfo {
            branch: gi.branch.clone(),
            version: gi.version.clone(),
            manifest_id: gi.manifest_id.clone(),
        });

        // manifest作成
        let manifest = ExportManifest {
            export_version: EXPORT_VERSION,
            export_date: Utc::now().to_rfc3339(),
            source_app_version: self.app_version.clone(),
            profile: ExportedProfile {
                display_name: profile.get_display_name().to_string(),
                description: profile.description.clone(),
            },
            game_info,
            mod_loader: mod_loader_info,
            options: ExportOptions { include_config },
            mods,
        };

        // ZIPファイル作成
        let file = File::create(output_path)?;
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);

        // manifest.json
        let manifest_json = serde_json::to_string_pretty(&manifest)?;
        zip.start_file("manifest.json", options)?;
        zip.write_all(manifest_json.as_bytes())?;

        // launchconfig.json
        let launchconfig_path = profile_dir.join("launchconfig.json");
        if launchconfig_path.exists() {
            let content = fs::read_to_string(&launchconfig_path)?;
            zip.start_file("launchconfig.json", options)?;
            zip.write_all(content.as_bytes())?;
        }

        // localソースのMODファイルを追加
        for exported_mod in &manifest.mods {
            if exported_mod.source == ModSource::Local {
                if let Some(archive_path) = &exported_mod.file_path {
                    if let Ok(actual_path) = self.get_mod_actual_path(&game_dir, exported_mod) {
                        if actual_path.exists() {
                            let content = fs::read(&actual_path)?;
                            zip.start_file(archive_path, options)?;
                            zip.write_all(&content)?;
                        }
                    }
                }
            }
        }

        // 設定ファイルを含める場合
        if include_config {
            self.add_config_files_to_zip(&mut zip, &game_dir, &profile.mod_loader_type, options)?;
        }

        zip.finish()?;
        Ok(())
    }

    /// MODローダー情報を取得
    fn get_mod_loader_info(
        &self,
        profile: &Profile,
        profile_dir: &Path,
    ) -> Result<Option<ExportedModLoader>> {
        let game_dir = profile_dir.join("Game");
        
        match &profile.mod_loader_type {
            Some(ModLoaderType::ResoniteModLoader) => {
                let loader = ModLoader::new(game_dir);
                let status = loader.get_status()?;
                if status.installed {
                    Ok(Some(ExportedModLoader {
                        loader_type: ModLoaderType::ResoniteModLoader,
                        version: status.version.unwrap_or_else(|| "unknown".to_string()),
                    }))
                } else {
                    Ok(None)
                }
            }
            Some(ModLoaderType::MonkeyLoader) => {
                let loader = MonkeyLoader::new(game_dir);
                let status = loader.get_status()?;
                if status.installed {
                    Ok(Some(ExportedModLoader {
                        loader_type: ModLoaderType::MonkeyLoader,
                        version: status.version.unwrap_or_else(|| "unknown".to_string()),
                    }))
                } else {
                    Ok(None)
                }
            }
            Some(ModLoaderType::BepisLoader) => {
                let loader = BepisLoader::new(profile_dir.to_path_buf());
                match loader.get_installed_info() {
                    Ok(info) => Ok(Some(ExportedModLoader {
                        loader_type: ModLoaderType::BepisLoader,
                        version: info.version,
                    })),
                    Err(_) => Ok(None),
                }
            }
            None => Ok(None),
        }
    }

    /// インストール済みMODを収集
    fn collect_installed_mods(
        &self,
        profile: &Profile,
        profile_dir: &Path,
        _game_dir: &Path,
    ) -> Result<Vec<ExportedMod>> {
        let mut mods = Vec::new();

        match &profile.mod_loader_type {
            Some(ModLoaderType::BepisLoader) => {
                // BepisLoader用のMODリスト
                let loader = BepisLoader::new(profile_dir.to_path_buf());
                let installed = loader.get_installed_mods();
                for m in installed {
                    mods.push(self.convert_bepis_mod(&m));
                }
            }
            Some(ModLoaderType::ResoniteModLoader) | Some(ModLoaderType::MonkeyLoader) | None => {
                // RML/ML用のMODリスト
                let installed_mods_file = profile_dir.join("installed_mods.json");
                if installed_mods_file.exists() {
                    let content = fs::read_to_string(&installed_mods_file)?;
                    let installed: Vec<InstalledMod> = serde_json::from_str(&content)?;
                    for m in installed {
                        mods.push(self.convert_installed_mod(&m));
                    }
                }
            }
        }

        Ok(mods)
    }

    /// BepisLoaderのMODをExportedModに変換
    fn convert_bepis_mod(&self, m: &InstalledBepisMod) -> ExportedMod {
        let source = self.detect_source(&m.full_name);
        let file_path = if source == ModSource::Local {
            Some(format!("files/mods/BepInEx/plugins/{}.dll", m.name))
        } else {
            None
        };

        ExportedMod {
            name: m.name.clone(),
            source,
            source_location: if m.full_name.is_empty() {
                None
            } else {
                Some(m.full_name.clone())
            },
            version: m.version.clone(),
            file_format: "dll".to_string(),
            file_path,
        }
    }

    /// InstalledModをExportedModに変換
    fn convert_installed_mod(&self, m: &InstalledMod) -> ExportedMod {
        let source = self.detect_source(&m.source_location);
        let file_format = m.file_format.clone().unwrap_or_else(|| "dll".to_string());
        let file_path = if source == ModSource::Local {
            let folder = match m.mod_loader_type.as_deref() {
                Some("MonkeyLoader") if file_format == "nupkg" => "MonkeyLoader/Mods",
                _ => "rml_mods",
            };
            Some(format!(
                "files/mods/{}/{}.{}",
                folder, m.name, file_format
            ))
        } else {
            None
        };

        ExportedMod {
            name: m.name.clone(),
            source,
            source_location: if m.source_location.is_empty() {
                None
            } else {
                Some(m.source_location.clone())
            },
            version: m.installed_version.clone(),
            file_format,
            file_path,
        }
    }

    /// ソース種別を検出
    fn detect_source(&self, source_location: &str) -> ModSource {
        if source_location.contains("github.com") {
            ModSource::Github
        } else if source_location.contains("thunderstore.io") {
            ModSource::Thunderstore
        } else if !source_location.is_empty() && source_location.contains('-') {
            // Thunderstoreのパッケージ名形式: Author-ModName
            let parts: Vec<&str> = source_location.split('-').collect();
            if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                ModSource::Thunderstore
            } else {
                ModSource::Local
            }
        } else {
            ModSource::Local
        }
    }

    /// MODの実際のファイルパスを取得
    fn get_mod_actual_path(&self, game_dir: &Path, exported_mod: &ExportedMod) -> Result<PathBuf> {
        let path = match exported_mod.file_format.as_str() {
            "nupkg" => game_dir
                .join("MonkeyLoader")
                .join("Mods")
                .join(format!("{}.nupkg", exported_mod.name)),
            "dll" => {
                // rml_modsまたはBepInEx/pluginsを確認
                let rml_path = game_dir
                    .join("rml_mods")
                    .join(format!("{}.dll", exported_mod.name));
                if rml_path.exists() {
                    rml_path
                } else {
                    game_dir
                        .join("BepInEx")
                        .join("plugins")
                        .join(format!("{}.dll", exported_mod.name))
                }
            }
            _ => {
                return Err(anyhow!(
                    "Unknown file format: {}",
                    exported_mod.file_format
                ))
            }
        };
        Ok(path)
    }

    /// 設定ファイルをZIPに追加
    fn add_config_files_to_zip<W: Write + std::io::Seek>(
        &self,
        zip: &mut ZipWriter<W>,
        game_dir: &Path,
        mod_loader_type: &Option<ModLoaderType>,
        options: FileOptions,
    ) -> Result<()> {
        match mod_loader_type {
            Some(ModLoaderType::BepisLoader) => {
                let config_dir = game_dir.join("BepInEx").join("config");
                if config_dir.exists() {
                    self.add_directory_to_zip(zip, &config_dir, "files/config/BepInEx/config", options)?;
                }
            }
            Some(ModLoaderType::MonkeyLoader) => {
                // MonkeyLoaderの設定ディレクトリ
                let config_dir = game_dir.join("MonkeyLoader");
                if config_dir.exists() {
                    // Modsフォルダは除外して設定のみ
                    for entry in fs::read_dir(&config_dir)? {
                        let entry = entry?;
                        let path = entry.path();
                        if path.is_file() {
                            let file_name = path.file_name().unwrap().to_string_lossy();
                            let archive_path = format!("files/config/MonkeyLoader/{}", file_name);
                            let content = fs::read(&path)?;
                            zip.start_file(&archive_path, options)?;
                            zip.write_all(&content)?;
                        }
                    }
                }
            }
            _ => {
                // RMLには特別な設定フォルダはない
            }
        }
        Ok(())
    }

    /// ディレクトリをZIPに追加
    fn add_directory_to_zip<W: Write + std::io::Seek>(
        &self,
        zip: &mut ZipWriter<W>,
        dir: &Path,
        archive_prefix: &str,
        options: FileOptions,
    ) -> Result<()> {
        if !dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.file_name().unwrap().to_string_lossy();
            let archive_path = format!("{}/{}", archive_prefix, name);

            if path.is_file() {
                let content = fs::read(&path)?;
                zip.start_file(&archive_path, options)?;
                zip.write_all(&content)?;
            } else if path.is_dir() {
                self.add_directory_to_zip(zip, &path, &archive_path, options)?;
            }
        }
        Ok(())
    }

    /// プロファイルをインポート（Resoniteインストールは呼び出し元で行う）
    pub async fn import_profile(
        &self,
        archive_path: &Path,
        new_profile_name: Option<String>,
    ) -> Result<ImportResult> {
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        // manifest.jsonを読み込み
        let manifest: ExportManifest = {
            let mut manifest_file = archive.by_name("manifest.json")?;
            let mut content = String::new();
            manifest_file.read_to_string(&mut content)?;
            serde_json::from_str(&content)?
        };

        // バージョンチェック
        if manifest.export_version > EXPORT_VERSION {
            return Err(anyhow!(
                "Unsupported export version: {}. This app supports up to version {}",
                manifest.export_version,
                EXPORT_VERSION
            ));
        }

        // プロファイル名を決定
        let profile_name = new_profile_name
            .unwrap_or_else(|| format!("{}_imported", manifest.profile.display_name));

        // 新規プロファイル作成
        let profile_manager = ProfileManager::new(&self.base_dir);
        let profile = profile_manager
            .create_profile(&profile_name)
            .map_err(|e| anyhow!("Failed to create profile: {}", e))?;
        let profile_dir = profile_manager.get_profile_dir(&profile.id);
        let game_dir = profile_dir.join("Game");
        fs::create_dir_all(&game_dir)?;

        // launchconfig.jsonを適用（archiveを再オープン）
        drop(archive);
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;
        self.apply_launchconfig(&mut archive, &profile_dir, &profile.id, Some(&profile_name))?;

        // MODローダーをインストール（最新版）
        let mod_loader_installed = if let Some(ref loader_info) = manifest.mod_loader {
            Some(
                self.install_mod_loader(&loader_info.loader_type, &profile_dir)
                    .await?,
            )
        } else {
            None
        };

        // プロファイルのmod_loader_typeを更新
        if let Some(ref loader_info) = manifest.mod_loader {
            let mut updated_profile = profile_manager
                .get_profile(&profile.id)
                .map_err(|e| anyhow!("Failed to get profile: {}", e))?;
            updated_profile.mod_loader_type = Some(loader_info.loader_type);
            profile_manager
                .update_profile(&updated_profile)
                .map_err(|e| anyhow!("Failed to update profile: {}", e))?;
        }

        // MODをインストール（archiveを再オープン）
        drop(archive);
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;
        let mod_results = self
            .install_mods(
                &manifest.mods,
                &mut archive,
                &profile_dir,
                manifest.mod_loader.as_ref().map(|l| l.loader_type),
            )
            .await?;

        // 設定ファイルを復元（archiveを再オープン）
        drop(archive);
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;
        let config_restored = if manifest.options.include_config {
            self.restore_config_files(&mut archive, &game_dir)?
        } else {
            false
        };

        Ok(ImportResult {
            profile_name,
            profile_id: profile.id,
            game_info: manifest.game_info,
            resonite_installed: None, // Tauri側でインストール後に設定
            mod_loader_installed,
            mods: mod_results,
            config_restored,
        })
    }

    /// launchconfig.jsonを適用
    fn apply_launchconfig(
        &self,
        archive: &mut ZipArchive<File>,
        profile_dir: &Path,
        profile_id: &str,
        new_profile_name: Option<&str>,
    ) -> Result<()> {
        if let Ok(mut file) = archive.by_name("launchconfig.json") {
            let mut content = String::new();
            file.read_to_string(&mut content)?;

            // パス変数を新しいプロファイルに合わせて更新
            let mut profile: Profile = serde_json::from_str(&content)?;
            profile.id = profile_id.to_string();
            
            // 新しいプロファイル名が指定されている場合は更新
            if let Some(name) = new_profile_name {
                profile.display_name = name.to_string();
            }

            // argsのパスを更新
            let profile_dir_str = profile_dir.to_string_lossy().to_string();
            profile.args = profile
                .args
                .iter()
                .map(|arg| {
                    // %PROFILE_DIR%などの変数はそのまま保持
                    // 絶対パスは新しいプロファイルディレクトリに置換
                    if arg.contains("profiles\\") || arg.contains("profiles/") {
                        // 古いプロファイルパスを検出して置換
                        if arg.contains("DataPath") {
                            format!("{}\\DataPath", profile_dir_str)
                        } else {
                            arg.clone()
                        }
                    } else {
                        arg.clone()
                    }
                })
                .collect();

            let output_path = profile_dir.join("launchconfig.json");
            let json = serde_json::to_string_pretty(&profile)?;
            fs::write(output_path, json)?;
        }
        Ok(())
    }

    /// MODローダーをインストール（最新版）
    async fn install_mod_loader(
        &self,
        loader_type: &ModLoaderType,
        profile_dir: &Path,
    ) -> Result<String> {
        let game_dir = profile_dir.join("Game");
        
        match loader_type {
            ModLoaderType::ResoniteModLoader => {
                let loader = ModLoader::new(game_dir.clone());
                loader.install().await?;
                let status = loader.get_status()?;
                Ok(format!(
                    "ResoniteModLoader {}",
                    status.version.unwrap_or_else(|| "installed".to_string())
                ))
            }
            ModLoaderType::MonkeyLoader => {
                let loader = MonkeyLoader::new(game_dir.clone());
                loader.install().await?;
                let status = loader.get_status()?;
                Ok(format!(
                    "MonkeyLoader {}",
                    status.version.unwrap_or_else(|| "installed".to_string())
                ))
            }
            ModLoaderType::BepisLoader => {
                let loader = BepisLoader::new(profile_dir.to_path_buf());
                let install_result = loader.install().await
                    .map_err(|e| anyhow!("Failed to install BepisLoader: {}", e))?;
                Ok(format!("BepisLoader {}", install_result.version))
            }
        }
    }

    /// MODをインストール
    async fn install_mods(
        &self,
        mods: &[ExportedMod],
        archive: &mut ZipArchive<File>,
        profile_dir: &Path,
        mod_loader_type: Option<ModLoaderType>,
    ) -> Result<Vec<ModImportResult>> {
        let mut results = Vec::new();
        let game_dir = profile_dir.join("Game");

        for exported_mod in mods {
            let result = match exported_mod.source {
                ModSource::Github => {
                    self.install_mod_from_github(exported_mod, profile_dir, mod_loader_type)
                        .await
                }
                ModSource::Thunderstore => {
                    self.install_mod_from_thunderstore(exported_mod, profile_dir, mod_loader_type)
                        .await
                }
                ModSource::Local => {
                    self.install_mod_from_archive(exported_mod, archive, &game_dir)
                }
            };

            results.push(result);
        }

        Ok(results)
    }

    /// GitHubからMODをインストール
    async fn install_mod_from_github(
        &self,
        exported_mod: &ExportedMod,
        profile_dir: &Path,
        mod_loader_type: Option<ModLoaderType>,
    ) -> ModImportResult {
        let source_location = match &exported_mod.source_location {
            Some(loc) => loc,
            None => {
                return ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::SourceUnavailable,
                    message: Some("Source location not specified".to_string()),
                }
            }
        };

        // ModManagerを使ってインストール
        let mod_manager = ModManager::new(profile_dir.to_path_buf());

        // 指定バージョンでインストールを試みる
        let loader_type_str = mod_loader_type.map(|t| match t {
            ModLoaderType::ResoniteModLoader => "ResoniteModLoader",
            ModLoaderType::MonkeyLoader => "MonkeyLoader",
            ModLoaderType::BepisLoader => "BepisLoader",
        });

        match mod_manager
            .install_mod_from_github(source_location, Some(&exported_mod.version), loader_type_str)
            .await
        {
            Ok(_) => ModImportResult {
                name: exported_mod.name.clone(),
                version: exported_mod.version.clone(),
                status: ModImportStatus::Success,
                message: None,
            },
            Err(e) => {
                let error_str = e.to_string();
                // バージョンが見つからない場合
                if error_str.contains("not found") || error_str.contains("No release") {
                    ModImportResult {
                        name: exported_mod.name.clone(),
                        version: exported_mod.version.clone(),
                        status: ModImportStatus::VersionNotFound {
                            available_version: None,
                        },
                        message: Some(error_str),
                    }
                } else {
                    ModImportResult {
                        name: exported_mod.name.clone(),
                        version: exported_mod.version.clone(),
                        status: ModImportStatus::SourceUnavailable,
                        message: Some(error_str),
                    }
                }
            }
        }
    }

    /// ThunderstoreからMODをインストール
    async fn install_mod_from_thunderstore(
        &self,
        exported_mod: &ExportedMod,
        profile_dir: &Path,
        mod_loader_type: Option<ModLoaderType>,
    ) -> ModImportResult {
        let source_location = match &exported_mod.source_location {
            Some(loc) => loc,
            None => {
                return ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::SourceUnavailable,
                    message: Some("Source location not specified".to_string()),
                }
            }
        };

        // BepisLoaderの場合のみThunderstoreをサポート
        if mod_loader_type == Some(ModLoaderType::BepisLoader) {
            let loader = BepisLoader::new(profile_dir.to_path_buf());
            
            // ThunderstoreClientを使ってパッケージを検索
            let thunderstore = loader.thunderstore();
            match thunderstore.find_package_by_full_name(source_location).await {
                Ok(Some(pkg)) => {
                    // 指定バージョンを探す
                    let version = pkg.versions.iter().find(|v| v.version_number == exported_mod.version);
                    if version.is_some() {
                        match loader.install_mod(&pkg, Some(&exported_mod.version)).await {
                            Ok(_) => ModImportResult {
                                name: exported_mod.name.clone(),
                                version: exported_mod.version.clone(),
                                status: ModImportStatus::Success,
                                message: None,
                            },
                            Err(e) => ModImportResult {
                                name: exported_mod.name.clone(),
                                version: exported_mod.version.clone(),
                                status: ModImportStatus::SourceUnavailable,
                                message: Some(e.to_string()),
                            },
                        }
                    } else {
                        let latest = pkg.versions.first().map(|v| v.version_number.clone());
                        ModImportResult {
                            name: exported_mod.name.clone(),
                            version: exported_mod.version.clone(),
                            status: ModImportStatus::VersionNotFound {
                                available_version: latest,
                            },
                            message: Some(format!("Version {} not found", exported_mod.version)),
                        }
                    }
                }
                Ok(None) => ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::SourceUnavailable,
                    message: Some(format!("Package {} not found", source_location)),
                },
                Err(e) => ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::SourceUnavailable,
                    message: Some(e.to_string()),
                },
            }
        } else {
            // RML/MLの場合（Thunderstoreからの直接インストールは通常ない）
            ModImportResult {
                name: exported_mod.name.clone(),
                version: exported_mod.version.clone(),
                status: ModImportStatus::Skipped,
                message: Some("Thunderstore MOD for RML/ML not supported".to_string()),
            }
        }
    }

    /// アーカイブからMODをインストール（localソース）
    fn install_mod_from_archive(
        &self,
        exported_mod: &ExportedMod,
        archive: &mut ZipArchive<File>,
        game_dir: &Path,
    ) -> ModImportResult {
        let file_path = match &exported_mod.file_path {
            Some(path) => path,
            None => {
                return ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::FileNotFound,
                    message: Some("File path not specified in manifest".to_string()),
                }
            }
        };

        // アーカイブからファイルを読み込み
        let content = match archive.by_name(file_path) {
            Ok(mut file) => {
                let mut buf = Vec::new();
                if file.read_to_end(&mut buf).is_err() {
                    return ModImportResult {
                        name: exported_mod.name.clone(),
                        version: exported_mod.version.clone(),
                        status: ModImportStatus::FileNotFound,
                        message: Some("Failed to read file from archive".to_string()),
                    };
                }
                buf
            }
            Err(_) => {
                return ModImportResult {
                    name: exported_mod.name.clone(),
                    version: exported_mod.version.clone(),
                    status: ModImportStatus::FileNotFound,
                    message: Some(format!("File not found in archive: {}", file_path)),
                }
            }
        };

        // 出力先を決定
        let output_path = if file_path.contains("BepInEx/plugins") {
            let plugins_dir = game_dir.join("BepInEx").join("plugins");
            let _ = fs::create_dir_all(&plugins_dir);
            plugins_dir.join(format!("{}.dll", exported_mod.name))
        } else if file_path.contains("MonkeyLoader/Mods") {
            let mods_dir = game_dir.join("MonkeyLoader").join("Mods");
            let _ = fs::create_dir_all(&mods_dir);
            mods_dir.join(format!("{}.{}", exported_mod.name, exported_mod.file_format))
        } else {
            let mods_dir = game_dir.join("rml_mods");
            let _ = fs::create_dir_all(&mods_dir);
            mods_dir.join(format!("{}.{}", exported_mod.name, exported_mod.file_format))
        };

        // ファイルを書き込み
        match fs::write(&output_path, content) {
            Ok(_) => ModImportResult {
                name: exported_mod.name.clone(),
                version: exported_mod.version.clone(),
                status: ModImportStatus::Success,
                message: None,
            },
            Err(e) => ModImportResult {
                name: exported_mod.name.clone(),
                version: exported_mod.version.clone(),
                status: ModImportStatus::FileNotFound,
                message: Some(format!("Failed to write file: {}", e)),
            },
        }
    }

    /// 設定ファイルを復元
    fn restore_config_files(&self, archive: &mut ZipArchive<File>, game_dir: &Path) -> Result<bool> {
        let mut restored = false;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let name = file.name().to_string();

            if name.starts_with("files/config/") && !file.is_dir() {
                let relative_path = name.strip_prefix("files/config/").unwrap();
                let output_path = game_dir.join(relative_path);

                if let Some(parent) = output_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                let mut content = Vec::new();
                file.read_to_end(&mut content)?;
                fs::write(output_path, content)?;
                restored = true;
            }
        }

        Ok(restored)
    }

    /// エクスポートファイルのプレビューを取得
    pub fn preview_import(&self, archive_path: &Path) -> Result<ExportManifest> {
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        let mut manifest_file = archive.by_name("manifest.json")?;
        let mut content = String::new();
        manifest_file.read_to_string(&mut content)?;

        let manifest: ExportManifest = serde_json::from_str(&content)?;
        Ok(manifest)
    }
}
