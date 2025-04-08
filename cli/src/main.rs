use clap::{App, Arg, SubCommand};
use std::path::Path;

use resonite_tools_lib::{
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::ProfileManager,
    steamcmd::SteamCmd,
    utils,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 実行可能ファイルのディレクトリを取得
    let exe_dir = utils::get_executable_directory()?;

    // SteamCMDの初期化
    let steam_cmd = SteamCmd::with_default_path(&exe_dir);

    // SteamCMDの存在確認
    steam_cmd.check_exists()?;

    // プロファイルマネージャの初期化
    let profile_manager = ProfileManager::new(&exe_dir);

    // インストールマネージャの初期化
    let install_manager = ResoniteInstallManager::new(&exe_dir);

    let matches = App::new("Resonite Manager")
        .version("1.0")
        .author("Your Name")
        .about("Manages Resonite installations using steamcmd")
        .subcommand(
            SubCommand::with_name("install")
                .about("Installs or updates Resonite")
                .arg(
                    Arg::with_name("branch")
                        .help("Branch to install: 'release' or 'prerelease' (default: release)")
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)"),
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
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)"),
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
                        .default_value("release"),
                )
                .arg(
                    Arg::with_name("path")
                        .help("Installation path (default: exe_directory/branch_name)"),
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
            let install_dir =
                install_manager.determine_install_path(sub_m.value_of("path"), &branch);

            let install = ResoniteInstall::new(
                install_dir,
                branch,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
                sub_m.value_of("auth_code").map(String::from),
            );
            install.install(&steam_cmd)?;
        }
        ("update", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let install_dir =
                install_manager.determine_install_path(sub_m.value_of("path"), &branch);

            let install = ResoniteInstall::new(
                install_dir,
                branch,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
                sub_m.value_of("auth_code").map(String::from),
            );
            install.update(&steam_cmd)?;
        }
        ("check", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let install_dir =
                install_manager.determine_install_path(sub_m.value_of("path"), &branch);

            let install = ResoniteInstall::new(
                install_dir,
                branch,
                sub_m.value_of("username").map(String::from),
                sub_m.value_of("password").map(String::from),
                sub_m.value_of("auth_code").map(String::from),
            );
            install.check_updates(&steam_cmd)?;
        }
        ("steamlogin", Some(sub_m)) => {
            let username = sub_m.value_of("username").unwrap();
            steam_cmd.interactive_login(username)?;
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

            // プロファイルディレクトリを取得
            let profiles_dir = profile_manager.get_profiles_dir();
            let profile_dir = profiles_dir.join(profile_name);

            // Resoniteを起動
            install_manager.launch_with_profile(branch, &profile_dir)?;
        }
        _ => {
            println!("No command specified. Use --help for usage information.");
        }
    }

    Ok(())
}
