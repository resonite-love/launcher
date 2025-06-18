// Steam News API types for Resonite update information

export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  is_external_url: boolean;
  author: string;
  contents: string;
  feedlabel: string;
  date: number;
  feedname: string;
  feed_type: number;
  appid: number;
  date_formatted: string;
}

export interface SteamNewsResponse {
  appid: number;
  count: number;
  newsitems: SteamNewsItem[];
}

// UI-friendly parsed content types
export interface ParsedUpdateSection {
  title: string;
  items: string[];
}

export interface ParsedUpdateContent {
  version?: string;
  sections: ParsedUpdateSection[];
  rawContent: string;
}

export interface UpdateNote {
  gid: string;
  title: string;
  version?: string;
  date: string;
  formattedDate: string;
  author: string;
  url: string;
  parsedContent: ParsedUpdateContent;
  rawContent: string;
}