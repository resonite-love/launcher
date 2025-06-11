# Resonite Tools Tauri GUI

Modern desktop GUI application for Resonite Tools built with Tauri and React.

## Features

- **Cross-platform**: Works on Windows, macOS, and Linux
- **Modern UI**: React-based frontend with responsive design
- **Native performance**: Rust backend with Tauri
- **All core functionality**: Profile management, installation, updates, and launching

## Prerequisites

- **Node.js** (v16 or later)
- **Rust** and Cargo
- **DepotDownloader** binary in the same directory as the built executable

## Development

### Install dependencies

```bash
# Install frontend dependencies
npm install

# Install Tauri CLI (if not already installed)
npm install -g @tauri-apps/cli
```

### Run in development mode

```bash
# Start the development server
npm run tauri dev
```

This will:
1. Start the Vite development server for the React frontend
2. Build and run the Tauri application
3. Enable hot-reload for frontend changes

### Build for production

```bash
# Build the application
npm run tauri build
```

The built application will be available in `src-tauri/target/release/`.

## Project Structure

```
tauri-gui/
├── src/                    # React frontend source
│   ├── components/         # React components
│   ├── App.tsx            # Main React application
│   └── main.tsx           # React entry point
├── src-tauri/             # Tauri backend
│   ├── src/               # Rust backend source
│   │   └── main.rs        # Tauri application entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── package.json           # Node.js dependencies and scripts
└── vite.config.ts         # Vite configuration
```

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build frontend for production
- `npm run tauri dev` - Run Tauri application in development mode
- `npm run tauri build` - Build Tauri application for production

## Usage

1. **Initialize**: The application will automatically initialize and check for DepotDownloader
2. **Profiles**: Create and manage Resonite launch profiles
3. **Installation**: Install or update Resonite using DepotDownloader
4. **Launch**: Launch Resonite with selected profiles and branches

## Troubleshooting

### DepotDownloader not found
- Ensure `DepotDownloader.exe` is in the same directory as the built Tauri application
- Download from: https://github.com/SteamRE/DepotDownloader/releases

### Frontend development issues
- Try deleting `node_modules` and running `npm install` again
- Ensure Node.js version is v16 or later

### Backend compilation issues
- Ensure Rust is properly installed and up to date
- Check that the `resonite-tools-lib` dependency can be found