export interface Stream {
  url: string;
  quality: string | null;
  label: string | null;
  referrer: string | null;
  user_agent: string | null;
}

export interface Channel {
  id: string;
  name: string;
  categories: string[];
  country: string;
  logo: string | null;
  streams: Stream[];
}

export type StreamStatus = 'alive' | 'dead' | 'unknown' | 'checking';
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface Category {
  id: string;
  name: string;
}

export type StreamStatusMap = Record<string, StreamStatus>;
export interface Country {
  name: string;
  code: string;
  flag: string;
}

export type CategoryCount = Record<string, number>;

/* Raw API shapes */
export interface RawChannel {
  id: string;
  name: string;
  categories: string[];
  country: string;
  is_nsfw: boolean;
}

export interface RawStream {
  channel: string;
  url: string;
  quality?: string | null;
  label?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
}

export interface RawLogo {
  channel: string;
  url: string;
  in_use?: boolean;
}

export interface RawCategory {
  id: string;
  name: string;
}

export interface RawBlocked {
  channel: string;
}