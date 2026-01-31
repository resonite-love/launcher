// Profile Transfer Types

export type ModSourceType = 'github' | 'thunderstore' | 'local';

export interface ExportedMod {
  name: string;
  source: ModSourceType;
  source_location?: string;
  version: string;
  file_format: string;
  file_path?: string;
}

export interface ExportedModLoader {
  type: 'ResoniteModLoader' | 'MonkeyLoader' | 'BepisLoader';
  version: string;
}

export interface ExportedProfile {
  display_name: string;
  description: string;
}

export interface ExportOptions {
  include_config: boolean;
}

export interface ExportedGameInfo {
  branch: string;
  version?: string;
  manifest_id?: string;
}

export interface ExportManifest {
  export_version: number;
  export_date: string;
  source_app_version: string;
  profile: ExportedProfile;
  game_info?: ExportedGameInfo;
  mod_loader?: ExportedModLoader;
  options: ExportOptions;
  mods: ExportedMod[];
}

// Rust enum serialization: unit variants become strings, struct variants become objects
export type ModImportStatus =
  | 'Success'
  | 'SourceUnavailable'
  | 'FileNotFound'
  | 'Skipped'
  | { VersionNotFound: { available_version: string | null } };

export interface ModImportResult {
  name: string;
  version: string;
  status: ModImportStatus;
  message?: string;
}

export interface ImportResult {
  profile_name: string;
  profile_id: string;
  game_info?: ExportedGameInfo;
  resonite_installed?: string;
  mod_loader_installed?: string;
  mods: ModImportResult[];
  config_restored: boolean;
}
