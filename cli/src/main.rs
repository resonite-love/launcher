use clap::{App, Arg, SubCommand};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::{self};
use std::io::{self, Write};
use std::path::Path;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};

#[derive(Serialize, Deserialize, Debug)]
struct Profile {
    name: String,
    description: String,
    args: Vec<String>,
}

impl Profile {
    fn new(name: &str, full_profile_path: &Path) -> Self {
        // データパスの絶対パスを取得
        let data_path = full_profile_path.join("DataPath");

        Profile {
            name: name.to_string(),
            description: String::new(),
            args: vec![
                "-SkipIntroTutorial".to_string(),
                "-DataPath".to_string(),
                data_path.to_string_lossy().to_string(),
            ],
        }
    }

    fn save(&self, profile_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = profile_dir.join("launchconfig.json");
        let json = serde_json::to_string_pretty(self)?;
        fs::write(config_path, json)?;
        Ok(())
    }

    fn load(profile_dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = profile_dir.join("launchconfig.json");
        let json = fs::read_to_string(config_path)?;
        let profile: Profile = serde_json::from_str(&json)?;
        Ok(profile)
    }
}

fn check_steamcmd_exists() -> Result<(), Box<dyn std::error::Error>> {
    // Get the directory where the executable is located
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;

    // Build the path to steamcmd directory and executable
    let steamcmd_dir = exe_dir.join("steamcmd");
    let steamcmd_exe = if cfg!(target_os = "windows") {
        steamcmd_dir.join("steamcmd.exe")
    } else {
        steamcmd_dir.join("steamcmd")
    };

    // Check if steamcmd directory exists
    if !steamcmd_dir.exists() {
        return Err(format!(
            "steamcmd directory not found: {}. Please create it and install steamcmd there.",
            steamcmd_dir.display()
        )
        .into());
    }

    // Check if steamcmd executable exists
    if !steamcmd_exe.exists() {
        return Err(format!(
            "steamcmd executable not found: {}. Please install steamcmd in the correct location.",
            steamcmd_exe.display()
        )
        .into());
    }

    Ok(())
}

struct ResoniteInstall {
    install_dir: String,
    branch: String,
    username: Option<String>,
    password: Option<String>,
    auth_code: Option<String>, // Steam Guard コード
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Check if steamcmd exists in the expected location
    check_steamcmd_exists()?;

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
            let install_dir = determine_install_path(sub_m.value_of("path"), &branch)?;

            let install = ResoniteInstall {
                install_dir,
                branch,
                username: sub_m.value_of("username").map(String::from),
                password: sub_m.value_of("password").map(String::from),
                auth_code: sub_m.value_of("auth_code").map(String::from),
            };
            install_resonite(&install)?;
        }
        ("update", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let install_dir = determine_install_path(sub_m.value_of("path"), &branch)?;

            let install = ResoniteInstall {
                install_dir,
                branch,
                username: sub_m.value_of("username").map(String::from),
                password: sub_m.value_of("password").map(String::from),
                auth_code: sub_m.value_of("auth_code").map(String::from),
            };
            update_resonite(&install)?;
        }
        ("check", Some(sub_m)) => {
            let branch = sub_m.value_of("branch").unwrap_or("release").to_string();
            let install_dir = determine_install_path(sub_m.value_of("path"), &branch)?;

            let install = ResoniteInstall {
                install_dir,
                branch,
                username: sub_m.value_of("username").map(String::from),
                password: sub_m.value_of("password").map(String::from),
                auth_code: sub_m.value_of("auth_code").map(String::from),
            };
            check_resonite_updates(&install)?;
        }
        ("steamlogin", Some(sub_m)) => {
            let username = sub_m.value_of("username").unwrap();
            interactive_steam_login(username)?;
        }
        ("profiles", Some(profiles_m)) => match profiles_m.subcommand() {
            ("new", Some(new_m)) => {
                let profile_name = new_m.value_of("name").unwrap();
                create_profile(profile_name)?;
            }
            ("list", Some(_)) => {
                list_profiles()?;
            }
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
            launch_resonite(branch, profile_name)?;
        }
        _ => {
            println!("No command specified. Use --help for usage information.");
        }
    }

    Ok(())
}

fn create_profile(name: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Get profiles directory path
    let profile_dir = get_profiles_dir()?;
    let specific_profile_dir = profile_dir.join(name);

    // Check if profile already exists
    if specific_profile_dir.exists() {
        return Err(format!("Profile '{}' already exists", name).into());
    }

    // Create profile directory
    fs::create_dir_all(&specific_profile_dir)?;

    // Create DataPath directory
    let data_path_dir = specific_profile_dir.join("DataPath");
    fs::create_dir_all(&data_path_dir)?;

    // Create new profile with the full profile path
    let profile = Profile::new(name, &specific_profile_dir);

    // Save profile to JSON file
    profile.save(&specific_profile_dir)?;

    println!(
        "Profile '{}' created successfully at {}",
        name,
        specific_profile_dir.display()
    );
    println!("Data directory: {}", data_path_dir.display());
    println!("You can edit the launchconfig.json file to customize launch arguments.");

    Ok(())
}

fn list_profiles() -> Result<(), Box<dyn std::error::Error>> {
    let profiles_dir = get_profiles_dir()?;

    if !profiles_dir.exists() {
        println!("No profiles found. Create one with 'profiles new <n>'");
        return Ok(());
    }

    let entries = fs::read_dir(profiles_dir)?;
    let mut found = false;

    println!("Available profiles:");

    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            let profile_dir = entry.path();
            let config_path = profile_dir.join("launchconfig.json");

            if config_path.exists() {
                match Profile::load(&profile_dir) {
                    Ok(profile) => {
                        println!("  - {} : {}", profile.name, profile.description);
                        found = true;
                    }
                    Err(_) => {
                        println!(
                            "  - {} : [Invalid profile configuration]",
                            entry.file_name().to_string_lossy()
                        );
                        found = true;
                    }
                }
            }
        }
    }

    if !found {
        println!("No profiles found. Create one with 'profiles new <n>'");
    }

    Ok(())
}

fn launch_resonite(branch: &str, profile_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Check branch
    if branch != "release" && branch != "prerelease" {
        return Err(format!(
            "Invalid branch '{}'. Must be 'release' or 'prerelease'",
            branch
        )
        .into());
    }

    // Load profile
    let profiles_dir = get_profiles_dir()?;
    let profile_dir = profiles_dir.join(profile_name);

    if !profile_dir.exists() {
        return Err(format!("Profile '{}' not found", profile_name).into());
    }

    let profile = Profile::load(&profile_dir)?;

    // Get Resonite executable path
    let resonite_path = find_resonite_executable(branch)?;

    // Make sure DataPath directory exists
    let data_path = profile_dir.join("DataPath");
    if !data_path.exists() {
        fs::create_dir_all(&data_path)?;
        println!("Created data directory: {}", data_path.display());
    }

    println!(
        "Launching Resonite ({} branch) with profile '{}'",
        branch, profile_name
    );
    println!("Executable: {}", resonite_path.display());
    println!("Arguments: {:?}", profile.args);

    // Launch Resonite
    Command::new(resonite_path).args(&profile.args).spawn()?;

    // Don't wait for Resonite to exit
    println!("Resonite launched successfully!");

    Ok(())
}

fn get_profiles_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;

    Ok(exe_dir.join("profiles"))
}

fn find_resonite_executable(branch: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;

    let branch_dir = exe_dir.join(branch);
    let resonite_exe = branch_dir.join("Resonite.exe");

    if !resonite_exe.exists() {
        return Err(format!(
            "Resonite executable not found at {}. Please install it first.",
            resonite_exe.display()
        )
        .into());
    }

    Ok(resonite_exe)
}

fn interactive_steam_login(username: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!("Interactive Steam login for user: {}", username);
    println!("This will save your credentials for future use.");
    println!("You will be prompted for your password and Steam Guard code.");

    // Get the directory where the executable is located
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;

    // Build the path to steamcmd
    let steamcmd_path = if cfg!(target_os = "windows") {
        exe_dir.join("steamcmd").join("steamcmd.exe")
    } else {
        exe_dir.join("steamcmd").join("steamcmd")
    };

    // Prepare the login command
    let args = vec![
        "+login".to_string(),
        username.to_string(),
        "+quit".to_string(), // 自動終了コマンドを追加
    ];

    // Run steamcmd with the login command in interactive mode
    let mut cmd = Command::new(&steamcmd_path)
        .args(&args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;

    // Wait for the command to complete
    let status = cmd.wait()?;

    if status.success() {
        println!("\nLogin successful! Your credentials have been saved by steamcmd.");
        println!("You can now use other commands without specifying login details.");
    } else {
        println!("\nLogin failed. Please try again.");
        return Err("Steam login failed".into());
    }

    Ok(())
}

fn build_login_args(install: &ResoniteInstall) -> Vec<String> {
    let mut args = Vec::new();

    args.push("+login".to_string());

    match (&install.username, &install.password) {
        (Some(username), Some(password)) => {
            args.push(username.clone());
            args.push(password.clone());

            // Steam Guardコードが提供されている場合はそれを追加
            if let Some(auth_code) = &install.auth_code {
                args.push(auth_code.clone());
            }
        }
        (Some(username), None) => {
            args.push(username.clone());
            // パスワードが提供されていない場合、steamcmdはパスワードの入力を求めます

            // Steam Guardコードが提供されている場合はそれを追加
            if let Some(auth_code) = &install.auth_code {
                // パスワードの入力後にコードが求められるため、ここでは効果がない可能性があります
                args.push("password_placeholder".to_string()); // ダミーパスワード
                args.push(auth_code.clone());
                println!("警告: パスワードなしでSteam GuardコードをCLIに直接渡すことはできない場合があります。");
                println!("      対話的なプロンプトが表示された場合は、パスワードとSteam Guardコードを入力してください。");
            }
        }
        _ => {
            // 認証情報が提供されていない場合は匿名ログインにフォールバックします
            args.push("anonymous".to_string());
        }
    }

    args
}

fn determine_install_path(
    path_arg: Option<&str>,
    branch: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    if let Some(path) = path_arg {
        Ok(path.to_string())
    } else {
        // Get the directory where the executable is located
        let current_exe = env::current_exe()?;
        let exe_path = current_exe
            .parent()
            .ok_or("Could not determine executable directory")?;

        // Create a subdirectory with the branch name
        let install_path = exe_path.join(branch);
        Ok(install_path.to_string_lossy().to_string())
    }
}

fn install_resonite(install: &ResoniteInstall) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "Installing Resonite {} branch to {}",
        install.branch, install.install_dir
    );

    // Create the installation directory if it doesn't exist
    let path = Path::new(&install.install_dir);
    if !path.exists() {
        fs::create_dir_all(path)?;
    }

    // Build the steamcmd command
    let mut args = build_login_args(install);

    args.append(&mut vec![
        "+force_install_dir".to_string(),
        install.install_dir.clone(),
        "+app_update".to_string(),
        "2519830".to_string(),
    ]);

    // Add branch if prerelease
    if install.branch == "prerelease" {
        args.push("-beta".to_string());
        args.push("prerelease".to_string());
    }

    // Add validation and quit commands
    args.push("validate".to_string());
    args.push("+quit".to_string());

    // Run steamcmd
    let output = run_steamcmd(&args)?;

    // Process output
    if output.status.success() {
        println!("Installation successful!");
    } else {
        println!("Installation failed!");
        io::stdout().write_all(&output.stdout)?;
        io::stderr().write_all(&output.stderr)?;
    }

    Ok(())
}

fn update_resonite(install: &ResoniteInstall) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "Updating Resonite {} branch in {}",
        install.branch, install.install_dir
    );

    // The update command is the same as the install command for steamcmd
    // Build the steamcmd command
    let mut args = build_login_args(install);

    args.append(&mut vec![
        "+force_install_dir".to_string(),
        install.install_dir.clone(),
        "+app_update".to_string(),
        "2519830".to_string(),
    ]);

    // Add branch if prerelease
    if install.branch == "prerelease" {
        args.push("-beta".to_string());
        args.push("prerelease".to_string());
    }

    // Add validation and quit commands
    args.push("validate".to_string());
    args.push("+quit".to_string());

    // Run steamcmd
    let output = run_steamcmd(&args)?;

    // Process output
    if output.status.success() {
        println!("Update successful!");

        // Check if any files were updated
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("already up to date") {
            println!("Resonite is already up to date.");
        } else {
            println!("Resonite files were updated.");
        }
    } else {
        println!("Update failed!");
        io::stdout().write_all(&output.stdout)?;
        io::stderr().write_all(&output.stderr)?;
    }

    Ok(())
}

fn check_resonite_updates(install: &ResoniteInstall) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "Checking updates for Resonite {} branch in {}",
        install.branch, install.install_dir
    );

    // Build the steamcmd command with -verify_only option
    let mut args = build_login_args(install);

    args.append(&mut vec![
        "+force_install_dir".to_string(),
        install.install_dir.clone(),
        "+app_update".to_string(),
        "2519830".to_string(),
        "-verify_only".to_string(),
    ]);

    // Add branch if prerelease
    if install.branch == "prerelease" {
        args.push("-beta".to_string());
        args.push("prerelease".to_string());
    }

    // Add quit command
    args.push("+quit".to_string());

    // Run steamcmd
    let output = run_steamcmd(&args)?;

    // Process output
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Check for update indicators in output
        if stdout.contains("already up to date") {
            println!("Resonite is up to date. No updates available.");
        } else if stdout.contains("update will be") || stdout.contains("downloading") {
            println!("Updates are available for Resonite.");

            // Try to extract version information using regex
            let re = Regex::new(r"Update to ([\d\.]+)")?;
            if let Some(caps) = re.captures(&stdout) {
                println!("Available version: {}", &caps[1]);
            }
        } else {
            println!("Could not determine update status. Check the full output:");
            io::stdout().write_all(&output.stdout)?;
        }
    } else {
        println!("Check failed!");
        io::stdout().write_all(&output.stdout)?;
        io::stderr().write_all(&output.stderr)?;
    }

    Ok(())
}

fn run_steamcmd(args: &[String]) -> Result<Output, Box<dyn std::error::Error>> {
    // Get the directory where the executable is located
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Could not determine executable directory")?;

    // Build the path to steamcmd
    let steamcmd_path = if cfg!(target_os = "windows") {
        exe_dir.join("steamcmd").join("steamcmd.exe")
    } else {
        exe_dir.join("steamcmd").join("steamcmd")
    };

    println!("Using steamcmd path: {}", steamcmd_path.display());

    // Run steamcmd with the provided arguments
    let output = Command::new(steamcmd_path).args(args).output()?;

    Ok(output)
}
