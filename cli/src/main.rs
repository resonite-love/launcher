use clap::{App, Arg, SubCommand};

use reso_launcher_lib::{
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::ProfileManager,
    depotdownloader::DepotDownloader,
    utils,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 実行可能ファイルのディレクトリを取得
    let exe_dir = utils::get_executable_directory()?;

    // DepotDownloaderの初期化
    let depot_downloader = DepotDownloader::with_default_path(&exe_dir);

    // DepotDownloaderの存在確認
    depot_downloader.check_exists()?;

    // プロファイルマネージャの初期化
    let profile_manager = ProfileManager::new(&exe_dir);

    // インストールマネージャの初期化
    let install_manager = ResoniteInstallManager::new(&exe_dir);

    let matches = App::new("RESO Launcher CLI")
        .version("1.0.1")
        .author("resonite.love community")
        .about("RESO Launcher CLI - Community Resonite management tool")
        .subcommand(
            SubCommand::with_name("install")
                .about("Installs or updates Resonite")
                .arg(
                    Arg::with_name("branch")
                        .help("Branch to install: 'release' or 'prerelease' (default: release)")
                        .takes_value(true)
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("username")
                        .short("u")
                        .long("username")
                        .help("Steam username")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("password")
                        .short("p")
                        .long("password")
                        .help("Steam password")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("auth_code")
                        .short("a")
                        .long("auth-code")
                        .help("Steam Guard authentication code")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("update")
                .about("Updates an existing Resonite installation")
                .arg(
                    Arg::with_name("branch")
                        .help("Branch to update: 'release' or 'prerelease' (default: release)")
                        .takes_value(true)
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("username")
                        .short("u")
                        .long("username")
                        .help("Steam username")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("password")
                        .short("p")
                        .long("password")
                        .help("Steam password")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("auth_code")
                        .short("a")
                        .long("auth-code")
                        .help("Steam Guard authentication code")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("check")
                .about("Checks if updates are available")
                .arg(
                    Arg::with_name("branch")
                        .help("Branch to check: 'release' or 'prerelease' (default: release)")
                        .takes_value(true)
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("username")
                        .short("u")
                        .long("username")
                        .help("Steam username")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("password")
                        .short("p")
                        .long("password")
                        .help("Steam password")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("auth_code")
                        .short("a")
                        .long("auth-code")
                        .help("Steam Guard authentication code")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("steamlogin")
                .about("Interactive login to Steam (saves credentials for future use)")
                .arg(
                    Arg::with_name("username")
                        .short("u")
                        .long("username")
                        .help("Steam username")
                        .takes_value(true)
                        .required(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("profiles")
                .about("Manage launch profiles")
                .subcommand(
                    SubCommand::with_name("new")
                        .about("Create a new profile")
                        .arg(Arg::with_name("name").help("Profile name").required(true)),
                )
                .subcommand(SubCommand::with_name("list").about("List all profiles"))
                .subcommand(
                    SubCommand::with_name("edit")
                        .about("Edit a profile (not implemented yet)")
                        .arg(Arg::with_name("name").help("Profile name").required(true)),
                ),
        )
        .subcommand(
            SubCommand::with_name("launch")
                .about("Launch Resonite with a profile")
                .arg(
                    Arg::with_name("branch")
                        .help("Branch to launch: 'release' or 'prerelease' (default: release)")
                        .takes_value(true)
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("profile")
                        .short("p")
                        .long("profile")
                        .help("Profile to use for launch")
                        .takes_value(true)
                        .required(true),
                ),
        )
        .get_matches();

    match matches.subcommand() {
        ("install", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let profile_name = format!("default_{}", branch);

            let install = ResoniteInstall::new(
                profile_name,
                branch,
                None,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
            );
            install.install(&depot_downloader, &profile_manager)?;
        }
        ("update", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let profile_name = format!("default_{}", branch);

            let install = ResoniteInstall::new(
                profile_name,
                branch,
                None,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
            );
            install.update(&depot_downloader, &profile_manager)?;
        }
        ("check", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let profile_name = format!("default_{}", branch);

            let install = ResoniteInstall::new(
                profile_name,
                branch,
                None,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
            );
            let has_updates = install.check_updates(&depot_downloader, &profile_manager)?;
            if has_updates {
                println!("Updates are available for Resonite.");
            } else {
                println!("Resonite is up to date.");
            }
        }
        ("steamlogin", Some(sub_m)) => {
            let username = sub_m.value_of("username").unwrap();
            depot_downloader.interactive_login(username)?;
        }
        ("profiles", Some(profiles_m)) => match profiles_m.subcommand() {
            ("new", Some(new_m)) => {
                let profile_name = new_m.value_of("name").unwrap();
                match profile_manager.create_profile(profile_name) {
                    Ok(profile) => {
                        println!(
                            "Profile '{}' created successfully with description: '{}'",
                            profile.name, profile.description
                        );
                    }
                    Err(e) => {
                        eprintln!("Failed to create profile: {}", e);
                    }
                }
            }
            ("list", Some(_)) => match profile_manager.list_profiles() {
                Ok(profiles) => {
                    if profiles.is_empty() {
                        println!("No profiles found. Create one with 'profiles new <name>'");
                    } else {
                        println!("Available profiles:");
                        for profile in profiles {
                            println!("  - {} : {}", profile.name, profile.description);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to list profiles: {}", e);
                }
            },
            ("edit", Some(_)) => {
                println!("Profile editing is not implemented yet. Please edit the launchconfig.json file manually.");
            }
            _ => {
                println!("Unknown profiles command. Use --help for usage information.");
            }
        },
        ("launch", Some(launch_m)) => {
            let branch = launch_m.value_of("branch").unwrap_or("release");
            let profile_name = launch_m.value_of("profile").unwrap();

            // ブランチ名の検証
            utils::validate_branch(branch)?;

            // Resoniteを起動
            install_manager.launch_with_profile(profile_name, &profile_manager)?;
        }
        _ => {
            println!("No command specified. Use --help for usage information.");
        }
    }

    Ok(())
}
