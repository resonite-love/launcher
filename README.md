# Kokoa Resonite Tools

Resoniteのインストール、更新、プロファイル管理を行うためのツールセット。

## プロジェクト構成

このプロジェクトは以下のコンポーネントで構成されています：

- **lib**: コア機能を提供するライブラリ
- **cli**: コマンドラインインターフェース
- **gui**: グラフィカルユーザーインターフェース（egui）
- **tauri-gui**: モダンなデスクトップGUI（Tauri + React）

## ビルド方法

### 前提条件

- Rust と Cargo がインストールされていること
- DepotDownloader が利用可能であること（`<実行ファイルがあるディレクトリ>/DepotDownloader.exe`）

### コンパイル

```bash
# すべてのコンポーネントをビルド
cargo build --release

# CLIのみをビルド
cargo build --release -p resonite-manager

# GUIのみをビルド（egui版）
cargo build --release -p resonite-tools-gui

# Tauri GUIをビルド
cd tauri-gui && npm install && npm run tauri build
```

## 使用方法

### CLI

```
# Resoniteをインストール
resonite-manager install [--branch release|prerelease] [--path <インストールパス>]

# Resoniteを更新
resonite-manager update [--branch release|prerelease] [--path <インストールパス>]

# 更新の確認
resonite-manager check [--branch release|prerelease] [--path <インストールパス>]

# プロファイルの作成
resonite-manager profiles new <プロファイル名>

# プロファイル一覧の表示
resonite-manager profiles list

# Resoniteの起動
resonite-manager launch --profile <プロファイル名> [--branch release|prerelease]

# Steamへのログイン（認証情報の保存）
resonite-manager steamlogin --username <ユーザー名>
```

### GUI

```
# eGuiベースのGUIアプリケーションの起動
resonite-tools-gui

# TauriベースのGUIアプリケーションの起動（推奨）
cd tauri-gui && npm run tauri dev  # 開発モード
# または
./tauri-gui/src-tauri/target/release/resonite-tools-tauri  # ビルド後
```

## 依存関係

### DepotDownloader

このツールはSteamのコンテンツをダウンロードするためにDepotDownloaderを使用します。

- **ダウンロード**: [SteamRE/DepotDownloader](https://github.com/SteamRE/DepotDownloader/releases)
- **配置場所**: 実行ファイルと同じディレクトリに `DepotDownloader.exe` を配置
- **.NET要件**: .NET 8.0 Runtime が必要

### インストール手順

1. DepotDownloaderの最新リリースをダウンロード
2. `DepotDownloader.exe` をツールの実行ファイルと同じディレクトリに配置
3. .NET 8.0 Runtime がインストールされていることを確認

## ライセンス

[ライセンス情報をここに記載]
