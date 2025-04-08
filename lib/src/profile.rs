use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::error::Error;

/// Resoniteの起動プロファイルを管理するための構造体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub name: String,
    pub description: String,
    pub args: Vec<String>,
}

impl Profile {
    /// 新しいプロファイルを作成する
    pub fn new(name: &str, full_profile_path: &Path) -> Self {
        // データパスの絶対パスを取得
        let data_path = full_profile_path.join("DataPath");

        Profile {
            name: name.to_string(),
            description: String::new(),
            args: vec![
                "-SkipIntroTutorial".to_string(),
                "-DataPath".to_string(),
                data_path.to_string_lossy().to_string(),
            ],
        }
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
}
