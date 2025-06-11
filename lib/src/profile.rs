use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::error::Error;

/// Resoniteゲーム情報
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameInfo {
    pub branch: String,
    pub manifest_id: Option<String>,
    pub depot_id: String,
    pub installed: bool,
    pub last_updated: Option<String>,
}

/// Resoniteの起動プロファイルを管理するための構造体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub name: String,
    pub description: String,
    pub game_info: Option<GameInfo>,
    pub args: Vec<String>,
}

impl Profile {
    /// 新しいプロファイルを作成する
    pub fn new(name: &str, _full_profile_path: &Path) -> Self {
        Profile {
            name: name.to_string(),
            description: String::new(),
            game_info: None, // ゲームは後でインストール
            args: vec![
                "-SkipIntroTutorial".to_string(),
                "-DataPath".to_string(),
                "%PROFILE_DIR%\\DataPath".to_string(), // パス変数を使用
            ],
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
        let profile: Profile = serde_json::from_str(&json)?;
        Ok(profile)
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
    pub fn create_profile(&self, name: &str) -> Result<Profile, Box<dyn Error>> {
        let specific_profile_dir = self.profiles_dir.join(name);

        // Check if profile already exists
        if specific_profile_dir.exists() {
            return Err(format!("Profile '{}' already exists", name).into());
        }

        // Create profile directory
        fs::create_dir_all(&specific_profile_dir)?;

        // Create DataPath directory
        let data_path_dir = specific_profile_dir.join("DataPath");
        fs::create_dir_all(&data_path_dir)?;

        // Create Game directory (for future game installation)
        let game_dir = specific_profile_dir.join("Game");
        fs::create_dir_all(&game_dir)?;

        // Create new profile with the full profile path
        let profile = Profile::new(name, &specific_profile_dir);

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

    /// 指定した名前のプロファイルを取得する
    pub fn get_profile(&self, name: &str) -> Result<Profile, Box<dyn Error>> {
        let profile_dir = self.profiles_dir.join(name);

        if !profile_dir.exists() {
            return Err(format!("Profile '{}' not found", name).into());
        }

        Profile::load(&profile_dir)
    }

    /// プロファイルのディレクトリパスを取得
    pub fn get_profile_dir(&self, profile_name: &str) -> PathBuf {
        self.profiles_dir.join(profile_name)
    }

    /// プロファイルを更新して保存
    pub fn update_profile(&self, profile: &Profile) -> Result<(), Box<dyn Error>> {
        let profile_dir = self.get_profile_dir(&profile.name);
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
}
