import { useEffect, useRef, useState } from 'react';
import Lobby from './Lobby';
import PlayerBoard from './SuikaGame';
import OpponentBoard from './OpponentBoard';
import { useMultiplayerSync } from '@/multiplayer/useMultiplayerSync';
import { MATCH_DURATION_SECONDS } from '@/multiplayer/types';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function MultiplayerSuikaGame() {
  const [playerId] = useState(() => crypto.randomUUID());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [myScore, setMyScore] = useState(0);

  const {
    phase,
    playerNumber,
    opponentReady,
    opponentSnapshot,
    startAt,
    errorMessage,
    markReady,
    sendSnapshot,
    requestRematch,
    selfReady,
  } = useMultiplayerSync(roomCode, playerId);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const prevStartAtRef = useRef<number | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  useEffect(() => {
    if (prevStartAtRef.current !== null && startAt === null) {
      setResetSignal((s) => s + 1);
      setMyScore(0);
    }
    prevStartAtRef.current = startAt;
  }, [startAt]);

  if (errorMessage) {
    return <CenteredMessage text={errorMessage} onLeave={() => setRoomCode(null)} />;
  }

  if (!roomCode || phase === 'idle') {
    return <Lobby onJoin={setRoomCode} />;
  }

  if (phase === 'connecting') {
    return <CenteredMessage text="Conectando a la sala..." />;
  }

  if (phase === 'waiting') {
    return (
      <CenteredMessage
        text="Esperando al segundo jugador..."
        sub="Comparte este código con tu rival"
        code={roomCode}
        onLeave={() => setRoomCode(null)}
      />
    );
  }

  if (phase === 'ready-wait') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0a1f] via-[#1a1230] to-[#0a0815] flex flex-col items-center justify-center p-4 gap-4 text-center">
        <p className="text-white/70">Sala {roomCode} · Los dos jugadores están conectados</p>
        <p className="text-white/40 text-sm">
          {opponentReady ? 'Tu rival está listo' : 'Esperando a que tu rival esté listo...'}
        </p>
        <button
          onClick={markReady}
          disabled={selfReady}
          className="bg-gradient-to-r from-rose-500 to-orange-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-2xl transition-all"
        >
          {selfReady ? 'Esperando...' : 'Listo'}
        </button>
      </div>
    );
  }

  const countdownRemaining = startAt ? Math.max(0, Math.ceil((startAt - now) / 1000)) : 0;
  const matchStarted = !!startAt && now >= startAt;
  const elapsed = startAt ? Math.max(0, (now - startAt) / 1000) : 0;
  const timeRemaining = startAt ? Math.max(0, MATCH_DURATION_SECONDS - elapsed) : MATCH_DURATION_SECONDS;
  const matchFinished = matchStarted && timeRemaining <= 0;
  const boardActive = matchStarted && !matchFinished;

  const opponentScore = opponentSnapshot?.score ?? 0;
  const myNumber = playerNumber ?? 1;
  const oppNumber = myNumber === 1 ? 2 : 1;

  let resultText: string | null = null;
  if (matchFinished) {
    if (myScore > opponentScore) resultText = '¡Ganaste!';
    else if (myScore < opponentScore) resultText = 'Perdiste';
    else resultText = 'Empate';
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0a1f] via-[#1a1230] to-[#0a0815] flex flex-col items-center p-4 select-none">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Suika Merge · Sala {roomCode}</h1>
            <p className="text-xs text-white/40">Jugador {myNumber}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-2xl px-5 py-2 border border-white/10 text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Tiempo</div>
            <div className="text-xl font-bold text-white tabular-nums">{formatTime(timeRemaining)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <ScoreHeader label={`Tú · Jugador ${myNumber}`} score={myScore} highlight />
            <PlayerBoard
              active={boardActive}
              onScoreChange={setMyScore}
              onGameOverChange={() => {}}
              onSnapshot={sendSnapshot}
              resetSignal={resetSignal}
            />
          </div>
          <div>
            <ScoreHeader label={`Rival · Jugador ${oppNumber}`} score={opponentScore} />
            <OpponentBoard snapshot={opponentSnapshot} />
          </div>
        </div>

        {!matchStarted && countdownRemaining > 0 && (
          <Overlay>
            <div className="text-6xl font-black text-white">{countdownRemaining}</div>
            <p className="text-white/50 mt-2">¡Prepárate!</p>
          </Overlay>
        )}

        {matchFinished && (
          <Overlay>
            <div className="text-4xl font-black text-white mb-2">{resultText}</div>
            <p className="text-white/50 text-sm mb-4">
              Tú: {myScore.toLocaleString()} · Rival: {opponentScore.toLocaleString()}
            </p>
            <div className="flex gap-3">
              <button
                onClick={requestRematch}
                className="bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold px-8 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95"
              >
                Revancha
              </button>
              <button
                onClick={() => setRoomCode(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-2xl"
              >
                Salir
              </button>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function ScoreHeader({ label, score, highlight = false }: { label: string; score: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${highlight ? 'text-white' : 'text-white/70'}`}>
        {score.toLocaleString()}
      </span>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-center px-8">
      {children}
    </div>
  );
}

function CenteredMessage({
  text,
  sub,
  code,
  onLeave,
}: {
  text: string;
  sub?: string;
  code?: string;
  onLeave?: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0a1f] via-[#1a1230] to-[#0a0815] flex flex-col items-center justify-center p-4 gap-3 text-center select-none">
      <p className="text-white/80 font-semibold">{text}</p>
      {sub && <p className="text-white/40 text-sm">{sub}</p>}
      {code && (
        <div className="bg-white/10 rounded-2xl px-6 py-3 text-2xl font-black tracking-widest text-white">
          {code}
        </div>
      )}
      {onLeave && (
        <button onClick={onLeave} className="text-white/40 text-sm underline mt-2">
          Salir
        </button>
      )}
    </div>
  );
}