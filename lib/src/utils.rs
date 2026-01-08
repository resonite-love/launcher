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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_validate_branch_release() {
        assert!(validate_branch("release").is_ok());
    }

    #[test]
    fn test_validate_branch_prerelease() {
        assert!(validate_branch("prerelease").is_ok());
    }

    #[test]
    fn test_validate_branch_invalid() {
        assert!(validate_branch("invalid").is_err());
        assert!(validate_branch("").is_err());
        assert!(validate_branch("beta").is_err());
    }

    #[test]
    fn test_ensure_directory_exists_creates_new() {
        let temp_dir = TempDir::new().unwrap();
        let new_dir = temp_dir.path().join("new_directory");

        assert!(!new_dir.exists());
        ensure_directory_exists(&new_dir).unwrap();
        assert!(new_dir.exists());
    }

    #[test]
    fn test_ensure_directory_exists_already_exists() {
        let temp_dir = TempDir::new().unwrap();
        // TempDir自体は既に存在する
        assert!(temp_dir.path().exists());
        ensure_directory_exists(temp_dir.path()).unwrap();
        assert!(temp_dir.path().exists());
    }

    #[test]
    fn test_ensure_directory_exists_nested() {
        let temp_dir = TempDir::new().unwrap();
        let nested_dir = temp_dir.path().join("a").join("b").join("c");

        assert!(!nested_dir.exists());
        ensure_directory_exists(&nested_dir).unwrap();
        assert!(nested_dir.exists());
    }
}
