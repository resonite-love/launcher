fn main() {
    // Tell Cargo about the custom cfg flag
    println!("cargo::rustc-check-cfg=cfg(portable_build)");
    
    // Check environment variable to disable updater for portable builds
    if std::env::var("TAURI_UPDATER_ACTIVE").unwrap_or_default() == "false" {
        println!("cargo:rustc-env=TAURI_UPDATER_ACTIVE=false");
        println!("cargo:rustc-cfg=portable_build");
    }
    
    tauri_build::build()
}