use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModLoaderType {
    ResoniteModLoader,
    MonkeyLoader,
}

impl ModLoaderType {
    pub fn display_name(&self) -> &'static str {
        match self {
            ModLoaderType::ResoniteModLoader => "Resonite Mod Loader",
            ModLoaderType::MonkeyLoader => "MonkeyLoader",
        }
    }
    
    pub fn short_name(&self) -> &'static str {
        match self {
            ModLoaderType::ResoniteModLoader => "RML",
            ModLoaderType::MonkeyLoader => "ML",
        }
    }
}

impl Default for ModLoaderType {
    fn default() -> Self {
        ModLoaderType::ResoniteModLoader
    }
}