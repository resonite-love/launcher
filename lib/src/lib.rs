// resonite-tools-lib
//
// このライブラリは、Resoniteのインストール、更新、プロファイル管理のための
// 機能を提供します。

#[cfg(test)]
pub mod test_utils;

pub mod profile;
pub mod install;
pub mod depotdownloader;
pub mod mod_loader;
pub mod mod_loader_type;
pub mod monkey_loader;
pub mod mod_manager;
pub mod thunderstore;
pub mod bepis_loader;
pub mod utils;

// 必要に応じて公開APIをエクスポートする
pub use profile::Profile;
pub use install::ResoniteInstall;
pub use depotdownloader::DepotDownloader;
pub use mod_loader::{ModLoader, ModLoaderInfo};
pub use mod_loader_type::{ModLoaderType, ModSource};
pub use monkey_loader::{MonkeyLoader, MonkeyLoaderInfo};
pub use mod_manager::{ModManager, ModInfo, InstalledMod, GitHubRelease};
pub use thunderstore::{ThunderstoreClient, ThunderstorePackage, ThunderstoreVersion, ThunderstoreCategory};
pub use bepis_loader::{BepisLoader, BepisLoaderStatus, BepisLoaderInfo};
