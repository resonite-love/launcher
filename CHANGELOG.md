# Changelog

このファイルには、プロジェクトの重要な変更がすべて記録されています。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]


## [v1.5.9] - 2025-07-09

### 🔧 認証改善
- **Steam認証の改善**: モバイル2FA(二要素認証)を回避するオプションを追加
  - DepotDownloaderに`-disable-mobile-auth`フラグを自動付与
  - Steam Mobileアプリでの認証が不要になり、よりスムーズなインストール体験を提供
  - エミュレーターコードの入力方式に自動切り替え

### 🌐 多言語対応
- **翻訳の微調整**: 日本語・英語の翻訳を改善
  - より自然で分かりやすい表現に更新
  - UIメッセージの一貫性を向上

## [v1.5.8] - 2025-07-07

### 📦 バージョン管理
- **バージョン更新**: v1.5.8へのマイナーアップデート
  - プロファイルで、VRとデスクトップの設定を上書きして起動できる機能を追加

## [v1.5.7] - 2025-06-27

### 🎯 MOD管理機能強化
- **ResoniteModLoader互換性改善**: ResoniteModLoader環境での.nupkg（MonkeyLoader）ファイル対応を最適化
  - MODバージョン選択時に.nupkgファイルをグレーアウト表示し、非対応であることを明示
  - インストールボタンで.nupkgを避けた互換性のある最新版を自動選択
  - 更新通知・アップグレードボタンもResoniteModLoader環境では.dll版のみを対象に
  - 非対応バージョンには「RMLは.nupkg非対応」バッジを表示

### 🎨 UI/UX改善
- **MODカードのコンパクト化**: MOD管理画面のUIを1行表示に改善
  - MOD情報を横並びレイアウトに変更でより多くのMODを効率的に表示
  - 全ボタンをアイコン化してスペース効率を向上
  - ホバー効果とカラーコーディングで操作性を向上
  - MOD説明文をバージョン情報とボタン群の間に配置し、はみ出し分は省略記号で表示

### 🔗 リンク管理改善
- **GitHub以外のリポジトリ対応**: MOD管理画面でGitHub以外のリポジトリURLの場合にリンクボタンを非表示
  - URL判定機能を追加してGitHubのURLのみリンクボタンを表示
  - 無効なリンクによるユーザビリティ問題を解決

### 🌐 多言語対応
- **翻訳追加**: MOD互換性関連の新しい翻訳キーを日本語・英語で追加
  - 互換性エラーメッセージの多言語化
  - UIラベルの翻訳完備

## [v1.5.6] - 2025-06-26

### 📦 バージョン管理
- **バージョン更新**: v1.5.6へのマイナーアップデート
  - 全設定ファイルのバージョン番号を統一更新
  - 継続的な安定性とパフォーマンス改善

## [v1.5.5] - 2025-06-24

### 🎨 UI/UX改善
- **タイトルバーにバージョン表示**: アプリケーションのタイトルバーに現在のバージョン情報を表示
  - `Kokoa Resonite Tools v1.5.5` のような形式で表示
  - ユーザーが現在使用しているバージョンを一目で確認可能

### 🔧 技術的改善
- **ゲームインストールロジックの共通化**: コードのメンテナンス性と再利用性を向上
  - 重複するインストール処理コードを統合
  - より堅牢で一貫したインストール体験を提供
- **インストール確認条件の修正**: ゲームインストール状態の判定ロジックを改善
  - より正確なインストール状態検出
  - 誤検出による問題を解決

### ✨ 改善
- **プロフィール管理の最適化**: プロフィール更新後の一覧表示を改善
  - プロフィール更新後に自動的に一覧を再読み込み
  - 変更内容が即座に反映されるユーザビリティ向上
  
## [v1.5.3] - 2025-06-21

### 🔧 リリースプロセス最適化
- **ワークフロー実行順序制御**: ポータブル版ビルドを通常版完了後に自動実行
  - `workflow_run`トリガーで`Release`ワークフロー完了を待機
  - 成功時のみポータブル版ビルドを実行する条件分岐を追加
- **リリース情報の統合**: ポータブル版情報を既存リリースに追加
  - `append_body: true`で既存のリリース説明を保持
  - ポータブル版の詳細情報を日本語で追加

### 🛠️ 技術的改善
- **タグ情報の適切な取得**: `workflow_run`イベントでのタグ処理を改善
  - コミットハッシュからタグを正確に取得
  - フォールバック機能でタグ取得の確実性を向上
- **デバッグ機能追加**: ビルド結果の詳細なデバッグ出力を追加

## [v1.5.2] - 2025-06-21

### 🔧 ポータブル版の自動アップデート無効化強化
- **コンパイル時フラグ埋め込み**: ビルド時に`portable_build`フラグをバイナリに埋め込み
  - `TAURI_UPDATER_ACTIVE=false`環境変数で`#[cfg(portable_build)]`を設定
  - 配布後のポータブル版exeで確実に自動アップデートを無効化
- **多層保護システム**: 複数の検出方法による確実性向上
  - メイン: コンパイル時フラグ（バイナリに埋め込み）
  - フォールバック1: `.portable`マーカーファイルチェック
  - フォールバック2: 実行ファイル名に"Portable"文字列チェック

### 🛠️ 技術的改善
- **ポータブル版判定ロジック強化**: `is_portable_build()`関数の実装改善
  - ランタイムとコンパイル時の両方で確実に動作
  - GitHub Actionsでポータブルマーカーファイルを自動生成

## [v1.5.1] - 2025-06-21

### 🔧 リリースプロセス改善
- **GitHub Actionsワークフロー修正**: ポータブル版の追加ビルドステップを有効化
  - 実行ファイルの検証とポータブル版ZIPファイル作成を追加
  - リリースアセットにポータブル版を含めるよう改善
  - より充実したダウンロードオプションを提供

### 📦 バージョン管理
- **パッチバージョンアップ**: v1.5.1へ更新
  - リリースプロセスの継続的改善
  - ユーザビリティの向上を反映

## [v1.5.0] - 2025-06-21

### 🔧 技術的改善
- **Gitコミット履歴のクリーンアップ**: Co-Authored-By情報を削除
  - git filter-branchを使用してコミット履歴を整理
  - 全てのコミットメッセージからClaude Code生成情報を除去
  - より簡潔で統一感のあるコミット履歴に改善

### 📦 バージョン管理
- **メジャーバージョンアップ**: v1.5.0へ更新
  - 技術的改善とコード品質向上を反映
  - 継続的な開発とメンテナンス体制の強化

## [v1.4.7] - 2025-06-21

### 🔧 メンテナンス
- **バージョン更新**: v1.4.7へのマイナーアップデート
  - 継続的な安定性とパフォーマンス改善
  - アプリ内自動アップデート機能の配信テスト

## [v1.4.6] - 2025-06-21

### 🔧 技術的改善
- **GitHub Actions大幅リファクタリング**: 標準的なTauriアプリリリース形式に変更
  - 複雑なファイル検索・署名生成処理を削除し、tauri-actionに一任
  - 標準的なTauriワークフローに準拠してメンテナンス性を向上
  - 自動アップデート機能の信頼性を改善

### 🚀 自動アップデート改善
- **リリースプロセス最適化**:
  - `tauri-apps/tauri-action@v0`による自動インストーラー生成
  - updater JSONの自動生成と署名処理
  - エラーが発生しにくいシンプルなワークフロー

### 🛠️ メンテナンス
- **コード品質向上**:
  - 不要な複雑な処理を除去
  - Tauriのベストプラクティスに従った実装
  - 将来のTauriバージョンアップデートに対応しやすい構造

## [v1.4.5] - 2025-06-21

### 🔧 メンテナンス
- **バージョン更新**: v1.4.5へのマイナーアップデート
  - 安定性とパフォーマンスの継続的改善
  - 今後のアップデート配信テスト

## [v1.4.4] - 2025-06-21

### 🐛 修正
- **翻訳修正**: 自動アップデーター機能の翻訳キー不足を解決
  - `settings.app.autoUpdater.title`および`settings.app.autoUpdater.description`の翻訳を追加
  - 関連する翻訳キー（`checkUpdates`, `installing`, `installUpdate`, `updateInstalled`）を追加
  - 日本語・英語の両方で適切な翻訳を提供

### 🌐 多言語対応改善
- **設定タブの翻訳完全対応**:
  - 自動アップデーター セクションの完全な多言語化
  - アップデートチェックとインストール機能の翻訳対応
  - ユーザーインターフェースの一貫した翻訳体験

## [v1.4.3] - 2025-06-21

### 🐛 修正
- **GitHub Actions修正**: アプリ内自動アップデート機能のファイル名問題を解決
  - NSISインストーラーファイルの自動検出と適切なリネーム処理を追加
  - `RESO.Launcher_v1.4.3_x64-setup.nsis.zip`形式でupdater用ファイルを自動生成
  - updater JSONで参照するファイルが確実に存在するよう修正

### 🔧 技術的改善
- **リリースプロセス自動化**:
  - "Prepare updater files"ステップを追加してインストーラーファイルを自動処理
  - `.nsis.zip`ファイルまたは`.exe`ファイルからupdater用ZIPを自動生成
  - アップロード対象にupdater用ファイルを明示的に追加

## [v1.4.2] - 2025-06-21

### 🚀 新機能
- **アプリ内自動アップデート機能**:
  - Tauri Plugin Updaterを統合し、アプリ内からワンクリックでアップデート可能に
  - 設定タブに自動アップデーターセクションを追加
  - アップデートのダウンロード進行状況をリアルタイム表示
  - バックグラウンドダウンロードとインストール機能
  - GitHub Releasesからの自動アップデート検出

### ✨ 改善
- **アップデート体験の向上**:
  - 手動でGitHubページを開く必要がなくなり、シームレスなアップデート体験を実現
  - アップデートチェックとインストールボタンを設定タブに統合
  - ダウンロード進行状況バーでユーザーに視覚的フィードバック
  - インストール完了後、アプリケーション再起動で新バージョンが適用

### 🔧 技術的改善
- **Tauri Updater統合**:
  - Tauri v1.7の組み込みupdater機能を活用
  - GitHub Actionsで`latest.json`マニフェストファイルの自動生成
  - 署名キーによるセキュアなアップデート配信
  - Tauriコマンド: `check_app_updates`、`install_app_update`の実装

### 📚 必要な設定
- **署名キーの生成** (デプロイ前に必要):
  ```bash
  npm run tauri signer generate -- -w ~/.tauri/myapp.key
  ```
- **GitHub Secrets設定**:
  - `TAURI_PRIVATE_KEY`: 秘密キー
  - `TAURI_KEY_PASSWORD`: キーのパスワード（設定した場合）

## [v1.4.1] - 2025-06-20

### 🚀 新機能
- **複数ファイルMODの高度インストール機能**:
  - DLL/nupkg以外のファイル（.exe、.txt、.md、.pdf等）もインストール対象に追加
  - ファイルごとのインストール可否を選択できるチェックボックス機能
  - 配置先フォルダの拡張（rml_mods、Mods、Libraries、RuntimeData、スキップ）
  - バージョン選択機能でリリース履歴から任意のバージョンを選択可能
  - リアルタイムバージョン切り替えによるファイル一覧の動的更新
  - リリースノートの表示機能

### 💾 インストール対象拡張
- **新対応ファイル形式**:
  - 実行可能ファイル（.exe）
  - ドキュメントファイル（.txt、.md、.pdf）
  - 設定ファイル、その他MOD関連ファイル
  - ソースコードとアーカイブファイルは自動除外

### 📁 配置先選択肢拡張
- **ResoniteModLoader**: `rml_mods` フォルダ
- **MonkeyLoader**: `Mods` フォルダ  
- **Resonite Libraries**: `Libraries` フォルダ（新規）
- **Resonite RuntimeData**: `RuntimeData` フォルダ（新規）
- **インストールしない**: ファイルをスキップ（新規）

### 🎯 ユーザビリティ改善
- DLL/nupkgファイルはデフォルトで有効、その他ファイルは選択式
- ファイル種別に応じたアイコン表示
- チェックボックス状態に応じた動的UI表示/非表示
- バージョン選択時のスムーズなUX

### 🛠️ 技術改善
- バックエンドでの複数バージョン対応
- フロントエンドでのリアルタイムバージョン切り替え
- 型安全性の向上

## [v1.4.0] - 2025-06-20

### 🌐 新機能
- **完全国際化対応 (i18n)**: アプリケーション全体で日本語・英語の完全サポート
  - react-i18nextによる本格的な多言語対応システムを導入
  - 設定タブに視覚的な言語選択機能（日本語/English）を追加
  - ブラウザの言語設定を自動検出し、適切な言語で起動
  - 選択した言語はlocalStorageに永続保存され、次回起動時も維持
  - リアルタイム言語切り替え（ページリロード不要）

### ✨ 翻訳対応済み機能
- **全コンポーネント翻訳対応**:
  - メインナビゲーション（ホーム、プロファイル管理、設定）
  - ホームタブ（アップデート情報、プロファイル選択、起動機能）
  - プロファイル管理タブ（一覧、作成、編集、削除）
  - **プロファイル詳細ページ**（起動ボタン、保存、複製、削除、フォルダを開く等）
  - 設定タブ（Steam設定、アプリケーション更新、言語選択）
  - 全モーダルダイアログ（初回設定、ゲームインストール、MOD管理等）

- **詳細機能の翻訳**:
  - 起動引数エディター（40+の引数説明とカテゴリ）
  - ゲーム・MODバージョン選択機能
  - エラーメッセージとトースト通知
  - フォーム要素とプレースホルダーテキスト
  - ヘルプテキストと説明文
  - ステータス表示とラベル

### 🔧 技術的実装
- **i18n ライブラリ統合**:
  - `react-i18next`: React専用の国際化フレームワーク
  - `i18next-browser-languagedetector`: 自動言語検出
  - 階層化された翻訳キー構造で保守性向上
  - TypeScript完全対応で型安全性を確保

- **翻訳ファイル構造**:
  - `src/locales/ja.json`: 日本語翻訳（400+キー）
  - `src/locales/en.json`: 英語翻訳（400+キー）
  - 論理的にグループ化された名前空間
  - 動的パラメーター対応（ユーザー名、バージョン等）

### 🎨 UI/UX改善
- **言語選択インターフェース**:
  - 設定タブに専用の「Language / 言語」セクション
  - 日本語・英語ボタンのビジュアル切り替え
  - 選択状態の明確な視覚フィードバック
  - 即座に反映される言語変更

- **一貫した翻訳体験**:
  - 全てのユーザーインターフェース要素が統一的に翻訳
  - 文脈に応じた自然な翻訳
  - 技術用語の適切な日本語化
  - ボタンテキストとツールチップの完全対応

### 🚀 使用方法
1. **言語切り替え**: 設定タブ → 「Language / 言語」→ 希望の言語をクリック
2. **自動検出**: 初回起動時にブラウザの言語設定を自動判定
3. **永続化**: 選択した言語は自動保存され、次回起動時も維持
4. **リアルタイム**: 言語変更が即座にアプリ全体に反映

### 💡 多言語対応の利点
- **アクセシビリティ向上**: 日本語ユーザーと英語ユーザーの両方が快適に利用
- **国際化**: 海外のResoniteユーザーもツールを活用可能
- **学習効果**: 英語でResonite用語を学習する機会を提供
- **将来性**: 追加言語サポートへの基盤が整備

### 🛠️ 開発者向け情報
- **拡張可能な設計**: 新しい言語の追加が容易
- **型安全性**: TypeScriptによる翻訳キーの型チェック
- **保守性**: 階層化されたキー構造で管理が簡単
- **パフォーマンス**: 遅延読み込みとキャッシュによる高速化

## [v1.3.1] - 2025-06-20

### 🎉 新機能
- **プロファイル複製機能**: 既存のプロファイルを簡単に複製できる機能を追加
  - プロファイル編集画面に「複製」ボタンを配置
  - 元のプロファイルの設定、ゲームデータ、MODを全て複製
  - 新しいプロファイル名と説明を自由に設定可能
  - IDの重複を避ける自動的なユニークフォルダ名生成

### ✨ 改善
- **プロファイル管理の利便性向上**:
  - 類似設定のプロファイル作成が大幅に簡素化
  - 既存のMOD設定やゲームデータを維持しつつ新プロファイル作成
  - 保存ボタンと削除ボタンの間に複製ボタンを配置して直感的な操作
  - 複製時に元プロファイルの説明をデフォルト値として自動入力

### 🔧 技術的改善
- **バックエンド機能追加**:
  - 新しいTauriコマンド `duplicate_profile` の実装
  - ディレクトリの再帰的コピー機能（`copy_directory_recursive`）
  - 設定ファイルの適切な上書きとデータファイルの完全コピー
  - エラーハンドリングと重複名チェック機能

- **フロントエンド機能追加**:
  - React用の複製モーダルコンポーネント実装
  - フォームバリデーションと状態管理
  - 複製完了後のプロファイル一覧自動更新
  - ユーザーフレンドリーなエラーメッセージ表示

### 🎨 UI/UX改善
- **直感的な複製インターフェース**:
  - モーダルダイアログでの分かりやすい入力画面
  - プロファイル名と説明の入力フィールド
  - 複製内容の説明テキストと注意事項表示
  - 複製処理中のローディング表示とプログレスインジケーター

### 📚 ドキュメント更新
- **TAURI_COMMANDS.md**: `duplicate_profile`コマンドの詳細なAPI仕様を追加
  - パラメーター、戻り値、使用例の完全なドキュメント
  - 注意事項と制限事項の明記
  - TypeScript用のサンプルコード提供

### 🛠️ 使用方法
1. **プロファイル複製**:
   - プロファイル編集画面で「複製」ボタンをクリック
   - 新しいプロファイル名と説明（任意）を入力
   - 「複製」ボタンで実行すると全設定とデータが新プロファイルにコピー
2. **自動設定継承**:
   - 起動引数、ゲーム設定、MODローダー設定が全て継承
   - インストール済みゲームとMODが完全にコピー
   - 独立したプロファイルとして個別に管理可能

### 💡 ユースケース
- **実験用プロファイル**: 本番環境を保持しつつテスト環境を作成
- **バックアップ作成**: 重要なプロファイルの安全なコピー作成
- **設定バリエーション**: 同じベースから異なる設定パターンを展開
- **友人との共有準備**: 完成したプロファイル設定の複製による配布準備

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

[Unreleased]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.9...HEAD
[v1.5.9]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.8...v1.5.9
[v1.5.8]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.7...v1.5.8
[v1.5.7]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.6...v1.5.7
[v1.5.6]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.5...v1.5.6
[v1.5.5]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.3...v1.5.5
[v1.5.3]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.2...v1.5.3
[v1.5.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.1...v1.5.2
[v1.5.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.5.0...v1.5.1
[v1.5.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.7...v1.5.0
[v1.4.7]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.6...v1.4.7
[v1.4.6]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.5...v1.4.6
[v1.4.5]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.4...v1.4.5
[v1.4.4]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.3...v1.4.4
[v1.4.3]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.2...v1.4.3
[v1.4.2]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.1...v1.4.2
[v1.4.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.4.0...v1.4.1
[v1.4.0]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.3.1...v1.4.0
[v1.3.1]: https://github.com/kokoa-love/kokoa-resonite-tools/compare/v1.3.0...v1.3.1
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