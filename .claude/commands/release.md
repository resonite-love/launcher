# Release

RESO Launcherの新バージョンをリリースする際に使用するコマンドです。

## 手順

ユーザーから指定されたバージョン番号（例: `1.9.0`）を使用して、以下の作業を自動で行ってください:

### 1. バージョン番号の更新

以下のファイルのバージョン番号を更新:

- `gui/src-tauri/Cargo.toml` - `version = "X.Y.Z"`
- `gui/src-tauri/tauri.conf.json` - `package.version`
- `gui/package.json` - `version`
- `cli/Cargo.toml` - `version = "X.Y.Z"`
- `lib/Cargo.toml` - `version = "X.Y.Z"`

### 2. CHANGELOG.mdの更新

1. `## [Unreleased]` セクションの下に新しいバージョンセクション `## [vX.Y.Z] - YYYY-MM-DD` を追加
2. 前回のリリースからの変更内容を以下のカテゴリで記載:
   - `### 🎉 新機能` - 新しい機能
   - `### ✨ 改善` - 既存機能の改善
   - `### 🐛 バグ修正` - バグ修正
   - `### 🔧 技術的改善` - 内部的な改善
3. ファイル末尾のリンクセクションを更新:
   - `[Unreleased]` のcompare先を新バージョンに変更
   - 新バージョンのリンクを追加

変更内容は git log や直近の会話から推測してください。

### 3. 確認

全ての変更が完了したら、更新したファイルの一覧と変更内容のサマリーをユーザーに報告してください。

## バージョニング規則

[Semantic Versioning](https://semver.org/lang/ja/) に準拠:
- **MAJOR (X)**: 後方互換性のない変更
- **MINOR (Y)**: 後方互換性のある機能追加
- **PATCH (Z)**: 後方互換性のあるバグ修正
