import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';
import {
  BoardSnapshot,
  MATCH_DURATION_SECONDS,
  MatchPhase,
  PlayerNumber,
  ROOM_CHANNEL_PREFIX,
  SnapshotPayload,
  StartPayload,
} from './types';

interface PresenceEntry {
  playerId: string;
  joinedAt: number;
}

interface UseMultiplayerSyncResult {
  phase: MatchPhase;
  playerNumber: PlayerNumber | null;
  opponentConnected: boolean;
  selfReady: boolean;
  opponentReady: boolean;
  opponentSnapshot: BoardSnapshot | null;
  startAt: number | null;
  errorMessage: string | null;
  markReady: () => void;
  sendSnapshot: (snapshot: BoardSnapshot) => void;
  requestRematch: () => void;
}

export function useMultiplayerSync(roomCode: string | null, playerId: string): UseMultiplayerSyncResult {
  const [phase, setPhase] = useState<MatchPhase>('idle');
  const [playerNumber, setPlayerNumber] = useState<PlayerNumber | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [selfReady, setSelfReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentSnapshot, setOpponentSnapshot] = useState<BoardSnapshot | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const readySetRef = useRef<Set<string>>(new Set());
  const startSentRef = useRef(false);
  const playerNumberRef = useRef<PlayerNumber | null>(null);
  const joinedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!roomCode) {
      setPhase('idle');
      return;
    }

    setPhase('connecting');
    setErrorMessage(null);
    setSelfReady(false);
    setOpponentReady(false);
    setOpponentSnapshot(null);
    setStartAt(null);
    setPlayerNumber(null);
    playerNumberRef.current = null;
    startSentRef.current = false;
    readySetRef.current = new Set();
    joinedAtRef.current = Date.now();

    let cancelled = false;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`${ROOM_CHANNEL_PREFIX}${roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId },
      },
    });
    channelRef.current = channel;

    const recomputePlayers = () => {
  const state = channel.presenceState() as Record<string, PresenceEntry[]>;
  const entries = Object.values(state)
    .map((arr) => arr[0])
        .filter((e): e is PresenceEntry => !!e)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (entries.length > 2) {
        setErrorMessage('La sala ya tiene 2 jugadores. Prueba con otro código de sala.');
        return;
      }

      const selfIndex = entries.findIndex((e) => e.playerId === playerId);
      if (selfIndex !== -1) {
        const num: PlayerNumber = selfIndex === 0 ? 1 : 2;
        playerNumberRef.current = num;
        setPlayerNumber(num);
      }

      setOpponentConnected(entries.length === 2);
      setPhase((prev) => {
        if (prev === 'active') return prev;
        return entries.length === 2 ? 'ready-wait' : 'waiting';
      });
    };

    channel.on('presence', { event: 'sync' }, recomputePlayers);

    channel.on('broadcast', { event: 'ready' }, ({ payload }: { payload: { playerId: string } }) => {
      readySetRef.current.add(payload.playerId);
      if (payload.playerId !== playerId) setOpponentReady(true);

      if (readySetRef.current.size >= 2 && !startSentRef.current && playerNumberRef.current === 1) {
        startSentRef.current = true;
        const startPayload: StartPayload = {
          startAt: Date.now() + 3000,
          durationSeconds: MATCH_DURATION_SECONDS,
        };
        channel.send({ type: 'broadcast', event: 'start', payload: startPayload });
      }
    });

    channel.on('broadcast', { event: 'start' }, ({ payload }: { payload: StartPayload }) => {
      setStartAt(payload.startAt);
      setPhase('active');
    });

    channel.on('broadcast', { event: 'snapshot' }, ({ payload }: { payload: SnapshotPayload }) => {
      if (payload.playerId === playerId) return;
      setOpponentSnapshot({
        circles: payload.circles,
        score: payload.score,
        gameOver: payload.gameOver,
      });
    });

    channel.on('broadcast', { event: 'rematch' }, () => {
      startSentRef.current = false;
      readySetRef.current = new Set();
      setSelfReady(false);
      setOpponentReady(false);
      setOpponentSnapshot(null);
      setStartAt(null);
      setPhase('ready-wait');
    });

   channel.subscribe(async (status: string) => {
      if (cancelled) return;
      if (status === 'SUBSCRIBED') {
        await channel.track({ playerId, joinedAt: joinedAtRef.current } as PresenceEntry);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setErrorMessage('No se pudo conectar a la sala. Revisa tu conexión e inténtalo de nuevo.');
      }
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, playerId]);

  const markReady = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    setSelfReady(true);
    channel.send({ type: 'broadcast', event: 'ready', payload: { playerId } });
  }, [playerId]);

  const sendSnapshot = useCallback(
    (snapshot: BoardSnapshot) => {
      const channel = channelRef.current;
      if (!channel) return;
      const payload: SnapshotPayload = { ...snapshot, playerId };
      channel.send({ type: 'broadcast', event: 'snapshot', payload });
    },
    [playerId]
  );

  const requestRematch = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({ type: 'broadcast', event: 'rematch', payload: {} });
  }, []);

  return {
    phase,
    playerNumber,
    opponentConnected,
    selfReady,
    opponentReady,
    opponentSnapshot,
    startAt,
    errorMessage,
    markReady,
    sendSnapshot,
    requestRematch,
  };
}