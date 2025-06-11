# 設定とディレクトリ構造

このドキュメントでは、Resonite Toolsの内部構造、プロファイル管理、およびインストール構成について説明します。

## 新しい設計思想：プロファイルベース管理

### 設計変更の目的

従来の「グローバルインストール + プロファイル」から「プロファイル内包型」に変更することで：

- **完全な環境分離**: 各プロファイルが独自のResoniteバージョンを持つ
- **バージョン管理の柔軟性**: プロファイルごとに異なるResoniteバージョンを使用可能
- **環境の安定性**: 一つのプロファイルの変更が他に影響しない
- **実験環境の構築**: 新しいバージョンを安全にテスト可能

## ディレクトリ構造

### 新しい基本構造

```
<実行ディレクトリ>/
├── resonite-manager.exe          # CLI実行ファイル
├── resonite-tools-tauri.exe      # GUI実行ファイル
├── DepotDownloader.exe            # Steam depot ダウンローダー
└── profiles/                     # プロファイル管理ディレクトリ
    ├── Default/                  # デフォルトプロファイル例
    │   ├── launchconfig.json     # プロファイル設定ファイル
    │   ├── DataPath/             # Resoniteユーザーデータ
    │   │   ├── Cache/            # キャッシュファイル
    │   │   ├── Logs/             # ログファイル
    │   │   └── ...               # その他のResoniteデータ
    │   └── Game/                 # Resoniteゲームファイル
    │       ├── Resonite.exe      # Resonite実行ファイル
    │       ├── Resonite_Data/    # ゲームデータ
    │       └── ...               # その他のゲームファイル
    ├── VR-Latest/                # VR用最新版プロファイル
    │   ├── launchconfig.json
    │   ├── DataPath/
    │   └── Game/                 # 最新リリース版
    ├── Desktop-Stable/           # デスクトップ用安定版
    │   ├── launchconfig.json
    │   ├── DataPath/
    │   └── Game/                 # 安定版（古いバージョン）
    └── Experimental/             # 実験用プロファイル
        ├── launchconfig.json
        ├── DataPath/
        └── Game/                 # プレリリース版
```

### ディレクトリの役割

#### プロファイルレベル
- **launchconfig.json**: プロファイル設定とゲームバージョン情報
- **DataPath/**: Resoniteのユーザーデータ（ワールド、設定、キャッシュ）
- **Game/**: Resoniteのゲームファイル（実行ファイル、アセット）

#### 利点
1. **完全分離**: プロファイル間でゲームファイルが完全に分離
2. **バージョン固定**: 各プロファイルで特定バージョンを維持
3. **安全な実験**: 新バージョンテストが他に影響しない
4. **ロールバック**: 問題があれば簡単に古いバージョンに戻れる

## プロファイル管理

### 新しいプロファイルコンセプト

プロファイルは、Resoniteの完全な環境を提供する独立したコンテナです。各プロファイルには以下が含まれます：

- **独立したゲームファイル**: プロファイル専用のResoniteインストール
- **独立したデータディレクトリ**: ワールドデータ、設定、キャッシュが分離
- **カスタム起動オプション**: 解像度、VRモード、その他の起動パラメータ
- **バージョン管理**: プロファイルごとに異なるResoniteバージョンを維持

### プロファイル構造

#### 新しいlaunchconfig.json

各プロファイルの`launchconfig.json`ファイルは以下の形式に拡張されます：

```json
{
  "name": "VR-Latest",
  "description": "VR用最新版プロファイル",
  "game_info": {
    "branch": "release",
    "manifest_id": "7617088375292372759",
    "depot_id": "2519832",
    "installed": true,
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "args": [
    "-SkipIntroTutorial",
    "-DataPath",
    "%PROFILE_DIR%\\DataPath",
    "-ForceVR"
  ]
}
```

**設定項目:**

- `name`: プロファイル名
- `description`: プロファイルの説明
- `game_info`: ゲーム情報（オプション、ゲームがインストールされている場合のみ）
  - `branch`: ブランチ（release/prerelease）
  - `manifest_id`: Steamマニフェスト ID（特定バージョンを指定）
  - `depot_id`: SteamのDepot ID
  - `installed`: ゲームがインストール済みかどうか
  - `last_updated`: 最終更新日時
- `args`: Resoniteに渡される起動引数の配列

#### パス変数

起動引数で使用可能な変数：
- `%PROFILE_DIR%`: プロファイルディレクトリの絶対パス
- `%GAME_DIR%`: ゲームディレクトリの絶対パス（`%PROFILE_DIR%\Game`）
- `%DATA_DIR%`: データディレクトリの絶対パス（`%PROFILE_DIR%\DataPath`）

#### 一般的な起動引数

| 引数 | 説明 | 例 |
|------|------|-----|
| `-SkipIntroTutorial` | チュートリアルをスキップ | 自動追加 |
| `-DataPath` | データディレクトリを指定 | `C:\profiles\MyProfile\DataPath` |
| `-Screen` | 画面モードを指定 | `-Screen 1920x1080` |
| `-NoVR` | VRモードを無効化 | デスクトップモード用 |
| `-ForceVR` | VRモードを強制 | VR専用プロファイル |
| `-LogLevel` | ログレベルを設定 | `-LogLevel Debug` |

### プロファイル操作

#### 新規作成

**CLI:**
```bash
resonite-manager profiles new "MyProfile"
```

**GUI:**
1. プロファイルタブを開く
2. プロファイル名と説明を入力
3. "プロファイルを作成"をクリック

#### プロファイル一覧

**CLI:**
```bash
resonite-manager profiles list
```

**GUI:**
プロファイルタブで自動表示

#### 手動編集

`profiles/<プロファイル名>/launchconfig.json`を直接編集できます：

```json
{
  "name": "VRProfile",
  "description": "VR専用プロファイル",
  "args": [
    "-SkipIntroTutorial",
    "-DataPath",
    "C:\\tools\\profiles\\VRProfile\\DataPath",
    "-ForceVR",
    "-Screen",
    "2880x1700"
  ]
}
```

## Resoniteインストール管理

### 新しいインストール構成

#### プロファイルベースインストール

各プロファイルが独自のResoniteインストールを持つ新しいアプローチ：

1. **プロファイル作成時**: 空のプロファイル構造を作成
2. **ゲームインストール**: 指定されたプロファイルにResoniteをダウンロード
3. **バージョン管理**: プロファイルごとに異なるバージョンを維持

#### サポートするバージョンタイプ

1. **release**: 安定版リリース
   - DepotID: `2519832`
   - インストール先: `profiles/<プロファイル名>/Game/`

2. **prerelease**: プレリリース版
   - DepotID: `2519832` (with `-branch prerelease`)
   - インストール先: `profiles/<プロファイル名>/Game/`

3. **specific-version**: 特定バージョン（将来実装）
   - ManifestID指定でのインストール
   - 古いバージョンの固定利用

#### DepotDownloader設定

新しいプロファイルベースのダウンロードコマンド例：

**プロファイルにリリース版をインストール:**
```bash
DepotDownloader.exe -app 2519830 -depot 2519832 -dir "C:\tools\profiles\MyProfile\Game" -validate
```

**プロファイルにプレリリース版をインストール:**
```bash
DepotDownloader.exe -app 2519830 -depot 2519832 -branch prerelease -dir "C:\tools\profiles\MyProfile\Game" -validate
```

**特定マニフェストをインストール（バージョン固定）:**
```bash
DepotDownloader.exe -app 2519830 -depot 2519832 -manifest 1234567890 -dir "C:\tools\profiles\MyProfile\Game" -validate
```

### 新しい操作ワークフロー

#### プロファイル作成とゲームインストール

**CLI:**
```bash
# 1. プロファイル作成
resonite-manager profiles new "VR-Latest" --description "VR用最新版"

# 2. プロファイルにゲームをインストール
resonite-manager install --profile "VR-Latest" --branch release

# 3. プロファイルにプレリリース版をインストール
resonite-manager install --profile "Experimental" --branch prerelease

# 4. Steam認証付きインストール
resonite-manager install --profile "MyProfile" --branch release --username myuser
```

**GUI:**
1. プロファイルタブでプロファイルを作成
2. インストールタブでプロファイルを選択
3. ブランチを選択（リリース/プレリリース）
4. 必要に応じてSteam認証情報を入力
5. "プロファイルにインストール"をクリック

#### プロファイル内ゲーム更新

**CLI:**
```bash
# 特定プロファイルのゲームを更新
resonite-manager update --profile "VR-Latest"

# 全プロファイルの更新確認
resonite-manager profiles check-updates
```

**GUI:**
1. プロファイルタブで対象プロファイルを選択
2. "ゲーム更新"をクリック
3. または、"全プロファイル更新確認"で一括確認

#### バージョン管理

**CLI:**
```bash
# プロファイルのゲームバージョン確認
resonite-manager profiles info "VR-Latest"

# プロファイル間でのゲームコピー（同じバージョンを共有）
resonite-manager profiles copy-game "VR-Latest" "VR-Backup"

# 特定マニフェストでのインストール（バージョン固定）
resonite-manager install --profile "Stable" --manifest 1234567890
```

## 起動設定

### 新しい起動プロセス

1. **プロファイル選択**: 使用するプロファイルを選択
2. **ゲーム存在確認**: プロファイル内のResonite.exeを確認
3. **プロファイル読み込み**: launchconfig.jsonから起動引数とゲーム情報を読み込み
4. **パス変数展開**: %PROFILE_DIR%などの変数を実際のパスに展開
5. **Resonite起動**: プロファイル専用のResoniteを引数付きで起動

## 新しいアプローチの利点とユースケース

### 利点

#### 1. 完全な環境分離
- **問題の局所化**: 一つのプロファイルで問題が発生しても他に影響しない
- **設定の独立性**: 各プロファイルで完全に独立した設定とデータ
- **実験の安全性**: 新しいバージョンや設定を安全にテスト可能

#### 2. 柔軟なバージョン管理
- **バージョン固定**: 安定動作するバージョンを固定して使用
- **段階的更新**: 新しいバージョンを段階的にテスト
- **ロールバック**: 問題があれば即座に古いバージョンに戻れる

#### 3. 用途別最適化
- **VR専用環境**: VR最適化されたバージョンとデータ
- **開発環境**: デバッグ機能有効、詳細ログ出力
- **配信用環境**: パフォーマンス重視、最小限のログ

### 実用的なユースケース

#### ユースケース1: VR + デスクトップ併用
```
profiles/
├── VR-Main/              # メインVR環境
│   ├── Game/            # 安定版リリース
│   └── DataPath/        # VR用ワールドとアバター
└── Desktop-Streaming/    # 配信用デスクトップ環境
    ├── Game/            # 同じリリース版
    └── DataPath/        # 配信用設定とアセット
```

#### ユースケース2: 開発者環境
```
profiles/
├── Production/           # 本番環境
│   ├── Game/            # 安定版
│   └── DataPath/        # メインデータ
├── Testing/             # テスト環境
│   ├── Game/            # プレリリース版
│   └── DataPath/        # テスト用データ
└── Development/         # 開発環境
    ├── Game/            # 特定バージョン固定
    └── DataPath/        # 開発用データ
```

#### ユースケース3: チーム環境
```
profiles/
├── Team-Stable/         # チーム標準環境
│   ├── Game/           # 指定された固定バージョン
│   └── DataPath/       # 共通プロジェクトデータ
├── Personal-Latest/     # 個人用最新環境
│   ├── Game/           # 最新リリース版
│   └── DataPath/       # 個人データ
└── Experimental/        # 実験用
    ├── Game/           # プレリリース版
    └── DataPath/       # 実験データ
```

### 移行戦略

#### 既存ユーザーの移行

1. **現在のデータ保護**: 既存のResoniteデータをバックアップ
2. **デフォルトプロファイル作成**: 現在の設定を元にプロファイル作成
3. **ゲーム移行**: 既存のResoniteファイルをプロファイルにコピー
4. **段階的移行**: 必要に応じて追加プロファイルを作成

#### データ移行スクリプト
```bash
# 既存環境からプロファイルベースへの移行
resonite-manager migrate --from-global --to-profile "Default"
```

### 起動コマンド例

**CLI:**
```bash
resonite-manager launch --profile "MyProfile" --branch release
```

**GUI:**
1. 起動タブまたはプロファイルタブで対象プロファイルを選択
2. ブランチを選択
3. "起動"をクリック

### 実際の起動コマンド

内部的には以下のようなコマンドが実行されます：

```bash
"C:\tools\release\Resonite.exe" -SkipIntroTutorial -DataPath "C:\tools\profiles\MyProfile\DataPath"
```

## Steam認証

### 認証方法

#### 対話型ログイン（推奨）

**CLI:**
```bash
resonite-manager steamlogin --username myuser
```

このコマンドは：
1. DepotDownloaderを起動
2. パスワードとSteam Guardコードの入力を促す
3. 認証情報をDepotDownloaderが保存
4. 以降の操作で認証情報を再利用

#### 直接認証情報指定

```bash
resonite-manager install --username myuser --password mypass --auth-code 12345
```

**注意**: パスワードをコマンドラインに直接入力するのはセキュリティ上推奨されません。

### 認証情報の保存

DepotDownloaderは認証情報を以下の場所に保存します：
- Windows: `%USERPROFILE%\.steam\`
- Linux/macOS: `~/.steam/`

## トラブルシューティング

### よくある問題

#### 1. DepotDownloader not found

**症状**: アプリケーション起動時に"DepotDownloader not found"エラー

**解決方法**:
1. DepotDownloaderをダウンロード: https://github.com/SteamRE/DepotDownloader/releases
2. 実行ファイルと同じディレクトリに`DepotDownloader.exe`を配置
3. .NET 8.0 Runtimeがインストールされていることを確認

#### 2. プロファイルが見つからない

**症状**: プロファイル一覧が空または起動時にエラー

**解決方法**:
1. `profiles/`ディレクトリが存在することを確認
2. プロファイルディレクトリに`launchconfig.json`があることを確認
3. JSONファイルの構文が正しいことを確認

#### 3. Resonite起動失敗

**症状**: "Resonite executable not found"エラー

**解決方法**:
1. 対象ブランチがインストールされていることを確認
2. `<ブランチ>/Resonite.exe`が存在することを確認
3. 必要に応じて再インストール実行

#### 4. Steam認証エラー

**症状**: ダウンロード時に認証エラー

**解決方法**:
1. `steamlogin`コマンドで事前に認証
2. Steam Guardが有効な場合は認証コードを入力
3. 必要に応じて認証情報を削除して再認証

### ログとデバッグ

#### ログファイルの場所

- **Resoniteログ**: `profiles/<プロファイル名>/DataPath/Logs/`
- **ツールログ**: コンソール出力（将来的にはファイル出力も追加予定）

#### デバッグモード

開発者向けのデバッグ情報を表示：

```bash
# CLI詳細ログ
resonite-manager --verbose install

# GUI開発者ツール
cd gui && npm run tauri dev
```

## 設定のバックアップと復元

### プロファイルのバックアップ

プロファイル全体をバックアップするには：

```bash
# プロファイルディレクトリをコピー
cp -r profiles/MyProfile profiles/MyProfile_backup

# または特定のファイルのみ
cp profiles/MyProfile/launchconfig.json MyProfile_config_backup.json
```

### 設定の移行

他のマシンに設定を移行する場合：

1. `profiles/`ディレクトリ全体をコピー
2. `launchconfig.json`内のパスを新しい環境に合わせて修正
3. Resoniteインストールが必要に応じて実行

### 設定のリセット

問題が発生した場合の設定リセット：

```bash
# 特定のプロファイルを削除
rm -rf profiles/ProblemProfile

# 全プロファイルを削除（注意）
rm -rf profiles/

# インストールを削除（再ダウンロードが必要）
rm -rf release/ prerelease/
```

## 高度な設定

### カスタム起動引数

複雑な起動設定の例：

```json
{
  "name": "AdvancedProfile",
  "description": "高度な設定のプロファイル",
  "args": [
    "-SkipIntroTutorial",
    "-DataPath",
    "C:\\tools\\profiles\\AdvancedProfile\\DataPath",
    "-Screen",
    "3840x2160",
    "-LogLevel",
    "Debug",
    "-NoVR",
    "-CustomArg",
    "CustomValue"
  ]
}
```

### 環境変数

Resonite起動時に環境変数を設定する場合は、バッチファイルを作成：

```batch
@echo off
set RESONITE_CUSTOM_VAR=value
"C:\tools\release\Resonite.exe" -SkipIntroTutorial -DataPath "C:\tools\profiles\MyProfile\DataPath"
```

### スクリプトによる自動化

定期的な更新やバックアップの自動化：

```bash
#!/bin/bash
# 自動更新スクリプト
./resonite-manager check --branch release
if [ $? -eq 0 ]; then
    echo "Updates available, updating..."
    ./resonite-manager update --branch release
else
    echo "No updates available"
fi
```

この構成ドキュメントにより、Resonite Toolsの内部動作と設定方法について詳細に理解できます。