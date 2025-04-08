# Resonite Manager

Resonite Managerは、Resoniteのインストール、アップデート、起動を管理するためのコマンドラインツールです。リリース版とプレリリース版の両方をサポートし、プロファイル機能によって異なる設定で起動できます。

## セットアップ

1. `resonite-manager.exe` を任意のディレクトリに配置します
2. 同じディレクトリに `steamcmd` フォルダを作成し、その中にSteamCMDをインストールします:
   ```
   /your_directory/
   ├── resonite-manager.exe
   └── steamcmd/
       └── steamcmd.exe
   ```
https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip
からダウンロードしてください。

## 基本的な使い方

### Steamログイン

```
resonite-manager.exe steamlogin -u your_steam_username
```

パスワードとSteam Guard認証コードの入力を求められます。ログイン情報はsteamcmdによって保存され、以降のコマンドでは認証情報を指定する必要がなくなります。

### Resoniteのインストール

**リリース版:**
```
resonite-manager.exe install -u your_steam_username
```

**プレリリース版:**
```
resonite-manager.exe install prerelease -u your_steam_username
```

インストール先はデフォルトで実行ファイルと同じディレクトリの下にブランチ名のフォルダが作成されます:
```
/your_directory/
├── resonite-manager.exe
├── release/
│   └── Resonite.exe
└── prerelease/
    └── Resonite.exe
```

### Resoniteのアップデート

```
resonite-manager.exe update [release|prerelease] -u your_steam_username
```

### アップデートの確認

```
resonite-manager.exe check [release|prerelease] -u your_steam_username
```

## プロファイル機能

プロファイルを使用すると、異なる設定でResoniteを起動できます。各プロファイルは独自のデータパスを持ち、設定や保存データを分離して管理できます。

### プロファイルの作成

```
resonite-manager.exe profiles new my_profile
```

このコマンドにより、以下のディレクトリ構造が作成されます:
```
/your_directory/
├── resonite-manager.exe
└── profiles/
    └── my_profile/
        ├── launchconfig.json  # 設定ファイル
        └── DataPath/          # Resoniteのデータ保存先
```

### プロファイル一覧の表示

```
resonite-manager.exe profiles list
```

### プロファイルの設定

`profiles/my_profile/launchconfig.json` を編集して、起動引数をカスタマイズできます:

```json
{
  "name": "my_profile",
  "description": "My custom profile",
  "args": [
    "-DataPath",
    "C:/path/to/profiles/my_profile/DataPath",
    "-Screen"
  ]
}
```
とかとか

### プロファイルを使用したResoniteの起動

**リリース版:**
```
resonite-manager.exe launch release -p my_profile
```

**プレリリース版:**
```
resonite-manager.exe launch prerelease -p my_profile
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `steamlogin -u <username>` | Steamへの対話的ログイン |
| `install [branch]` | Resoniteのインストール（デフォルト: release） |
| `update [branch]` | Resoniteのアップデート |
| `check [branch]` | アップデートの確認 |
| `profiles new <name>` | 新しいプロファイルの作成 |
| `profiles list` | プロファイル一覧の表示 |
| `launch [branch] -p <profile>` | 指定したプロファイルでResoniteを起動 |

各コマンドの詳細は `resonite-manager.exe <command> --help` で確認できます。

## 高度な使用例

### 複数のプロファイルでの開発環境とテスト環境の分離

```
# 開発用プロファイルの作成
resonite-manager.exe profiles new dev

# テスト用プロファイルの作成
resonite-manager.exe profiles new test

# それぞれのプロファイルでResoniteを起動
resonite-manager.exe launch release -p dev
resonite-manager.exe launch prerelease -p test
```

### カスタムインストールパス

```
# カスタムパスへのインストール
resonite-manager.exe install -p "D:\Games\Resonite"

# カスタムパスへのプレリリース版インストール
resonite-manager.exe install prerelease -p "D:\Games\Resonite-Beta"
```

## 注意事項

1. steamcmdフォルダが存在し、その中にsteamcmd.exeがあることを確認してください
2. プロファイル機能を使用する前に、対応するブランチのResoniteをインストールしておく必要があります
3. launchconfig.jsonの`-DataPath`引数のパスを手動で変更する場合は、絶対パスを使用してください
