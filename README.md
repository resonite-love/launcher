# Kokoa Resonite Tools

Resoniteのインストール、更新、プロファイル管理を行うためのツールセット。

## プロジェクト構成

このプロジェクトは以下のコンポーネントで構成されています：

- **lib**: コア機能を提供するライブラリ
- **cli**: コマンドラインインターフェース
- **gui**: グラフィカルユーザーインターフェース（開発中）

## ビルド方法

### 前提条件

- Rust と Cargo がインストールされていること
- SteamCMD が利用可能であること（`<実行ファイルがあるディレクトリ>/steamcmd/steamcmd.exe`）

### コンパイル

```bash
# すべてのコンポーネントをビルド
cargo build --release

# CLIのみをビルド
cargo build --release -p resonite-manager

# GUIのみをビルド
cargo build --release -p resonite-tools-gui
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
resonite-tools-gui
```

## ライセンス

[ライセンス情報をここに記載]
