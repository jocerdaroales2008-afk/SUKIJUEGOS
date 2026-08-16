import { useState } from 'react';

interface LobbyProps {
  onJoin: (roomCode: string) => void;
}

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Lobby({ onJoin }: LobbyProps) {
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0a1f] via-[#1a1230] to-[#0a0815] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur rounded-3xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">Suika Merge · 2 Jugadores</h1>
        <p className="text-white/40 text-sm text-center mb-6">Crea una sala o únete con un código</p>

        <button
          onClick={() => onJoin(randomRoomCode())}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold py-3 rounded-2xl mb-4 transition-all hover:scale-[1.02] active:scale-95"
        >
          Crear sala nueva
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-white/30 text-xs">o</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código de sala"
            maxLength={5}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 tracking-widest text-center font-bold outline-none focus:border-white/30"
          />
          <button
            onClick={() => code.trim() && onJoin(code.trim())}
            disabled={!code.trim()}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold px-5 rounded-2xl transition-all"
          >
            Unirse
          </button>
        </div>
      </div>
    </div>
  );
}