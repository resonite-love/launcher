# Thunderstore API 仕様書

Resonite MOD配布プラットフォーム「Thunderstore」のAPI仕様とパッケージ形式についてのドキュメント。

## 概要

- **公式サイト**: https://thunderstore.io/c/resonite/
- **MODローダー**: BepInEx (BepisLoader)
- **対象フレームワーク**: .NET 9.0

## API エンドポイント

### ベースURL
```
https://thunderstore.io/c/resonite/api/v1/
```

### パッケージ一覧取得
```
GET /package/
```

全アクティブパッケージの一覧を取得。

**レスポンス**: `Package[]`

### 個別パッケージ取得
```
GET /package/{uuid4}/
```

特定のパッケージを取得。

**パラメータ**:
- `uuid4`: パッケージのUUID

### カテゴリ一覧取得
```
GET https://thunderstore.io/api/experimental/community/resonite/category/
```

Resoniteコミュニティで利用可能なカテゴリ一覧を取得。

## データ構造

### Package
```typescript
interface Package {
  name: string;                    // パッケージ名 (例: "BepisLoader")
  full_name: string;               // 完全名 (例: "ResoniteModding-BepisLoader")
  owner: string;                   // オーナー名 (例: "ResoniteModding")
  package_url: string;             // Thunderstore上のURL
  date_created: string;            // ISO 8601形式
  date_updated: string;            // ISO 8601形式
  uuid4: string;                   // パッケージUUID
  rating_score: number;            // 評価スコア
  is_pinned: boolean;              // ピン留めされているか
  is_deprecated: boolean;          // 非推奨か
  has_nsfw_content: boolean;       // NSFWコンテンツを含むか
  categories: string[];            // カテゴリ (例: ["Libraries", "Mods"])
  versions: PackageVersion[];      // バージョン履歴（最新が先頭）
}
```

### PackageVersion
```typescript
interface PackageVersion {
  name: string;                    // パッケージ名
  full_name: string;               // 完全名 (例: "ResoniteModding-BepisLoader-1.5.1")
  version_number: string;          // セマンティックバージョン (例: "1.5.1")
  uuid4: string;                   // バージョンUUID
  description: string;             // 説明文
  icon: string;                    // アイコンURL
  download_url: string;            // ZIPダウンロードURL
  downloads: number;               // ダウンロード数
  file_size: number;               // ファイルサイズ（バイト）
  date_created: string;            // ISO 8601形式
  website_url: string;             // ウェブサイトURL
  is_active: boolean;              // アクティブか
  dependencies: string[];          // 依存関係 (例: ["ResoniteModding-BepisLoader-1.5.1"])
}
```

### Category
```typescript
interface Category {
  name: string;                    // 表示名
  slug: string;                    // スラッグ（URL用識別子）
}
```

## パッケージ形式

### ZIPファイル構成
```
package.zip
├── icon.png          # 必須: 256x256 PNG画像
├── README.md         # 必須: 説明（Markdown）
├── CHANGELOG.md      # オプション: 変更履歴
├── manifest.json     # 必須: メタデータ
└── plugins/          # MOD本体
    └── MyMod.dll
```

### manifest.json
```json
{
  "name": "MyMod",
  "description": "MODの短い説明（最大250文字）",
  "version_number": "1.0.0",
  "dependencies": [
    "ResoniteModding-BepisLoader-1.5.1"
  ],
  "website_url": "https://github.com/example/mymod"
}
```

| フィールド | 必須 | 説明 |
|-----------|:----:|------|
| `name` | ✔ | パッケージ名。`a-z A-Z 0-9 _` のみ使用可能。変更不可。 |
| `description` | ✔ | 最大250文字の短い説明 |
| `version_number` | ✔ | セマンティックバージョニング形式 (例: `1.0.0`) |
| `dependencies` | ✔ | 依存パッケージの配列。形式: `Owner-PackageName-Version` |
| `website_url` | ✔ | MODのウェブサイトURL。空文字列可。 |

## 依存関係の形式

依存関係は以下の形式で指定:
```
{Owner}-{PackageName}-{Version}
```

例:
- `ResoniteModding-BepisLoader-1.5.1`
- `art0007i-BepInExShim-1.2.0`

## インストール先

### Windows
```
C:\Program Files (x86)\Steam\steamapps\common\Resonite\BepInEx\plugins\
```

### Linux
```
~/.steam/steam/steamapps/common/Resonite/BepInEx/plugins/
```

## 主要パッケージ

### MODローダー
| パッケージ | 説明 |
|-----------|------|
| BepisLoader | BepInExをResoniteで使用するためのローダー |
| BepInExShim | BepInExとの互換性レイヤー |

### MODマネージャー
| パッケージ | 説明 |
|-----------|------|
| r2modman | 汎用Thunderstore MODマネージャー |
| GaleModManager | Tauri製の軽量マネージャー |

## APIレスポンス例

### パッケージ一覧（抜粋）
```json
[
  {
    "name": "BepisLoader",
    "full_name": "ResoniteModding-BepisLoader",
    "owner": "ResoniteModding",
    "package_url": "https://thunderstore.io/c/resonite/p/ResoniteModding/BepisLoader/",
    "uuid4": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "rating_score": 5,
    "is_pinned": false,
    "is_deprecated": false,
    "has_nsfw_content": false,
    "categories": ["Libraries"],
    "versions": [
      {
        "name": "BepisLoader",
        "full_name": "ResoniteModding-BepisLoader-1.5.1",
        "version_number": "1.5.1",
        "description": "BepInEx loader for Resonite",
        "icon": "https://gcdn.thunderstore.io/...",
        "download_url": "https://thunderstore.io/package/download/...",
        "downloads": 12345,
        "file_size": 123456,
        "dependencies": ["art0007i-BepInExShim-1.2.0"],
        "is_active": true
      }
    ]
  }
]
```

## 実装上の考慮事項

### キャッシュ戦略
- パッケージ一覧は定期的にキャッシュを更新（推奨: 15-30分）
- ダウンロードURLは変更されないため、長期キャッシュ可能

### レート制限
- 公式のレート制限は明示されていないが、適切な間隔でのリクエストを推奨

### エラーハンドリング
- 404: パッケージが見つからない
- 5xx: サーバーエラー（リトライ推奨）

## 参考リンク

- [Thunderstore Resonite](https://thunderstore.io/c/resonite/)
- [Package Format Docs](https://thunderstore.io/c/resonite/create/docs/)
- [API Docs](https://thunderstore.io/api/docs/)
- [GitHub - thunderstore-io/Thunderstore](https://github.com/thunderstore-io/Thunderstore)
- [Resonite Modding Wiki](https://modding.resonite.net)
