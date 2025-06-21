use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::error::Error;
use crate::mod_loader_type::ModLoaderType;

/// Resoniteゲーム情報
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameInfo {
    pub branch: String,
    pub manifest_id: Option<String>,
    pub depot_id: String,
    pub installed: bool,
    pub last_updated: Option<String>,
    pub version: Option<String>,
}

/// プロファイル設定のバージョン
const PROFILE_CONFIG_VERSION: u32 = 2;

/// Resoniteの起動プロファイルを管理するための構造体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    /// コンフィグファイルのバージョン
    #[serde(default = "default_config_version")]
    pub config_version: u32,
    /// フォルダ名として使用される内部ID（ASCII文字のみ）
    pub id: String,
    /// ユーザーに表示される名前（日本語可）
    pub display_name: String,
    /// 旧フィールド（互換性のため残す）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub name: String,
    pub description: String,
    pub game_info: Option<GameInfo>,
    pub args: Vec<String>,
    /// インストールされているMODローダーのタイプ
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_loader_type: Option<ModLoaderType>,
}

fn default_config_version() -> u32 {
    PROFILE_CONFIG_VERSION
}

impl Profile {
    /// 新しいプロファイルを作成する
    pub fn new(id: &str, display_name: &str, _full_profile_path: &Path) -> Self {
        Profile {
            config_version: PROFILE_CONFIG_VERSION,
            id: id.to_string(),
            display_name: display_name.to_string(),
            name: String::new(), // 互換性のため
            description: String::new(),
            game_info: None, // ゲームは後でインストール
            args: vec![
                "-DataPath".to_string(),
                "%PROFILE_DIR%\\DataPath".to_string(), // パス変数を使用
            ],
            mod_loader_type: None,
        }
    }
    
    /// プロファイルIDを生成（ASCII文字のみ）
    pub fn generate_id(display_name: &str, existing_ids: &[String]) -> String {
        // 基本的なASCII変換
        let base_id = display_name
            .chars()
            .filter_map(|c| {
                match c {
                    'a'..='z' | 'A'..='Z' | '0'..='9' => Some(c.to_ascii_lowercase()),
                    ' ' | '-' | '_' => Some('_'),
                    _ => None, // 日本語文字などは除去
                }
            })
            .collect::<String>()
            .trim_matches('_')
            .to_string();
        
        // 空の場合は"profile"をベースにする
        let base_id = if base_id.is_empty() {
            "profile".to_string()
        } else {
            base_id
        };
        
        // 重複を避けるため番号を追加
        let mut id = base_id.clone();
        let mut counter = 1;
        
        while existing_ids.contains(&id) {
            id = format!("{}{}", base_id, counter);
            counter += 1;
        }
        
        id
    }
    
    /// 表示用の名前を取得（互換性のため）
    pub fn get_display_name(&self) -> &str {
        if !self.display_name.is_empty() {
            &self.display_name
        } else {
            &self.name // 旧フォーマット対応
        }
    }
    
    /// フォルダ名として使用するIDを取得
    pub fn get_folder_name(&self) -> &str {
        if !self.id.is_empty() {
            &self.id
        } else {
            &self.name // 旧フォーマット対応
        }
    }

    /// プロファイルにゲームがインストールされているかチェック
    pub fn has_game_installed(&self) -> bool {
        self.game_info.as_ref().map_or(false, |info| info.installed)
    }

    /// プロファイルのゲームディレクトリパスを取得
    pub fn get_game_dir(&self, profile_dir: &Path) -> PathBuf {
        profile_dir.join("Game")
    }

    /// プロファイルのResonite実行ファイルパスを取得
    pub fn get_resonite_exe(&self, profile_dir: &Path) -> PathBuf {
        self.get_game_dir(profile_dir).join("Resonite.exe")
    }

    /// Build.versionファイルからゲームバージョンを読み取る
    pub fn get_game_version(&self, profile_dir: &Path) -> Option<String> {
        let build_version_path = self.get_game_dir(profile_dir).join("Build.version");
        fs::read_to_string(build_version_path)
            .ok()
            .map(|content| content.trim().to_string())
    }

    /// ゲーム情報を更新
    pub fn update_game_info(&mut self, game_info: GameInfo) {
        self.game_info = Some(game_info);
    }

    /// 起動引数のパス変数を展開
    pub fn expand_args(&self, profile_dir: &Path) -> Vec<String> {
        self.args.iter().map(|arg| {
            arg.replace("%PROFILE_DIR%", &profile_dir.to_string_lossy())
               .replace("%GAME_DIR%", &self.get_game_dir(profile_dir).to_string_lossy())
               .replace("%DATA_DIR%", &profile_dir.join("DataPath").to_string_lossy())
        }).collect()
    }

    /// プロファイルをJSONファイルとして保存する
    pub fn save(&self, profile_dir: &Path) -> Result<(), Box<dyn Error>> {
        let config_path = profile_dir.join("launchconfig.json");
        let json = serde_json::to_string_pretty(self)?;
        fs::write(config_path, json)?;
        Ok(())
    }

    /// JSONファイルからプロファイルを読み込む
    pub fn load(profile_dir: &Path) -> Result<Self, Box<dyn Error>> {
        let config_path = profile_dir.join("launchconfig.json");
        let json = fs::read_to_string(config_path)?;
        let mut profile: Profile = serde_json::from_str(&json)?;
        
        // マイグレーションと欠けているフィールドの補完を実行
        let needs_migration = profile.config_version < PROFILE_CONFIG_VERSION;
        let needs_field_check = Self::needs_field_completion(&profile, profile_dir);
        
        if needs_migration || needs_field_check {
            profile = Self::migrate_profile(profile, profile_dir)?;
            // マイグレーション後は自動保存
            profile.save(profile_dir)?;
        }
        
        Ok(profile)
    }
    
    /// 欠けているフィールドがあるかチェック
    fn needs_field_completion(profile: &Profile, profile_dir: &Path) -> bool {
        // game_infoが存在しない場合
        if profile.game_info.is_none() {
            return true;
        }
        
        // mod_loader_typeが存在しないが、MODローダーが検出される場合
        if profile.mod_loader_type.is_none() {
            if Self::detect_existing_mod_loader(profile_dir).is_some() {
                return true;
            }
        }
        
        // display_nameが空の場合
        if profile.display_name.is_empty() {
            return true;
        }
        
        // argsが空の場合
        if profile.args.is_empty() {
            return true;
        }
        
        false
    }
    
    /// プロファイルのマイグレーション
    fn migrate_profile(mut profile: Profile, profile_dir: &Path) -> Result<Self, Box<dyn Error>> {
        let is_version_migration = profile.config_version < PROFILE_CONFIG_VERSION;
        
        if is_version_migration {
            println!("プロファイル設定をバージョン{}からバージョン{}にマイグレーションします", profile.config_version, PROFILE_CONFIG_VERSION);
        } else {
            println!("プロファイル設定の欠けているフィールドを補完します");
        }
        
        // バージョン1からバージョン2へのマイグレーション
        if profile.config_version < 2 {
            // 既存のMODローダーがインストールされているかチェック
            if let Some(mod_loader_type) = Self::detect_existing_mod_loader(profile_dir) {
                profile.mod_loader_type = Some(mod_loader_type);
                println!("既存のMODローダーを検出しました: {:?}", mod_loader_type);
            } else {
                println!("MODローダーは検出されませんでした");
            }
        }
        
        // 欠けているフィールドの補完（全バージョン対象）
        Self::ensure_required_fields(&mut profile, profile_dir)?;
        
        // バージョンを更新
        profile.config_version = PROFILE_CONFIG_VERSION;
        
        if is_version_migration {
            println!("マイグレーション完了");
        } else {
            println!("フィールド補完完了");
        }
        
        Ok(profile)
    }
    
    /// 必須フィールドが存在することを確認し、欠けている場合は作成する
    fn ensure_required_fields(profile: &mut Profile, profile_dir: &Path) -> Result<(), Box<dyn Error>> {
        let mut fields_created = Vec::new();
        
        // game_infoが存在しない場合は作成
        if profile.game_info.is_none() {
            let game_info = Self::create_default_game_info(profile_dir)?;
            profile.game_info = Some(game_info);
            fields_created.push("game_info");
        }
        
        // mod_loader_typeが存在しない場合は検出して設定
        if profile.mod_loader_type.is_none() {
            if let Some(mod_loader_type) = Self::detect_existing_mod_loader(profile_dir) {
                profile.mod_loader_type = Some(mod_loader_type);
                fields_created.push("mod_loader_type");
            }
        }
        
        // display_nameが空の場合はidから生成
        if profile.display_name.is_empty() {
            if !profile.name.is_empty() {
                // レガシーnameフィールドから移行
                profile.display_name = profile.name.clone();
                fields_created.push("display_name (from legacy name)");
            } else if !profile.id.is_empty() {
                // idから生成
                profile.display_name = profile.id.clone();
                fields_created.push("display_name (from id)");
            } else {
                // 最後の手段として適当な名前を付ける
                profile.display_name = "プロファイル".to_string();
                fields_created.push("display_name (default)");
            }
        }
        
        // argsが空の場合はデフォルト引数を追加
        if profile.args.is_empty() {
            profile.args = vec![
                "-DataPath".to_string(),
                "%PROFILE_DIR%\\DataPath".to_string(),
            ];
            fields_created.push("args (default)");
        }
        
        if !fields_created.is_empty() {
            println!("作成されたフィールド: {}", fields_created.join(", "));
        }
        
        Ok(())
    }
    
    /// デフォルトのGameInfo情報を作成
    fn create_default_game_info(profile_dir: &Path) -> Result<GameInfo, Box<dyn Error>> {
        let game_dir = profile_dir.join("Game");
        let installed = game_dir.exists() && game_dir.is_dir();
        
        // インストール済みの場合は既存のバージョンを検出を試行
        let (branch, version) = if installed {
            Self::detect_game_version(&game_dir).unwrap_or_else(|| ("release".to_string(), None))
        } else {
            ("release".to_string(), None)
        };
        
        Ok(GameInfo {
            branch,
            manifest_id: None,
            depot_id: "2519832".to_string(), // Resoniteのデフォルトdepot ID
            installed,
            last_updated: None,
            version,
        })
    }
    
    /// インストール済みゲームのバージョンとブランチを検出
    fn detect_game_version(game_dir: &Path) -> Option<(String, Option<String>)> {
        // Resonite.exeの存在確認
        let exe_path = game_dir.join("Resonite.exe");
        if !exe_path.exists() {
            return None;
        }
        
        // プリリリース版の特徴的なファイルをチェック
        let is_prerelease = game_dir.join("PreRelease.txt").exists() || 
                           game_dir.join("PRERELEASE").exists();
        
        let branch = if is_prerelease {
            "prerelease".to_string()
        } else {
            "release".to_string()
        };
        
        // バージョン情報の取得を試行（失敗しても構わない）
        let version = Self::extract_version_from_exe(&exe_path);
        
        Some((branch, version))
    }
    
    /// Build.versionファイルからバージョン情報を抽出
    fn extract_version_from_exe(exe_path: &Path) -> Option<String> {
        let game_dir = exe_path.parent()?;
        let version_file = game_dir.join("Build.version");
        
        if version_file.exists() {
            if let Ok(version_content) = fs::read_to_string(&version_file) {
                return Some(version_content.trim().to_string());
            }
        }
        
        None
    }
    
    /// 既存のMODローダーを検出
    fn detect_existing_mod_loader(profile_dir: &Path) -> Option<ModLoaderType> {
        let game_dir = profile_dir.join("Game");
        
        // ResoniteModLoaderの検出
        let rml_dll = game_dir.join("Libraries").join("ResoniteModLoader.dll");
        let harmony_dll = game_dir.join("rml_libs").join("0Harmony.dll");
        
        if rml_dll.exists() && harmony_dll.exists() {
            return Some(ModLoaderType::ResoniteModLoader);
        }
        
        // MonkeyLoaderの検出
        let winhttp_dll = game_dir.join("winhttp.dll");
        let run_script = game_dir.join("run_monkeyloader.sh");
        
        if winhttp_dll.exists() || run_script.exists() {
            return Some(ModLoaderType::MonkeyLoader);
        }
        
        None
    }
}

/// プロファイル管理に関する機能
#[derive(Clone)]
pub struct ProfileManager {
    profiles_dir: PathBuf,
}

impl ProfileManager {
    /// 新しいProfileManagerを作成する
    /// 
    /// # Arguments
    /// 
    /// * `base_dir` - プロファイルディレクトリの親ディレクトリ
    pub fn new(base_dir: &Path) -> Self {
        ProfileManager {
            profiles_dir: base_dir.join("profiles"),
        }
    }

    /// プロファイルディレクトリのパスを取得する
    pub fn get_profiles_dir(&self) -> &Path {
        &self.profiles_dir
    }

    /// 新しいプロファイルを作成する
    pub fn create_profile(&self, display_name: &str) -> Result<Profile, Box<dyn Error>> {
        // 既存のID一覧を取得
        let existing_profiles = self.list_profiles().unwrap_or_default();
        let existing_ids: Vec<String> = existing_profiles.iter()
            .map(|p| p.get_folder_name().to_string())
            .collect();
        
        // 新しいIDを生成
        let profile_id = Profile::generate_id(display_name, &existing_ids);
        let specific_profile_dir = self.profiles_dir.join(&profile_id);

        // Check if profile directory already exists (should not happen with unique ID)
        if specific_profile_dir.exists() {
            return Err(format!("Profile directory '{}' already exists", profile_id).into());
        }

        // Create profile directory
        fs::create_dir_all(&specific_profile_dir)?;

        // Create DataPath directory
        let data_path_dir = specific_profile_dir.join("DataPath");
        fs::create_dir_all(&data_path_dir)?;

        // Create Game directory (for future game installation)
        let game_dir = specific_profile_dir.join("Game");
        fs::create_dir_all(&game_dir)?;

        // Create new profile with ID and display name
        let profile = Profile::new(&profile_id, display_name, &specific_profile_dir);

        // Save profile to JSON file
        profile.save(&specific_profile_dir)?;

        Ok(profile)
    }

    /// 利用可能なプロファイルの一覧を取得する
    pub fn list_profiles(&self) -> Result<Vec<Profile>, Box<dyn Error>> {
        let mut profiles = Vec::new();

        if !self.profiles_dir.exists() {
            return Ok(profiles);
        }

        let entries = fs::read_dir(&self.profiles_dir)?;

        for entry in entries {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let profile_dir = entry.path();
                let config_path = profile_dir.join("launchconfig.json");

                if config_path.exists() {
                    match Profile::load(&profile_dir) {
                        Ok(profile) => {
                            profiles.push(profile);
                        }
                        Err(_) => {
                            // Invalid profile configuration, skip it
                        }
                    }
                }
            }
        }

        Ok(profiles)
    }

    /// 特定のプロファイルを取得する
    /// profile_identifierは表示名でもIDでも可
    pub fn get_profile(&self, profile_identifier: &str) -> Result<Profile, Box<dyn Error>> {
        let profile_dir = self.get_profile_dir(profile_identifier);

        if !profile_dir.exists() {
            return Err(format!("Profile '{}' not found", profile_identifier).into());
        }

        let mut profile = Profile::load(&profile_dir)?;
        
        // 旧フォーマットのマイグレーション（バージョン1以前）
        if profile.id.is_empty() && !profile.name.is_empty() {
            // 旧フォーマット: nameをidとdisplay_nameにコピー
            profile.id = profile.name.clone();
            profile.display_name = profile.name.clone();
            // この変更も保存
            profile.save(&profile_dir)?;
        }
        
        Ok(profile)
    }

    /// 特定のプロファイルのディレクトリパスを取得する
    /// profile_identifierは表示名でもIDでも可
    pub fn get_profile_dir(&self, profile_identifier: &str) -> PathBuf {
        // まず直接IDとして探す
        let id_path = self.profiles_dir.join(profile_identifier);
        if id_path.exists() {
            return id_path;
        }
        
        // 表示名からIDを探す
        if let Ok(profiles) = self.list_profiles() {
            for profile in profiles {
                if profile.get_display_name() == profile_identifier {
                    return self.profiles_dir.join(profile.get_folder_name());
                }
            }
        }
        
        // 見つからない場合はそのまま返す（旧仕様対応）
        self.profiles_dir.join(profile_identifier)
    }

    /// プロファイルを更新して保存
    pub fn update_profile(&self, profile: &Profile) -> Result<(), Box<dyn Error>> {
        let profile_dir = self.get_profile_dir(profile.get_folder_name());
        profile.save(&profile_dir)
    }

    /// プロファイルのゲームがインストールされているかチェック
    pub fn check_game_installed(&self, profile_name: &str) -> Result<bool, Box<dyn Error>> {
        let profile = self.get_profile(profile_name)?;
        let profile_dir = self.get_profile_dir(profile_name);
        
        if let Some(game_info) = &profile.game_info {
            if game_info.installed {
                let exe_path = profile.get_resonite_exe(&profile_dir);
                return Ok(exe_path.exists());
            }
        }
        
        Ok(false)
    }

    /// プロファイルの現在のゲームバージョンを取得
    pub fn get_current_game_version(&self, profile_name: &str) -> Result<Option<String>, Box<dyn Error>> {
        let profile = self.get_profile(profile_name)?;
        let profile_dir = self.get_profile_dir(profile_name);
        
        // Build.versionファイルから直接読み取る（最新の実際のバージョン）
        Ok(profile.get_game_version(&profile_dir))
    }

    /// プロファイルの保存されたゲーム情報を取得（バージョン含む）
    pub fn get_game_info_with_version(&self, profile_name: &str) -> Result<Option<GameInfo>, Box<dyn Error>> {
        let profile = self.get_profile(profile_name)?;
        let profile_dir = self.get_profile_dir(profile_name);
        
        // ゲーム情報が存在し、インストールされている場合は最新バージョンで更新
        if let Some(mut game_info) = profile.game_info.clone() {
            if game_info.installed {
                // Build.versionから最新バージョンを取得
                let current_version = profile.get_game_version(&profile_dir);
                game_info.version = current_version;
                return Ok(Some(game_info));
            }
        }
        
        Ok(profile.game_info)
    }

    /// プロファイルを削除する（プロファイルリストから削除のみ、ディレクトリは呼び出し側で削除）
    pub fn delete_profile(&mut self, profile_identifier: &str) -> Result<(), Box<dyn Error>> {
        // Prevent deletion of default profile
        if profile_identifier == "default" {
            return Err("Cannot delete the default profile".into());
        }
        
        // Check if profile exists
        let _ = self.get_profile(profile_identifier)?;
        
        // Profile deletion is handled by removing the directory
        // No internal state to update since profiles are loaded from disk
        
        Ok(())
    }
}
