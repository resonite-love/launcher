# Kokoa Resonite Tools

Resoniteのインストール、更新、プロファイル管理を行うためのツールセット。

## 📦 ダウンロード

### リリース版（推奨）

最新版は [Releases](https://github.com/kokoa-love/kokoa-resonite-tools/releases) からダウンロードできます。

#### GUI版（推奨）
- **インストーラー**: `Kokoa.Resonite.Tools_vX.X.X_x64_en-US.msi` - 自動インストール・更新対応
- **セットアップEXE**: `Kokoa.Resonite.Tools_vX.X.X_x64-setup.exe` - 軽量インストーラー  
- **ポータブル版**: `kokoa-resonite-tools-vX.X.X-windows-portable.exe` - インストール不要のシングルバイナリ

#### CLI版
- **Windows**: `resonite-manager-vX.X.X-windows.exe` - コマンドライン操作向け

### 初回セットアップ

GUI版では初回起動時に以下が自動で行われます：
- DepotDownloaderの自動ダウンロード
- Steamクレデンシャルの設定（オプション）
- 基本設定の完了

### 利用形態の選択

- **インストーラー版**: システムに統合され、自動更新やファイル関連付けが利用可能
- **ポータブル版**: USBメモリなどで持ち運び可能、レジストリ変更なし、インストール不要

## プロジェクト構成

このプロジェクトは以下のコンポーネントで構成されています：

- **lib**: コア機能を提供するライブラリ
- **cli**: コマンドラインインターフェース
- **gui**: モダンなデスクトップGUI（Tauri + React）

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

# GUIをビルド
cd gui && npm install && npm run tauri build
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
# GUIアプリケーションの起動
cd gui && npm run tauri dev  # 開発モード
# または
./gui/src-tauri/target/release/resonite-tools-tauri  # ビルド後
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

## 詳細な設定とドキュメント

詳細な設定方法、プロファイル管理、トラブルシューティングについては以下を参照してください：

📖 **[CONFIGURATION.md](./CONFIGURATION.md)** - 設定とディレクトリ構造の詳細ガイド

### 主な内容
- ディレクトリ構造とファイル配置
- プロファイル管理の詳細
- Resoniteインストール設定
- 起動オプションとカスタマイズ
- トラブルシューティング
- 高度な設定とスクリプト例

## ライセンス

[ライセンス情報をここに記載]
