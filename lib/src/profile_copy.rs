//! Profile duplication keeps managed file paths local to the new profile.
use crate::profile::{Profile, ProfileManager};
use serde_json::Value;
use std::fs;
use std::path::{Component, Path};

pub fn duplicate_profile(
    manager: &ProfileManager,
    source_name: &str,
    new_name: &str,
    description: &str,
) -> Result<Profile, String> {
    let source = manager
        .get_profile(source_name)
        .map_err(|e| format!("Source profile not found: {}", e))?;
    if manager.get_profile(new_name).is_ok() {
        return Err(format!("Profile '{}' already exists", new_name));
    }
    let source_dir = manager.get_profile_dir(source.get_folder_name());
    let mut target = manager
        .create_profile(new_name)
        .map_err(|e| format!("Failed to create new profile: {}", e))?;
    let target_dir = manager.get_profile_dir(target.get_folder_name());
    let result = (|| {
        // Do not expose an installed profile before the complete copy succeeds.
        fs::remove_file(target_dir.join("launchconfig.json")).map_err(|e| e.to_string())?;
        copy_directory(&source_dir, &target_dir, &source_dir, &target_dir)?;
        target.description = description.to_string();
        target.args = source.args.clone();
        target.game_info = source.game_info.clone();
        target.mod_loader_type = source.mod_loader_type;
        target
            .save(&target_dir)
            .map_err(|e| format!("Failed to save copied profile: {}", e))
    })();
    if let Err(error) = result {
        return match fs::remove_dir_all(&target_dir) {
            Ok(()) => Err(error),
            Err(cleanup) => Err(format!(
                "{}. Could not clean up incomplete copy '{}': {}",
                error,
                target_dir.display(),
                cleanup
            )),
        };
    }
    Ok(target)
}

fn copy_directory(
    src: &Path,
    dst: &Path,
    source_root: &Path,
    target_root: &Path,
) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Cannot create '{}': {}", dst.display(), e))?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let source_path = entry.path();
        let target_path = dst.join(&name);
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        // Following links can escape the profile or recurse back into the copy.
        if kind.is_symlink() || !(kind.is_dir() || kind.is_file()) {
            return Err(format!(
                "Cannot safely copy linked or special file '{}'",
                source_path.display()
            ));
        }
        let at_root = src == source_root;
        if at_root && metadata_name_matches(&name, "launchconfig.json") {
            continue;
        }
        if kind.is_dir() {
            copy_directory(&source_path, &target_path, source_root, target_root)?;
        } else if at_root
            && (metadata_name_matches(&name, "installed_mods.json")
                || metadata_name_matches(&name, "bepis_installed_mods.json"))
        {
            let bytes = fs::read(&source_path).map_err(|e| e.to_string())?;
            let mut value: Value = serde_json::from_slice(&bytes)
                .map_err(|e| format!("Invalid '{}': {}", source_path.display(), e))?;
            rewrite_mod_paths(
                &mut value,
                metadata_name_matches(&name, "bepis_installed_mods.json"),
                source_root,
                target_root,
            )
            .map_err(|e| format!("Invalid '{}': {}", source_path.display(), e))?;
            let bytes = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
            fs::write(&target_path, bytes).map_err(|e| e.to_string())?;
        } else {
            fs::copy(&source_path, &target_path)
                .map_err(|e| format!("Failed to copy '{}': {}", source_path.display(), e))?;
        }
    }
    Ok(())
}

// Windows resolves these filenames without ASCII case sensitivity as well.
fn metadata_name_matches(name: &std::ffi::OsStr, expected: &str) -> bool {
    #[cfg(windows)]
    {
        name.to_str()
            .map_or(false, |name| name.eq_ignore_ascii_case(expected))
    }
    #[cfg(not(windows))]
    {
        name == expected
    }
}

fn rewrite_mod_paths(
    value: &mut Value,
    bepis: bool,
    source: &Path,
    target: &Path,
) -> Result<(), String> {
    let mods = if bepis {
        value.get_mut("mods")
    } else {
        Some(value)
    }
    .and_then(Value::as_array_mut)
    .ok_or("Expected a mod list")?;
    for (index, item) in mods.iter_mut().enumerate() {
        if bepis {
            let paths = item
                .get_mut("installed_files")
                .and_then(Value::as_array_mut)
                .ok_or_else(|| format!("Mod {} has no installed_files array", index))?;
            for path in paths {
                rewrite_path(path, source, target)?;
            }
        } else {
            let path = item
                .get_mut("dll_path")
                .ok_or_else(|| format!("Mod {} has no dll_path", index))?;
            rewrite_path(path, source, target)?;
        }
    }
    Ok(())
}

fn rewrite_path(value: &mut Value, source: &Path, target: &Path) -> Result<(), String> {
    let text = value.as_str().ok_or("Managed file path must be a string")?;
    let path = Path::new(text);
    // Component-aware matching avoids confusing profiles/foo with profiles/foobar.
    // Do not guess for foreign, relative or traversing paths: that could retain
    // authority to modify another profile's files through the duplicated metadata.
    if !path.is_absolute() || path.components().any(|c| c == Component::ParentDir) {
        return Err(format!(
            "Managed file path is not a safe absolute path: '{}'",
            text
        ));
    }
    let relative = path.strip_prefix(source).map_err(|_| {
        format!(
            "Managed file path is outside the source profile: '{}'",
            text
        )
    })?;
    if relative.as_os_str().is_empty() {
        return Err("Managed file path points at the profile directory".to_string());
    }
    *value = serde_json::to_value(target.join(relative)).map_err(|e| e.to_string())?;
    Ok(())
}
