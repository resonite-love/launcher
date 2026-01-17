# リリース手順

このドキュメントはRESO Launcherの新バージョンをリリースする際の手順をまとめたものです。

## 1. バージョン番号の更新

以下のファイルのバージョン番号を更新する:

| ファイル | 更新箇所 |
|---------|---------|
| `gui/src-tauri/Cargo.toml` | `version = "X.Y.Z"` |
| `gui/src-tauri/tauri.conf.json` | `package.version` |
| `gui/package.json` | `version` |
| `cli/Cargo.toml` | `version = "X.Y.Z"` |
| `lib/Cargo.toml` | `version = "X.Y.Z"` |

## 2. CHANGELOG.mdの更新

1. `## [Unreleased]` セクションの下に新しいバージョンセクションを追加
2. 以下のカテゴリで変更内容を記載:
   - `### 🎉 新機能` - 新しい機能
   - `### ✨ 改善` - 既存機能の改善
   - `### 🐛 バグ修正` - バグ修正
   - `### 🔧 技術的改善` - 内部的な改善
3. ファイル末尾のリンクセクションを更新:
   - `[Unreleased]` のcompare先を新バージョンに変更
   - 新バージョンのリンクを追加

## 3. コミットとタグ

```bash
# 変更をステージング
git add -A

# コミット
git commit -m "vX.Y.Z"

# タグを作成
git tag vX.Y.Z

# プッシュ
git push origin main
git push origin vX.Y.Z
```

## 4. GitHub Actionsの確認

タグをプッシュすると自動的にGitHub Actionsがビルドを開始します:
- Windows用インストーラー (.msi)
- ポータブル版
- 自動アップデート用ファイル

ビルドが完了したらReleasesページで確認してください。

## バージョニング規則

[Semantic Versioning](https://semver.org/lang/ja/) に準拠:
- **MAJOR (X)**: 後方互換性のない変更
- **MINOR (Y)**: 後方互換性のある機能追加
- **PATCH (Z)**: 後方互換性のあるバグ修正
