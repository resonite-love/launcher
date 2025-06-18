# Changelog

このファイルには、プロジェクトの重要な変更がすべて記録されています。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

## [v1.3.0] - 2025-06-18

### 🎉 新機能
- **Steam News 統合**: ホームタブにResoniteの公式アップデート情報を自動表示
  - Steam公式ニュースAPIからリアルタイムで最新情報を取得
  - BBCode形式からMarkdown形式への自動変換機能
  - 美しいMarkdown表示による読みやすいアップデート情報
  - Steam ページへの外部リンク機能付き
  - 30分間のキャッシュ機能で高速表示とサーバー負荷軽減

### ✨ 改善
- **ホームタブの刷新**: 
  - 未実装の placeholder から実際のアップデート情報表示に変更
  - ローディング状態とエラーハンドリングの完全実装
  - 日本語での日付表示と読みやすいUI設計
  - リアルタイム更新機能（更新ボタンで手動更新も可能）
- **ユーザーエクスペリエンス向上**:
  - プロファイル選択と起動機能をフッターに配置してアクセス性向上
  - バージョン情報の見やすい表示（青色のチップ表示）
  - セクション別の構造化されたアップデート内容表示

### 🔧 技術的改善
- **新しいライブラリ統合**:
  - `react-markdown`: Markdown コンテンツの高品質レンダリング
  - `remark-gfm`: GitHub Flavored Markdown サポート
- **型安全性の向上**:
  - Steam News API の完全な TypeScript 型定義
  - UI コンポーネント用の変換型定義
- **アーキテクチャ改善**:
  - React Query による効率的なデータフェッチとキャッシュ
  - BBCode → Markdown 変換エンジンの実装
  - カスタム Markdown コンポーネントによるダークテーマ対応

### 🎨 UI/UX 改善
- **Markdown 表示の最適化**:
  - Resonite ブルーのアクセントカラーでヘッダー表示
  - 読みやすいタイポグラフィとスペーシング
  - コードブロック、リンク、強調表示の美しいスタイリング
  - リストアイテムの視覚的改善（小さな丸印付き）
- **レスポンシブデザイン**:
  - スクロール可能なアップデート一覧
  - 外部リンクのホバーエフェクト
  - 適切なローディングアニメーション

### 📱 使用方法
1. **自動更新**: アプリケーション起動時に最新のアップデート情報を自動取得
2. **手動更新**: ホームタブの「更新」ボタンで最新情報を手動取得
3. **詳細表示**: Steam リンクアイコンをクリックして公式ページで詳細確認
4. **統合体験**: プロファイル管理とアップデート情報確認をシームレスに

### 🔮 今後の展開
- アップデート通知機能
- バージョン比較機能
- お気に入りアップデート機能
- アップデート履歴検索

## [v1.2.2] - 2025-06-18

### 🐛 修正
- **重要**: プロファイル編集画面のゲームインストール機能を修正
  - インストールモーダル内のインストールボタンが動作しない問題を解決
  - 保存されているSteam認証情報が正しくゲームインストール処理に渡されるよう修正
  - `useSteamCredentials`フックを使用して認証情報を適切に取得

### ✨ 改善
- **MonkeyLoader MOD管理の最適化**: 
  - MonkeyLoaderでも.dllファイルは`rml_mods`フォルダに統一配置
  - .nupkgファイルのみ`Game/MonkeyLoader/Mods`に配置することで管理を簡素化
  - 未管理MODスキャン機能でMonkeyLoader MODも適切に検出
- **MODフォルダスキャンの改善**: 
  - 複数のMODローダーディレクトリを効率的にスキャン
  - ファイル形式に基づく自動分類機能の強化
  - MOD検出処理の構文エラーを修正

### 🔧 技術的改善
- **ファイル管理の統一化**: 
  - `scan_mod_folder`関数でRMLとMonkeyLoader両方のMODを適切にスキャン
  - ファイル拡張子（.dll/.nupkg）に基づく自動判定ロジックの改善
  - MODインストール処理でのパス管理を最適化
- **認証情報管理の強化**: 
  - Steam認証情報を`ProfileEditPage`で適切に取得・使用
  - `handleGameInstall`関数でのエラーハンドリング改善

### 🎯 ユーザー体験
- **インストール体験の向上**: 
  - プロファイル編集画面からのゲームインストールが確実に動作
  - 保存済みSteam認証情報の自動利用で手間を削減
  - エラー発生時の分かりやすいメッセージ表示

## [v1.2.1] - 2025-06-17

### 🐛 修正
- **TypeScriptエラー修正**: `ModRelease`型で`tag_name`ではなく`version`フィールドを使用するよう修正
- **MODローダータイプ判定の改善**: ファイル形式（.dll/.nupkg）に基づいてMODローダータイプを自動判定
  - `.nupkg`ファイルは自動的に`MonkeyLoader (ML)`として表示
  - `.dll`ファイルは自動的に`ResoniteModLoader (RML)`として表示

### ✨ 改善
- **MODデータ自動マイグレーション**: 既存のインストール済みMODデータに不足しているフィールドを自動補完
  - `mod_loader_type`: ファイル形式から自動判定
  - `file_format`: ファイル拡張子から自動設定
  - `enabled`: .disabled拡張子の有無から判定
- **リロードボタンの強化**: MODリストのリロード時に自動的にマイグレーションを実行
- **UIの一貫性向上**: MODローダータイプの表示ロジックを統一化

### 🔧 技術的改善
- **マイグレーション処理の実装**: 
  - `get_installed_mods`関数でMODデータの自動マイグレーション
  - 新しいTauriコマンド`migrate_installed_mods`の追加
  - React Queryフック`useMigrateInstalledMods`の追加
- **データ整合性の強化**: MODリスト読み込み時に古いデータ形式を自動的に新形式に変換

## [v1.2.0] - 2025-06-17

### 🎉 新機能
- **MOD無効化/有効化機能**: インストール済みMODを一時的に無効化・有効化できる機能を追加
  - ファイル名に`.disabled`拡張子を追加/削除して制御
  - 管理画面で無効化されたMODに「無効」ラベル表示
  - 有効化/無効化ボタンで簡単に切り替え可能
- **NuGetパッケージ対応**: MonkeyLoader使用時に`.nupkg`形式のMODも自動インストール対応
  - `.nupkg`ファイルを優先的に検出・ダウンロード
  - `Game/MonkeyLoader/Mods/`ディレクトリに自動配置
  - 管理画面で「ML-PKG」として表示
- **プロファイル編集画面から起動**: プロファイル編集画面に緑色の起動ボタンを追加
  - ゲーム未インストール時は無効化表示
  - クリック一つで直接Resoniteを起動可能
- **手動MODインストールのバージョン選択**: 手動MODインストール時にもバージョン選択モーダルを表示
  - GitHubからリリース情報を取得
  - 利用可能な全バージョンから選択可能

### ✨ 改善
- **MODインストールボタンの最適化**: 
  - デフォルトで最新版を自動インストール
  - 設定アイコン（歯車）でカスタムバージョン選択
  - ボタン配置を歯車→インストールの順に変更
- **外部リンクの改善**: MODのGitHubリンクをOSのデフォルトブラウザで開くよう変更
- **UI/UX向上**:
  - 起動オプションのツールチップを非クリック化（誤クリック防止）
  - MODローダータイプ表示の強化（RML/ML、PKG対応）
  - MOD管理画面での状態表示改善

### 🔧 技術的改善
- **MOD管理システムの拡張**: 
  - `InstalledMod`構造体に`enabled`、`mod_loader_type`、`file_format`フィールド追加
  - ファイル形式別インストール処理の実装
- **GitHub API統合**: 
  - `get_github_releases`コマンドの追加
  - リリース情報の取得と処理機能
- **エラーハンドリング強化**: 
  - ファイル名変更処理の信頼性向上
  - 重複拡張子問題の解決

### 🐛 修正
- **ファイル名処理の修正**: MOD無効化/有効化時のファイル名重複問題を解決
- **UI表示の一貫性**: MODローダータイプ表示の統一化

## [v1.1.1] - 2025-06-17

### 🐛 修正
- **プロファイル作成UI**: ゲーム＆MODローダー同時インストール時にインストールボタンが適切にグレーアウトされない問題を修正
- **状態管理の改善**: `isLoading`状態を`executeProfileCreation`関数で適切に管理するよう修正
- **視覚的フィードバック**: インストール処理中のボタン表示とテキストを改善（「インストール中...」表示）
- **キャンセルボタン**: インストール処理中はキャンセルボタンも無効化して操作の整合性を保持

### 🔧 技術的改善
- ローディング状態の一貫した管理
- ユーザーインターフェースの応答性向上

## [v1.1.0] - 2025-06-17

### 🎉 新機能
- **MonkeyLoader対応**: ResoniteModLoaderに加えて、新しいMODローダー「MonkeyLoader」もサポート
- **MODローダー選択機能**: プロファイル作成時とMOD管理画面でRMLとMonkeyLoaderを選択可能
- **自動マイグレーション**: 既存プロファイルでResoniteModLoaderが検出された場合、自動的にコンフィグをマイグレーション
- **プロファイル設定バージョン管理**: コンフィグファイルにバージョン番号を追加し、今後のアップデートでスムーズなマイグレーションが可能

### ✨ 改善
- **視覚的な識別**: プロファイル一覧でMODローダータイプをカラーチップで表示（RML: 緑色、ML: 紫色）
- **統一インターフェース**: 両方のMODローダーを統一的に管理できるUI
- **詳細な説明**: 各MODローダーの特徴を選択時に表示
- **マイグレーション表示**: 自動マイグレーションされたプロファイルに「(マイグレーション済み)」表示

### 🔧 技術的改善
- **型安全性の向上**: ModLoaderTypeエニュームによる型安全なMODローダー管理
- **コンフィグバージョニング**: 将来のアップデートに対応したコンフィグバージョン管理システム
- **自動検出機能**: インストール済みMODローダーの自動検出と識別

### 📖 詳細情報
#### MonkeyLoaderについて
MonkeyLoaderは新世代のMODローダーで、より高度な機能と安定性を提供します：
- **自動インストール**: ZIPファイルからゲームディレクトリに自動展開
- **シンプルな起動**: 特別な起動引数不要
- **無効化機能**: `--doorstop-enabled false` フラグで簡単に無効化可能

#### 既存ユーザーへの影響
- **完全後方互換**: 既存のRMLプロファイルは引き続き動作
- **自動認識**: 既存のRMLインストールを自動検出してコンフィグに反映
- **選択の自由**: 新しいプロファイルではRMLまたはMonkeyLoaderを自由選択

### 🛠️ 使用方法
1. **新規プロファイル作成時**: MODローダーチェックボックスを有効にすると、RMLまたはMonkeyLoaderを選択可能
2. **既存プロファイル**: MOD管理画面でローダータイプを確認し、別のローダーに切り替え可能
3. **プロファイル一覧**: 各プロファイルのMODローダータイプがチップで一目で確認可能

## [v1.0.4] - 2025-06-14

### 修正
- **重要**: `format!`マクロによるバックスラッシュエスケープ問題を修正
- フォアグラウンドインストール時のコマンド実行エラーを解決
- DepotDownloaderパスの引用符処理を文字列連結で実装し直し
- コマンド実行前にDepotDownloaderの存在確認を追加
- 検索パスにプロジェクトルートを追加してパス検出を改善

### 改善
- より堅牢なコマンド文字列構築方式に変更
- エラーハンドリングの強化

## [v1.0.3] - 2025-06-14

### 修正
- **重要**: フォアグラウンドインストール時にCMDウィンドウが即座に閉じる問題を修正
- リリースビルドでも `run_interactive` でCMDウィンドウが継続表示されるよう改善
- DepotDownloaderウィンドウにタイトル「DepotDownloader」を設定
- インストール開始・完了メッセージの表示を追加
- `/c` から `/k` に変更してコマンド実行後もウィンドウを保持

### 改善
- フォアグラウンドインストール時のユーザー体験を大幅に向上
- インストール進行状況の視認性を改善

## [v1.0.2] - 2025-06-14

### 修正
- フォアグラウンドインストール時のCMDウィンドウ表示問題を部分的に修正

## [v1.0.1] - 2025-06-14

### 修正
- インストール中状態管理を追加
- UIの表示文言と引数のプレースホルダーを改善

## [v0.1.1] - 2025-06-14

### 修正
- **重要**: 実行ファイル名が `Kokoa Resonite Tools.exe`（スペース付き）であることを発見
- GitHub Actions でポータブル版作成時の正しい実行ファイル名を使用
- 検証ステップも正しいファイル名に更新

## [v0.1.0] - 2025-06-14

### 改善
- GitHub Actions のビルドプロセスを大幅に改善
- `CARGO_TARGET_DIR` を明示的に設定してビルド出力の一貫性を確保
- ビルド前後の詳細な検証ステップを追加

### デバッグ
- 実行ファイルの検証ステップを追加
- ビルド出力の詳細なログを提供

## [v0.0.9] - 2025-06-14

### 修正
- GitHub Actions でポータブル版実行ファイルの正しいパスを使用するよう修正
- 実行ファイルが `./target/release/` に生成されることを確認
- デバッグステップを削除してワークフローをクリーンアップ

### 改善
- ポータブル版のファイルサイズを表示
- WebView2Loader.dll の検索を改善
- エラーハンドリングを強化

## [v0.0.8] - 2025-06-13

### 改善
- GitHub Actions のデバッグ出力をさらに詳細化
- 作業ディレクトリとビルド成果物の場所を正確に特定するログを追加
- cargo build の成功確認とファイルサイズ出力を追加

## [v0.0.7] - 2025-06-13

### 追加
- GitHub Actions に target/release ディレクトリの内容をダンプするデバッグステップを追加
- ビルド成果物の詳細な情報を出力（ファイルサイズ、作成日時、権限など）

### デバッグ
- ポータブル版実行ファイルが見つからない問題を調査するためのログ出力を強化

## [v0.0.6] - 2025-06-13

### 修正
- GitHub Actions のビルド順序を修正
- フロントエンドビルドの重複を削除

## [v0.0.5] - 2025-06-13

### 改善
- GitHub Actions でポータブル版の作成プロセスを完全に再構築
- 直接 cargo build を使用して実行ファイルを生成
- WebView2Loader.dll を含むZIPファイルも作成
- ビルドプロセスのデバッグ情報を強化

### 修正
- フロントエンドのビルドを実行ファイルビルドの前に実行するよう修正
- `distDir` が存在しないエラーを解決

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

[Unreleased]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.3.0...HEAD
[v1.3.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.2.2...v1.3.0
[v1.2.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.2.1...v1.2.2
[v1.2.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.2.0...v1.2.1
[v1.2.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.1.1...v1.2.0
[v1.1.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.1.0...v1.1.1
[v1.1.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.0.4...v1.1.0
[v1.0.4]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.0.3...v1.0.4
[v1.0.3]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.0.2...v1.0.3
[v1.0.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.1.1...v1.0.1
[v0.1.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.9...v0.1.0
[v0.0.9]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.8...v0.0.9
[v0.0.8]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.7...v0.0.8
[v0.0.7]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.6...v0.0.7
[v0.0.6]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.5...v0.0.6
[v0.0.5]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.4...v0.0.5
[v0.0.4]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.3...v0.0.4
[v0.0.3]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.2...v0.0.3
[v0.0.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v0.0.1...v0.0.2
[v0.0.1]: https://github.com/kokoa-love/kokoa-resonite-tools/releases/tag/v0.0.1