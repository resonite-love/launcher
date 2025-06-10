# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build Commands
```bash
# Build all components
cargo build --release

# Build CLI only
cargo build --release -p resonite-manager

# Build GUI only
cargo build --release -p resonite-tools-gui

# Run CLI
./target/release/resonite-manager

# Run GUI
./target/release/resonite-tools-gui
```

### Development Commands
```bash
# Run CLI in debug mode
cargo run -p resonite-manager

# Run GUI in debug mode
cargo run -p resonite-tools-gui

# Check all code
cargo check

# Run tests (if available)
cargo test
```

## Architecture

This is a Rust workspace project for managing Resonite VR installations via SteamCMD. The project is structured as:

### Core Components
- **lib/**: Core library (`resonite-tools-lib`) containing all business logic
- **cli/**: Command-line interface (`resonite-manager`) using clap for argument parsing
- **gui/**: Desktop GUI application (`resonite-tools-gui`) using egui/eframe

### Key Library Modules
- `install.rs`: Handles Resonite installation, updates, and launch via SteamCMD
- `profile.rs`: Manages launch profiles with JSON configuration files
- `steamcmd.rs`: SteamCMD wrapper for Steam authentication and app management
- `utils.rs`: Common utilities and helper functions

### Data Flow
1. Both CLI and GUI depend on the shared library
2. Library communicates with SteamCMD for installation/updates
3. Profiles are stored as JSON files in subdirectories
4. GUI provides real-time UI updates with error handling

### Dependencies
- Uses SteamCMD located at `<executable_dir>/steamcmd/steamcmd.exe`
- CLI uses clap v2.33 for argument parsing
- GUI uses egui v0.22 with Japanese font support (Noto Sans JP)
- Serialization handled via serde with JSON

### Profile Management
- Profiles stored in `<executable_dir>/profiles/<profile_name>/`
- Each profile has `launchconfig.json` and `DataPath/` directory
- Default profile includes `-SkipIntroTutorial` and `-DataPath` arguments

### Branch Support
- Supports both "release" and "prerelease" branches
- Default installation paths: `<executable_dir>/<branch_name>/`