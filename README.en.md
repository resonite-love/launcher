# RESO Launcher

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/github/v/release/resonite-love/launcher)
![Downloads](https://img.shields.io/github/downloads/resonite-love/launcher/total)

[日本語](./README.md) | **English**

A community launcher for installing, updating, and managing Resonite profiles.

## ✨ Key Features

- 🚀 **Easy Installation**: Automatic Resonite installation and updates
- 👥 **Profile Management**: Multiple configuration profiles for different use cases
- 🔧 **MOD Support**: Integrated MOD loader management
- 🔄 **Auto Updates**: Automatic application self-updates
- 🎮 **Branch Support**: Switch between release and prerelease versions
- 💻 **Intuitive GUI**: Modern user interface
- 🌐 **Multi-language**: Full support for Japanese and English

## 📦 Download

### Release Version (Recommended)

Download the latest version from [Releases](https://github.com/resonite-love/launcher/releases).

#### GUI Version (Recommended)
- **Installer**: `RESO.Launcher_vX.X.X_x64_en-US.msi` - Auto-install and update support
- **Setup EXE**: `RESO.Launcher_vX.X.X_x64-setup.exe` - Lightweight installer  
- **Portable**: `reso-launcher-vX.X.X-windows-portable.exe` - Single binary, no installation required

#### CLI Version
- **Windows**: `reso-launcher-cli-vX.X.X-windows.exe` - Command-line interface

### Initial Setup

GUI version automatically handles the following on first launch:
- Automatic DepotDownloader download
- Steam credentials setup (optional)
- Basic configuration completion

### Installation Options

- **Installer Version**: System integration with auto-updates and file associations
- **Portable Version**: Portable on USB drives, no registry changes, no installation required

## 🌐 Language Support

RESO Launcher v1.4.0+ features complete internationalization (i18n):

- **Language Selection**: Switch between Japanese and English in Settings
- **Automatic Detection**: Detects browser language on first launch
- **Persistent Settings**: Language preference saved across sessions
- **Real-time Switching**: Instant language changes without restart
- **Complete Coverage**: All UI elements, buttons, and messages translated

### How to Change Language
1. Open **Settings** tab
2. Go to **Language / 言語** section  
3. Click **English** or **日本語** button
4. Interface instantly switches to selected language

## 🏗️ Project Structure

This project consists of the following components:

- **lib**: Core functionality library (`reso-launcher-lib`)
- **cli**: Command-line interface (`reso-launcher-cli`)
- **gui**: Modern desktop GUI (Tauri + React)

## 🔨 Build Instructions

### Prerequisites

- Rust and Cargo installed
- Node.js installed (for GUI build)
- DepotDownloader available (runtime)

### Compilation

```bash
# Build all components
cargo build --release

# Build CLI only
cargo build --release -p reso-launcher-cli

# Build GUI
cd gui && npm install && npm run tauri build
```

## 📋 Usage

### CLI Version

```bash
# Install Resonite
reso-launcher-cli install [--branch release|prerelease] [--path <install-path>]

# Update Resonite
reso-launcher-cli update [--branch release|prerelease] [--path <install-path>]

# Check for updates
reso-launcher-cli check [--branch release|prerelease] [--path <install-path>]

# Create profile
reso-launcher-cli profiles new <profile-name>

# List profiles
reso-launcher-cli profiles list

# Launch Resonite
reso-launcher-cli launch --profile <profile-name> [--branch release|prerelease]

# Steam login (save credentials)
reso-launcher-cli steamlogin --username <username>
```

### GUI Version

```bash
# Development mode
cd gui && npm run tauri dev

# Run built version
./target/release/reso-launcher
```

## 🔧 Dependencies

### DepotDownloader

This tool uses DepotDownloader to download Steam content.

- **Auto Download**: Automatically downloaded on first launch
- **Manual Setup**: [SteamRE/DepotDownloader](https://github.com/SteamRE/DepotDownloader/releases)
- **Location**: Place `DepotDownloader.exe` in the same directory as the executable
- **.NET Requirement**: .NET 8.0 Runtime required

## 📚 Detailed Documentation

For detailed configuration, profile management, and troubleshooting, see:

📖 **[CONFIGURATION.md](./CONFIGURATION.md)** - Detailed configuration and directory structure guide  
📚 **[TAURI_COMMANDS.md](./TAURI_COMMANDS.md)** - Tauri API command reference

### Main Contents
- Directory structure and file placement
- Detailed profile management
- Resonite installation configuration
- Launch options and customization
- Troubleshooting
- Advanced configuration and script examples

## 🤝 Contributing

RESO Launcher is a community project. We welcome bug reports, feature suggestions, and pull requests!

### Getting Involved

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 🔍 System Requirements

- **OS**: Windows 10/11 (x64)
- **Runtime**: .NET 8.0 Runtime (for DepotDownloader)
- **Disk Space**: Sufficient disk space (for Resonite installation)

## 📞 Support

- **Issue Reports**: [GitHub Issues](https://github.com/resonite-love/launcher/issues)
- **Discussions**: [GitHub Discussions](https://github.com/resonite-love/launcher/discussions)
- **Community**: [resonite.love](https://resonite.love)

## 📄 License

This project is released under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

Made with ❤️ by the [resonite.love](https://resonite.love) community