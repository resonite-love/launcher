use std::path::{Path, PathBuf};
use std::error::Error;
use std::env;

/// 実行可能ファイルのディレクトリを取得する
pub fn get_executable_directory() -> Result<PathBuf, Box<dyn Error>> {
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;
    
    Ok(exe_dir.to_path_buf())
}

/// ブランチ名が有効かチェックする
pub fn validate_branch(branch: &str) -> Result<(), Box<dyn Error>> {
    if branch != "release" && branch != "prerelease" {
        return Err(format!(
            "Invalid branch '{}'. Must be 'release' or 'prerelease'",
            branch
        )
        .into());
    }
    Ok(())
}

/// ディレクトリが存在することを確認し、なければ作成する
pub fn ensure_directory_exists(path: &Path) -> Result<(), Box<dyn Error>> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}
