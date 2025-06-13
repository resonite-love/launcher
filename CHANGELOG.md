# Changelog

このファイルには、プロジェクトの重要な変更がすべて記録されています。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

## [v0.0.4] - 2025-06-13

### 修正
- GitHub Actions で `--no-bundle --release` フラグを使用してポータブル版実行ファイルを確実に生成
- ビルドプロセスの信頼性をさらに向上

## [v0.0.3] - 2025-06-13

### 修正
- GitHub Actions ワークフローでポータブル版バイナリ作成を改善
- Tauri ビルドでの実行ファイル検出ロジックを強化
- ポータブル版リリースの信頼性を向上

## [v0.0.2] - 2025-06-13

### 追加
- GitHub Actionsによる自動リリースビルド
- タグ付け時のCLI・GUIの自動ビルドとリリース
- GUIポータブル版（シングルバイナリ）のリリース対応

### 変更
- カスタムタイトルバーの最大化ボタンを削除
- タイトルバーのダブルクリック最大化を無効化
- アプリケーション全体でテキスト選択をデフォルト無効化
- Tauriビルド設定の改善（アイコン設定、バージョン統一）

### 修正
- CustomTitlebarのテキスト部分でのウィンドウドラッグを有効化
- Tauriバンドル設定のアイコンエラーを修正

## [v0.0.1] - 2025-06-13

### 追加
- 初回リリース
- GUI版アプリケーション（Tauri + React）
- CLI版アプリケーション
- プロファイル管理システム
- Resoniteの自動インストール・更新機能
- MOD管理システム（ResoniteModLoader対応）
- Steam認証情報の保存機能
- 初回セットアップウィザード
- DepotDownloaderの自動ダウンロード
- 起動引数カスタマイズ機能
- yt-dlp管理機能
- バージョン監視システム
- 未管理MODの検出・管理機能

### 特徴
- **GUI版**: ユーザーフレンドリーなインターフェース
- **CLI版**: スクリプトや自動化に適したコマンドライン操作
- **プロファイル管理**: 複数の設定を簡単に切り替え
- **自動更新**: 最新のResoniteバージョンを自動検出
- **MOD対応**: ResoniteModLoaderと完全統合
- **セキュリティ**: Steam認証情報の安全な暗号化保存

### システム要件
- Windows 10/11 (x64)
- .NET 8.0 Runtime（DepotDownloader用）
- 十分なディスク容量（Resoniteインストール用）

### インストール方法
1. [Releases](https://github.com/kokoa-love/kokoa-resonite-tools/releases)から最新版をダウンロード
2. GUI版: `.msi`ファイルを実行してインストール
3. CLI版: `.exe`ファイルをダウンロードして任意の場所に配置
4. 初回起動時のセットアップウィザードに従って設定を完了

[Unreleased]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.4...HEAD
[v0.0.4]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.3...v0.0.4
[v0.0.3]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.2...v0.0.3
[v0.0.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.1...v0.0.2
[v0.0.1]: https://github.com/kokoa-love/kokoa-resonite-tools/releases/tag/v0.0.1