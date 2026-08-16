export type PlayerNumber = 1 | 2;

export interface SimpleCircle {
  x: number;
  y: number;
  tier: number;
}

export interface BoardSnapshot {
  circles: SimpleCircle[];
  score: number;
  gameOver: boolean;
}

export interface SnapshotPayload extends BoardSnapshot {
  playerId: string;
}

export interface StartPayload {
  startAt: number;
  durationSeconds: number;
}

export type MatchPhase = 'idle' | 'connecting' | 'waiting' | 'ready-wait' | 'active';

export const MATCH_DURATION_SECONDS = 120;
export const ROOM_CHANNEL_PREFIX = 'suika-match-';