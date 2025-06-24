# Changelog

All notable changes to RESO Launcher will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.5] - 2025-06-24

### Added
- Application version display in custom title bar
- New Tauri command `get_app_version` for retrieving app version from frontend

### Fixed
- Fixed profile game installation detection logic
  - Newly created profiles now correctly show as "game not installed" instead of "installed"
  - Changed detection from checking directory existence to checking for `Resonite.exe` file
- Removed unused variables and code warnings throughout the codebase

### Changed
- Refactored lib crate by removing obsolete steamcmd module and related code
- Updated documentation to reflect DepotDownloader usage instead of steamcmd
- Improved code quality by removing dead code and unused imports

### Removed
- Removed steamcmd.rs module and all related functionality
- Removed unused struct definitions in mod_manager.rs
- Cleaned up unused imports and variables

## [1.5.4] - 2025-06-21

### Added
- Game installation logic consolidation
- Profile refresh after updates
- Enhanced debugging for tag output

### Fixed
- Release workflow improvements
- Tag processing in release pipeline

### Changed
- Improved installation management consistency across components