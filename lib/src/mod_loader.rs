use anyhow::{anyhow, Context, Result};
use reqwest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct ModLoaderInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub installation_path: Option<PathBuf>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub assets: Vec<GitHubAsset>,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub draft: bool,
}

#[derive(Debug, Serialize)]
pub struct RmlVersion {
    pub version: String,
    pub prerelease: bool,
    pub installable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

const GITHUB_API_URL: &str =
    "https://api.github.com/repos/resonite-modding-group/ResoniteModLoader/releases";
const RML_VERSION_FILE: &str = ".resonite_mod_loader_version";
// Serialize file replacement, including uninstall, across launcher commands.
static RML_FILES_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub struct ModLoader {
    game_path: PathBuf,
}

impl ModLoader {
    pub fn new(game_path: PathBuf) -> Self {
        Self { game_path }
    }

    /// ResoniteModLoaderの状態を確認
    pub fn get_status(&self) -> Result<ModLoaderInfo> {
        let libraries_path = self.game_path.join("Libraries");
        let mod_loader_dll = libraries_path.join("ResoniteModLoader.dll");
        let rml_libs_path = self.game_path.join("rml_libs");
        let harmony_dll = rml_libs_path.join("0Harmony.dll");

        let installed = mod_loader_dll.exists() && harmony_dll.exists();

        let version = if installed {
            // ここではファイルのバージョン情報を取得するか、既知のバージョンを返す
            self.read_installed_version()
        } else {
            None
        };

        let installation_path = if installed {
            Some(libraries_path)
        } else {
            None
        };

        Ok(ModLoaderInfo {
            installed,
            version,
            installation_path,
        })
    }

    /// ResoniteModLoaderをインストール
    pub async fn install(&self) -> Result<String> {
        let release = self.get_latest_release().await?;
        self.install_release(&release).await?;
        Ok(format!(
            "ResoniteModLoader {} をインストールしました",
            release.tag_name
        ))
    }

    /// MODや依存ライブラリを削除せず、指定リリースのRMLとHarmonyへ変更する。
    pub async fn change_version(&self, version: &str) -> Result<String> {
        self.change_version_from(version, GITHUB_API_URL).await
    }

    async fn change_version_from(&self, version: &str, releases_url: &str) -> Result<String> {
        if !self.get_status()?.installed {
            return Err(anyhow!(
                "ResoniteModLoader is not installed in this profile"
            ));
        }
        if version.trim().is_empty() || matches!(version, "." | "..") {
            return Err(anyhow!("Select an RML release version"));
        }
        let mut url = reqwest::Url::parse(releases_url)?;
        url.path_segments_mut()
            .map_err(|_| anyhow!("Invalid releases URL"))?
            .extend(["tags", version]);
        let release = Self::fetch_release(url.as_str()).await?;
        if release.draft || release.tag_name != version {
            return Err(anyhow!(
                "Requested RML release is not available: {}",
                version
            ));
        }
        self.install_release(&release).await?;
        Ok(release.tag_name)
    }

    pub async fn get_versions() -> Result<Vec<RmlVersion>> {
        Self::get_versions_from(GITHUB_API_URL).await
    }

    async fn get_versions_from(releases_url: &str) -> Result<Vec<RmlVersion>> {
        let client = reqwest::Client::new();
        let mut versions = Vec::new();
        let mut page = 1;
        loop {
            let releases: Vec<GitHubRelease> = client
                .get(releases_url)
                .query(&[("per_page", 100), ("page", page)])
                .header("User-Agent", "ResoniteTools")
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            let count = releases.len();
            versions.extend(
                releases
                    .into_iter()
                    .filter(|release| !release.draft)
                    .map(|release| {
                        let installable = release
                            .assets
                            .iter()
                            .any(|asset| asset.name == "ResoniteModLoader.dll")
                            && release
                                .assets
                                .iter()
                                .any(|asset| asset.name.eq_ignore_ascii_case("0Harmony.dll"));
                        RmlVersion {
                            version: release.tag_name,
                            prerelease: release.prerelease,
                            installable,
                        }
                    }),
            );
            if count < 100 {
                break;
            }
            page += 1;
        }
        Ok(versions)
    }

    async fn install_release(&self, release: &GitHubRelease) -> Result<()> {
        // Validate both assets before downloading or replacing any installed files.
        let mod_loader_asset = release
            .assets
            .iter()
            .find(|asset| asset.name == "ResoniteModLoader.dll")
            .ok_or_else(|| anyhow!("ResoniteModLoader.dll not found in release assets"))?;
        let harmony_asset = release
            .assets
            .iter()
            .find(|asset| asset.name.eq_ignore_ascii_case("0Harmony.dll"))
            .ok_or_else(|| anyhow!("0Harmony.dll not found in release assets"))?;

        let libraries_path = self.game_path.join("Libraries");
        let rml_libs_path = self.game_path.join("rml_libs");
        fs::create_dir_all(&libraries_path)?;
        fs::create_dir_all(&rml_libs_path)?;
        fs::create_dir_all(self.game_path.join("rml_mods"))?;
        // Keep staging on the same volume so each replacement can use rename.
        let staging = tempfile::Builder::new()
            .prefix(".rml-update-")
            .tempdir_in(&self.game_path)?;
        self.download_file(
            &mod_loader_asset.browser_download_url,
            &staging.path().join("ResoniteModLoader.dll"),
        )
        .await?;
        self.download_file(
            &harmony_asset.browser_download_url,
            &staging.path().join("0Harmony.dll"),
        )
        .await?;
        fs::write(staging.path().join(RML_VERSION_FILE), &release.tag_name)?;
        self.apply_staged_release(staging)
    }

    fn apply_staged_release(&self, staging: tempfile::TempDir) -> Result<()> {
        let _guard = RML_FILES_LOCK
            .lock()
            .map_err(|_| anyhow!("RML file lock poisoned"))?;
        let files = [
            (
                "ResoniteModLoader.dll",
                self.game_path.join("Libraries/ResoniteModLoader.dll"),
            ),
            ("0Harmony.dll", self.game_path.join("rml_libs/0Harmony.dll")),
            (
                RML_VERSION_FILE,
                self.game_path.join("rml_libs").join(RML_VERSION_FILE),
            ),
        ];
        let mut backups = Vec::new();
        for (index, (_, destination)) in files.iter().enumerate() {
            let backup = staging.path().join(format!("backup-{}", index));
            match fs::copy(destination, &backup) {
                Ok(_) => backups.push(Some(backup)),
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => backups.push(None),
                Err(err) => {
                    return Err(err)
                        .with_context(|| format!("Cannot back up {}", destination.display()))
                }
            }
        }
        for (index, (name, destination)) in files.iter().enumerate() {
            if let Err(err) = fs::rename(staging.path().join(name), destination) {
                let mut rollback_errors = Vec::new();
                for previous in (0..index).rev() {
                    let target = &files[previous].1;
                    let result = match &backups[previous] {
                        Some(backup) => fs::rename(backup, target),
                        None => fs::remove_file(target),
                    };
                    if let Err(restore_error) = result {
                        rollback_errors.push(format!("{}: {}", target.display(), restore_error));
                    }
                }
                if !rollback_errors.is_empty() {
                    let backup_path = staging.into_path();
                    return Err(anyhow!(
                        "Failed to replace {}: {}. Recovery failed: {}. Backups kept at {}",
                        destination.display(),
                        err,
                        rollback_errors.join("; "),
                        backup_path.display()
                    ));
                }
                return Err(err).with_context(|| {
                    format!(
                    "Failed to replace {}. Previous files restored. Close Resonite before updating",
                    destination.display())
                });
            }
        }
        Ok(())
    }

    /// ResoniteModLoaderをアンインストール
    pub fn uninstall(&self) -> Result<String> {
        let _guard = RML_FILES_LOCK
            .lock()
            .map_err(|_| anyhow!("RML file lock poisoned"))?;
        let libraries_path = self.game_path.join("Libraries");
        let mod_loader_dll = libraries_path.join("ResoniteModLoader.dll");
        let rml_libs_path = self.game_path.join("rml_libs");

        // ファイルを削除
        if mod_loader_dll.exists() {
            fs::remove_file(&mod_loader_dll)?;
        }

        // rml_libsディレクトリを削除
        if rml_libs_path.exists() {
            fs::remove_dir_all(&rml_libs_path)?;
        }

        // rml_modsディレクトリは残す（ユーザーのMODがある可能性）

        Ok("ResoniteModLoaderをアンインストールしました".to_string())
    }

    /// 起動引数にModLoaderの読み込みを追加する必要があるかチェック
    pub fn needs_launch_arg_update(&self, current_args: &[String]) -> bool {
        let required_arg = "-LoadAssembly";
        let required_value = "%GAME_DIR%/Libraries/ResoniteModLoader.dll";

        // 現在の引数に既に含まれているかチェック
        for (i, arg) in current_args.iter().enumerate() {
            if arg == required_arg {
                if i + 1 < current_args.len() && current_args[i + 1] == required_value {
                    return false; // 既に正しく設定されている
                }
            }
        }
        true // 追加が必要
    }

    /// 起動引数にModLoader用の引数を追加
    pub fn add_launch_args(&self, current_args: &mut Vec<String>) {
        if self.needs_launch_arg_update(current_args) {
            current_args.push("-LoadAssembly".to_string());
            current_args.push("%GAME_DIR%/Libraries/ResoniteModLoader.dll".to_string());
        }
    }

    /// 起動引数からModLoader用の引数を除去
    pub fn remove_launch_args(&self, current_args: &mut Vec<String>) {
        let mut i = 0;
        while i < current_args.len() {
            if current_args[i] == "-LoadAssembly"
                && i + 1 < current_args.len()
                && current_args[i + 1] == "%GAME_DIR%/Libraries/ResoniteModLoader.dll"
            {
                current_args.remove(i);
                current_args.remove(i); // 次の要素も削除
            } else {
                i += 1;
            }
        }
    }

    /// GitHubから最新リリース情報を取得
    async fn get_latest_release(&self) -> Result<GitHubRelease> {
        Self::fetch_release(&format!("{}/latest", GITHUB_API_URL)).await
    }

    async fn fetch_release(url: &str) -> Result<GitHubRelease> {
        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("User-Agent", "ResoniteTools")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to fetch release info: {}",
                response.status()
            ));
        }

        let release: GitHubRelease = response.json().await?;
        Ok(release)
    }

    /// ファイルをダウンロード
    async fn download_file(&self, url: &str, destination: &Path) -> Result<()> {
        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("User-Agent", "ResoniteTools")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download file: {}", response.status()));
        }

        let bytes = response.bytes().await?;
        fs::write(destination, bytes)?;
        Ok(())
    }

    fn read_installed_version(&self) -> Option<String> {
        let version_path = self.game_path.join("rml_libs").join(RML_VERSION_FILE);
        fs::read_to_string(version_path)
            .ok()
            .map(|version| version.trim().to_string())
            .filter(|version| !version.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    async fn respond(
        listener: &tokio::net::TcpListener,
        expected_path: &str,
        status: &str,
        body: &str,
    ) {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = vec![0; 4096];
        let count = socket.read(&mut request).await.unwrap();
        assert!(String::from_utf8_lossy(&request[..count])
            .starts_with(&format!("GET {} HTTP/1.1", expected_path)));
        let response = format!("HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", status, body.len(), body);
        socket.write_all(response.as_bytes()).await.unwrap();
    }

    #[tokio::test]
    async fn rml_change_version_downloads_selected_older_release_and_its_harmony() {
        let game = installed_game();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let metadata = serde_json::json!({
            "tag_name": "4.2.0", "assets": [
                { "name": "ResoniteModLoader.dll", "browser_download_url": format!("{}/4.2.0/rml", base) },
                { "name": "0Harmony.dll", "browser_download_url": format!("{}/4.2.0/harmony", base) }
            ]
        }).to_string();
        let server = tokio::spawn(async move {
            respond(&listener, "/releases/tags/4.2.0", "200 OK", &metadata).await;
            respond(&listener, "/4.2.0/rml", "200 OK", "older-rml").await;
            respond(&listener, "/4.2.0/harmony", "200 OK", "matching-harmony").await;
        });
        let loader = ModLoader::new(game.path().to_path_buf());
        assert_eq!(
            loader
                .change_version_from("4.2.0", &format!("{}/releases", base))
                .await
                .unwrap(),
            "4.2.0"
        );
        server.await.unwrap();
        assert_eq!(
            loader.get_status().unwrap().version.as_deref(),
            Some("4.2.0")
        );
        assert_eq!(
            fs::read(game.path().join("Libraries/ResoniteModLoader.dll")).unwrap(),
            b"older-rml"
        );
        assert_eq!(
            fs::read(game.path().join("rml_libs/0Harmony.dll")).unwrap(),
            b"matching-harmony"
        );
        assert_eq!(
            fs::read(game.path().join("rml_libs/SixLabors.ImageSharp.dll")).unwrap(),
            b"dependency"
        );
    }

    #[tokio::test]
    async fn rml_change_version_does_not_fall_back_when_release_is_missing_or_mismatched() {
        for status in ["404 Not Found", "200 OK"] {
            let game = installed_game();
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let base = format!("http://{}/releases", listener.local_addr().unwrap());
            let server = tokio::spawn(async move {
                respond(
                    &listener,
                    "/releases/tags/4.2.0",
                    status,
                    r#"{"tag_name":"5.0.3","assets":[]}"#,
                )
                .await;
            });
            assert!(ModLoader::new(game.path().to_path_buf())
                .change_version_from("4.2.0", &base)
                .await
                .is_err());
            server.await.unwrap();
            assert_old_release(game.path());
        }
    }

    #[tokio::test]
    async fn rml_change_version_lists_older_pages_and_marks_incomplete_releases() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}/releases", listener.local_addr().unwrap());
        let mut first_page: Vec<_> = (0..100)
            .map(|index| {
                serde_json::json!({
                    "tag_name": format!("version-{}", index), "assets": [], "draft": index == 1
                })
            })
            .collect();
        first_page[0]["assets"] = serde_json::json!([
            { "name": "ResoniteModLoader.dll", "browser_download_url": "unused" },
            { "name": "0Harmony.dll", "browser_download_url": "unused" }
        ]);
        let second_page = serde_json::json!([
            { "tag_name": "older-preview", "prerelease": true, "assets": first_page[0]["assets"] },
            { "tag_name": "oldest", "assets": [] }
        ]);
        let server = tokio::spawn(async move {
            respond(
                &listener,
                "/releases?per_page=100&page=1",
                "200 OK",
                &serde_json::to_string(&first_page).unwrap(),
            )
            .await;
            respond(
                &listener,
                "/releases?per_page=100&page=2",
                "200 OK",
                &second_page.to_string(),
            )
            .await;
        });
        let versions = ModLoader::get_versions_from(&base).await.unwrap();
        server.await.unwrap();
        assert_eq!(versions.len(), 101);
        assert!(versions[0].installable);
        assert!(!versions[1].installable);
        assert!(!versions.iter().any(|v| v.version == "version-1"));
        assert!(versions[99].prerelease && versions[99].installable);
        assert_eq!(versions[99].version, "older-preview");
        assert_eq!(versions[100].version, "oldest");
    }

    #[tokio::test]
    async fn rml_change_version_rejects_empty_selection_without_touching_files() {
        let game = installed_game();
        let loader = ModLoader::new(game.path().to_path_buf());
        for version in ["", " ", ".", ".."] {
            assert!(loader
                .change_version(version)
                .await
                .unwrap_err()
                .to_string()
                .contains("Select an RML release"));
        }
        assert_old_release(game.path());
    }

    fn installed_game() -> tempfile::TempDir {
        let game = tempfile::tempdir().unwrap();
        for directory in ["Libraries", "rml_libs", "rml_mods", "rml_config"] {
            fs::create_dir(game.path().join(directory)).unwrap();
        }
        for (path, content) in [
            ("Libraries/ResoniteModLoader.dll", "old-rml"),
            ("rml_libs/0Harmony.dll", "old-harmony"),
            ("rml_libs/.resonite_mod_loader_version", "5.0.1"),
            ("rml_libs/SixLabors.ImageSharp.dll", "dependency"),
            ("rml_mods/Example.dll", "mod"),
            ("rml_config/Example.json", "settings"),
        ] {
            fs::write(game.path().join(path), content).unwrap();
        }
        game
    }

    fn assert_old_release(game: &Path) {
        assert_eq!(
            fs::read(game.join("Libraries/ResoniteModLoader.dll")).unwrap(),
            b"old-rml"
        );
        assert_eq!(
            fs::read(game.join("rml_libs/0Harmony.dll")).unwrap(),
            b"old-harmony"
        );
        assert_eq!(
            fs::read(game.join("rml_libs").join(RML_VERSION_FILE)).unwrap(),
            b"5.0.1"
        );
    }

    async fn release_server(harmony_status: &str) -> (GitHubRelease, tokio::task::JoinHandle<()>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let harmony_status = harmony_status.to_owned();
        let server = tokio::spawn(async move {
            for (status, body) in [
                ("200 OK", "new-rml"),
                (harmony_status.as_str(), "new-harmony"),
            ] {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = vec![0; 4096];
                socket.read(&mut request).await.unwrap();
                let response = format!(
                    "HTTP/1.1 {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                );
                socket.write_all(response.as_bytes()).await.unwrap();
            }
        });
        let release = GitHubRelease {
            tag_name: "5.0.3".to_string(),
            assets: ["ResoniteModLoader.dll", "0Harmony.dll"]
                .iter()
                .map(|name| GitHubAsset {
                    name: name.to_string(),
                    browser_download_url: format!("http://{}/{}", address, name),
                })
                .collect(),
            ..Default::default()
        };
        (release, server)
    }

    #[tokio::test]
    async fn rml_update_unknown_version_preserves_mods_and_dependencies() {
        let game = installed_game();
        fs::remove_file(game.path().join("rml_libs").join(RML_VERSION_FILE)).unwrap();
        let loader = ModLoader::new(game.path().to_path_buf());
        assert!(loader.get_status().unwrap().version.is_none());
        let (release, server) = release_server("200 OK").await;
        loader.install_release(&release).await.unwrap();
        server.await.unwrap();
        assert_eq!(
            loader.get_status().unwrap().version.as_deref(),
            Some("5.0.3")
        );
        for (path, expected) in [
            ("Libraries/ResoniteModLoader.dll", "new-rml"),
            ("rml_libs/0Harmony.dll", "new-harmony"),
            ("rml_libs/SixLabors.ImageSharp.dll", "dependency"),
            ("rml_mods/Example.dll", "mod"),
            ("rml_config/Example.json", "settings"),
        ] {
            assert_eq!(
                fs::read_to_string(game.path().join(path)).unwrap(),
                expected
            );
        }
        assert_eq!(fs::read_dir(game.path()).unwrap().count(), 4);
    }

    #[tokio::test]
    async fn rml_update_failed_second_download_keeps_old_release() {
        let game = installed_game();
        let (release, server) = release_server("503 Service Unavailable").await;
        assert!(ModLoader::new(game.path().to_path_buf())
            .install_release(&release)
            .await
            .is_err());
        server.await.unwrap();
        assert_old_release(game.path());
        assert_eq!(fs::read_dir(game.path()).unwrap().count(), 4);
    }

    #[tokio::test]
    async fn rml_update_missing_harmony_keeps_old_release() {
        let game = installed_game();
        let release = GitHubRelease {
            tag_name: "5.0.3".to_string(),
            assets: vec![GitHubAsset {
                name: "ResoniteModLoader.dll".to_string(),
                browser_download_url: "http://127.0.0.1:1/not-requested".to_string(),
            }],
            ..Default::default()
        };
        let err = ModLoader::new(game.path().to_path_buf())
            .install_release(&release)
            .await
            .unwrap_err();
        assert!(err.to_string().contains("0Harmony.dll"));
        assert_old_release(game.path());
    }

    #[test]
    fn rml_update_failed_version_commit_rolls_back_both_dlls() {
        let game = installed_game();
        let staging = tempfile::tempdir_in(game.path()).unwrap();
        fs::write(staging.path().join("ResoniteModLoader.dll"), "new-rml").unwrap();
        fs::write(staging.path().join("0Harmony.dll"), "new-harmony").unwrap();
        // Missing staged marker forces failure after both DLL replacements.
        assert!(ModLoader::new(game.path().to_path_buf())
            .apply_staged_release(staging)
            .is_err());
        assert_old_release(game.path());
    }

    #[tokio::test]
    async fn rml_update_requires_an_installed_loader() {
        let game = tempfile::tempdir().unwrap();
        assert!(ModLoader::new(game.path().to_path_buf())
            .change_version("5.0.3")
            .await
            .unwrap_err()
            .to_string()
            .contains("not installed"));
        assert_eq!(fs::read_dir(game.path()).unwrap().count(), 0);
    }

    #[cfg(windows)]
    #[test]
    fn rml_update_locked_harmony_restores_rml() {
        use std::os::windows::fs::OpenOptionsExt;
        let game = installed_game();
        let staging = tempfile::tempdir_in(game.path()).unwrap();
        for (name, content) in [
            ("ResoniteModLoader.dll", "new-rml"),
            ("0Harmony.dll", "new-harmony"),
            (RML_VERSION_FILE, "5.0.3"),
        ] {
            fs::write(staging.path().join(name), content).unwrap();
        }
        // Allow backup reads, but prevent replacement as a loaded DLL would.
        let _locked = fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(game.path().join("rml_libs/0Harmony.dll"))
            .unwrap();
        assert!(ModLoader::new(game.path().to_path_buf())
            .apply_staged_release(staging)
            .is_err());
        assert_old_release(game.path());
    }
}
