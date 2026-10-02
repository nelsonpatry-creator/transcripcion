import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge } from 'lucide-react';

interface AudioPlayerBarProps {
  audioUrl?: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  currentTime,
  duration,
  onSeek,
  isPlaying,
  onTogglePlay,
  playbackRate,
  onPlaybackRateChange,
}) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const formatTime = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl px-4 py-3 md:py-4 transition-all">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        {/* Scrubber slider */}
        <div className="flex items-center gap-3 w-full">
          <span className="font-mono text-xs text-blue-400 font-semibold w-16 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={1}
            value={currentTime}
            onChange={handleSliderChange}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
          />
          <span className="font-mono text-xs text-slate-400 w-16">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between">
          {/* Left: Speed selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Velocidad de reproducción"
            >
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              <span>{playbackRate}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 min-w-[90px]">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      onPlaybackRateChange(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors ${
                      playbackRate === speed
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center: Playback buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Retroceder 10 segundos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/25 transition-transform active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Adelantar 10 segundos"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Volume & Info */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-xs font-medium text-slate-400 hidden sm:inline">
              Audio sincronizado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
