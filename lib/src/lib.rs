// resonite-tools-lib
// 
// このライブラリは、Resoniteのインストール、更新、プロファイル管理のための
// 機能を提供します。

pub mod profile;
pub mod install;
pub mod depotdownloader;
pub mod mod_loader;
pub mod mod_manager;
pub mod utils;

// 必要に応じて公開APIをエクスポートする
pub use profile::Profile;
pub use install::ResoniteInstall;
pub use depotdownloader::DepotDownloader;
pub use mod_loader::{ModLoader, ModLoaderInfo};
pub use mod_manager::{ModManager, ModInfo, InstalledMod, GitHubRelease};
