# RESO Launcher

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/github/v/release/resonite-love/launcher)
![Downloads](https://img.shields.io/github/downloads/resonite-love/launcher/total)

[English](./README.en.md) | **日本語**

Resoniteのインストール、更新、プロファイル管理を行うためのコミュニティランチャー。

## ✨ 主な機能

- 🚀 **簡単インストール**: Resoniteの自動インストール・更新
- 👥 **プロファイル管理**: 複数の設定プロファイルで用途別管理
- 🔧 **MODサポート**: MODローダーの統合管理
- 🔄 **自動更新**: アプリケーション自体の自動更新機能
- 🎮 **ブランチ対応**: releaseとprereleaseの切り替え対応
- 💻 **直感的GUI**: モダンなユーザーインターフェース

## 📦 ダウンロード

### リリース版（推奨）

最新版は [Releases](https://github.com/resonite-love/launcher/releases) からダウンロードできます。

#### GUI版（推奨）
- **インストーラー**: `RESO.Launcher_vX.X.X_x64_en-US.msi` - 自動インストール・更新対応
- **セットアップEXE**: `RESO.Launcher_vX.X.X_x64-setup.exe` - 軽量インストーラー  
- **ポータブル版**: `reso-launcher-vX.X.X-windows-portable.exe` - インストール不要のシングルバイナリ

#### CLI版
- **Windows**: `reso-launcher-cli-vX.X.X-windows.exe` - コマンドライン操作向け

### 初回セットアップ

GUI版では初回起動時に以下が自動で行われます：
- DepotDownloaderの自動ダウンロード
- Steamクレデンシャルの設定（オプション）
- 基本設定の完了

### 利用形態の選択

- **インストーラー版**: システムに統合され、自動更新やファイル関連付けが利用可能
- **ポータブル版**: USBメモリなどで持ち運び可能、レジストリ変更なし、インストール不要

## 🏗️ プロジェクト構成

このプロジェクトは以下のコンポーネントで構成されています：

- **lib**: コア機能を提供するライブラリ (`reso-launcher-lib`)
- **cli**: コマンドラインインターフェース (`reso-launcher-cli`)
- **gui**: モダンなデスクトップGUI（Tauri + React）

## 🔨 ビルド方法

### 前提条件

- Rust と Cargo がインストールされていること
- Node.js がインストールされていること（GUI版ビルド時）
- DepotDownloader が利用可能であること（実行時）

### コンパイル

```bash
# すべてのコンポーネントをビルド
cargo build --release

# CLIのみをビルド
cargo build --release -p reso-launcher-cli

# GUIをビルド
cd gui && npm install && npm run tauri build
```

## 📋 使用方法

### CLI版

```bash
# Resoniteをインストール
reso-launcher-cli install [--branch release|prerelease] [--path <インストールパス>]

# Resoniteを更新
reso-launcher-cli update [--branch release|prerelease] [--path <インストールパス>]

# 更新の確認
reso-launcher-cli check [--branch release|prerelease] [--path <インストールパス>]

# プロファイルの作成
reso-launcher-cli profiles new <プロファイル名>

# プロファイル一覧の表示
reso-launcher-cli profiles list

# Resoniteの起動
reso-launcher-cli launch --profile <プロファイル名> [--branch release|prerelease]

# Steamへのログイン（認証情報の保存）
reso-launcher-cli steamlogin --username <ユーザー名>
```

### GUI版

```bash
# 開発モード
cd gui && npm run tauri dev

# ビルド後の実行
./target/release/reso-launcher
```

## 🔧 依存関係

### DepotDownloader

このツールはSteamのコンテンツをダウンロードするためにDepotDownloaderを使用します。

- **自動ダウンロード**: 初回起動時に自動でダウンロードされます
- **手動設置**: [SteamRE/DepotDownloader](https://github.com/SteamRE/DepotDownloader/releases)
- **配置場所**: 実行ファイルと同じディレクトリに `DepotDownloader.exe` を配置
- **.NET要件**: .NET 8.0 Runtime が必要

## 📚 詳細なドキュメント

詳細な設定方法、プロファイル管理、トラブルシューティングについては以下を参照してください：

📖 **[CONFIGURATION.md](./CONFIGURATION.md)** - 設定とディレクトリ構造の詳細ガイド  
📚 **[TAURI_COMMANDS.md](./TAURI_COMMANDS.md)** - Tauri API コマンドリファレンス

### 主な内容
- ディレクトリ構造とファイル配置
- プロファイル管理の詳細
- Resoniteインストール設定
- 起動オプションとカスタマイズ
- トラブルシューティング
- 高度な設定とスクリプト例

## 🤝 コントリビューション

RESO Launcherはコミュニティプロジェクトです。バグレポート、機能提案、プルリクエストを歓迎します！

### 開発に参加する

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 🔍 システム要件

- **OS**: Windows 10/11 (x64)
- **ランタイム**: .NET 8.0 Runtime（DepotDownloader用）
- **ディスク容量**: 十分なディスク容量（Resoniteインストール用）

## 📞 サポート

- **Issue報告**: [GitHub Issues](https://github.com/resonite-love/launcher/issues)
- **ディスカッション**: [GitHub Discussions](https://github.com/resonite-love/launcher/discussions)
- **コミュニティ**: [resonite.love](https://resonite.love)

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) ファイルを参照してください。

---

Made with ❤️ by the [resonite.love](https://resonite.love) community