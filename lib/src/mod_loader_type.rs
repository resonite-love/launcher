use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModLoaderType {
    ResoniteModLoader,
    MonkeyLoader,
    BepisLoader,
}

impl ModLoaderType {
    pub fn display_name(&self) -> &'static str {
        match self {
            ModLoaderType::ResoniteModLoader => "Resonite Mod Loader",
            ModLoaderType::MonkeyLoader => "MonkeyLoader",
            ModLoaderType::BepisLoader => "BepisLoader (BepInEx)",
        }
    }

    pub fn short_name(&self) -> &'static str {
        match self {
            ModLoaderType::ResoniteModLoader => "RML",
            ModLoaderType::MonkeyLoader => "ML",
            ModLoaderType::BepisLoader => "BepInEx",
        }
    }

    /// MODソースの種類を取得
    pub fn mod_source(&self) -> ModSource {
        match self {
            ModLoaderType::ResoniteModLoader => ModSource::ResoniteModCache,
            ModLoaderType::MonkeyLoader => ModSource::ResoniteModCache,
            ModLoaderType::BepisLoader => ModSource::Thunderstore,
        }
    }
}

impl Default for ModLoaderType {
    fn default() -> Self {
        ModLoaderType::ResoniteModLoader
    }
}

/// MODソースの種類
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModSource {
    /// resonite-mod-cache (GitHub)
    ResoniteModCache,
    /// Thunderstore
    Thunderstore,
}