# Tauri Commands Documentation

このファイルは利用可能なTauriコマンドとその使用方法を説明します。

## アプリケーション初期化

### `initialize_app`
アプリケーションを初期化し、状態を設定します。

**パラメータ:** なし

**戻り値:** `AppStatus`
```typescript
interface AppStatus {
  initialized: boolean;
  depot_downloader_available: boolean;
  exe_dir: string | null;
}
```

**使用例:**
```typescript
const status = await invoke<AppStatus>('initialize_app');
```

## プロファイル管理

### `get_profiles`
すべてのプロファイルとそのゲーム情報を取得します。

**パラメータ:** なし

**戻り値:** `ProfileInfo[]`
```typescript
interface ProfileInfo {
  name: string;
  description: string;
  has_game: boolean;
  branch?: string;
  manifest_id?: string;
  version?: string;
}
```

**使用例:**
```typescript
const profiles = await invoke<ProfileInfo[]>('get_profiles');
```

### `create_profile`
新しいプロファイルを作成します。

**パラメータ:**
- `name: string` - プロファイル名
- `description: string` - プロファイルの説明

**戻り値:** `string` - 成功メッセージ

**使用例:**
```typescript
const result = await invoke<string>('create_profile', {
  name: 'MyProfile',
  description: 'プロファイルの説明'
});
```

## ゲームインストール・更新

### `install_game_to_profile`
指定されたプロファイルにResoniteをインストールします（基本版）。

**パラメータ:** `GameInstallRequest`
```typescript
interface GameInstallRequest {
  profile_name: string;
  branch: string;
  manifest_id?: string;
  username?: string;
  password?: string;
}
```

**戻り値:** `string` - 成功メッセージ

### `install_game_to_profile_interactive`
指定されたプロファイルにResoniteをインストールします（自動フォールバック機能付き）。

**パラメータ:** `GameInstallRequest`

**戻り値:** `string` - 開始メッセージ

**イベント:** `installation-status`, `installation-completed`

**使用例:**
```typescript
const result = await invoke<string>('install_game_to_profile_interactive', {
  request: {
    profile_name: 'MyProfile',
    branch: 'release',
    manifest_id: undefined,
    username: undefined,
    password: undefined
  }
});
```

### `update_profile_game`
プロファイル内のResoniteを更新します（基本版）。

**パラメータ:** `GameInstallRequest`

**戻り値:** `string` - 成功メッセージ

### `update_profile_game_interactive`
プロファイル内のResoniteを更新します（自動フォールバック機能付き）。

**パラメータ:** `GameInstallRequest`

**戻り値:** `string` - 開始メッセージ

**イベント:** `installation-status`, `installation-completed`

### `check_profile_updates`
プロファイル内のResoniteの更新をチェックします。

**パラメータ:** `GameInstallRequest`

**戻り値:** `boolean` - 更新が利用可能かどうか

## ゲーム起動

### `launch_resonite`
指定されたプロファイルでResoniteを起動します。

**パラメータ:**
- `profile_name: string` - 起動するプロファイル名

**戻り値:** `string` - 成功メッセージ

**使用例:**
```typescript
const result = await invoke<string>('launch_resonite', {
  profileName: 'MyProfile'
});
```

## Steam認証

### `steam_login`
Steamにインタラクティブログインを実行します。

**パラメータ:**
- `username: string` - Steamユーザー名

**戻り値:** `string` - 成功メッセージ

### `save_steam_credentials`
Steamクレデンシャルを保存します。

**パラメータ:** `SteamCredentials`
```typescript
interface SteamCredentials {
  username: string;
  password: string;
}
```

**戻り値:** `string` - 成功メッセージ

### `load_steam_credentials`
保存されたSteamクレデンシャルを読み込みます。

**パラメータ:** なし

**戻り値:** `SteamCredentials | null`

### `clear_steam_credentials`
保存されたSteamクレデンシャルを削除します。

**パラメータ:** なし

**戻り値:** `string` - 成功メッセージ

## イベント

### `installation-status`
インストール・更新の進行状況を通知します。

**ペイロード:**
```typescript
{
  profile_name: string;
  branch: string;
  message: string;
  is_complete: boolean;
}
```

### `installation-completed`
インストール・更新の完了を通知します。

**ペイロード:**
```typescript
{
  profile_name: string;
  branch: string;
  success: boolean;
  message: string;
}
```

**使用例:**
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('installation-status', (event) => {
  const data = event.payload as {
    profile_name: string;
    branch: string;
    message: string;
    is_complete: boolean;
  };
  console.log(data.message);
});
```

## エラーハンドリング

すべてのコマンドは失敗時に文字列エラーメッセージを返します。TypeScriptでは以下のようにハンドリングできます：

```typescript
try {
  const result = await invoke<string>('command_name', { /* params */ });
  // 成功処理
} catch (err) {
  // エラー処理
  console.error(`Command failed: ${err}`);
}
```

---

**注意:** このドキュメントはTauriコマンドが変更された際に更新する必要があります。新しいコマンドを追加したり、既存のコマンドを変更したりした場合は、必ずこのファイルを更新してください。