import React from 'react';
import { Loader2, CheckCircle2, Clock, Layers, Sparkles, AlertCircle, Globe2 } from 'lucide-react';
import { TranscriptionJob } from '../types';

interface TranscriptionProgressProps {
  job: TranscriptionJob;
  onCancel?: () => void;
}

export const TranscriptionProgress: React.FC<TranscriptionProgressProps> = ({ job }) => {
  const formatTime = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Status Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Procesando Audio de Gran Duración
              </span>
              {job.language && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                  <Globe2 className="w-3 h-3" />
                  {job.language}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="truncate max-w-md">{job.originalName}</span>
            </h3>
            {job.durationSeconds > 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Duración detectada:
                <strong className="text-slate-200">{formatTime(job.durationSeconds)}</strong>
                {job.totalChunks > 0 && (
                  <span className="ml-2 text-slate-500">
                    ({job.totalChunks} bloques de procesamiento)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-black text-blue-400">{job.progress}%</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Completado</div>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500 shadow-sm shadow-blue-500/50"
              style={{ width: `${Math.max(4, job.progress)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {job.currentStageMessage}
            </span>
            {job.totalChunks > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Fragmento {job.processedChunks} / {job.totalChunks}
              </span>
            )}
          </div>
        </div>

        {/* Milestone Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div
            className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
              job.progress >= 10
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className={`w-3.5 h-3.5 ${job.progress >= 10 ? 'text-emerald-400' : 'text-slate-600'}`} />
              1. Carga y Slicing
            </div>
            <p className="text-[11px] text-slate-400">Segmentación FFmpeg</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
              job.progress >= 40
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : job.progress >= 10
                ? 'bg-blue-950/30 border-blue-500/40 text-blue-200'
                : 'bg-slate-800/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className={`w-3.5 h-3.5 ${job.progress >= 40 ? 'text-emerald-400' : 'text-slate-600'}`} />
              2. Transcripción IA
            </div>
            <p className="text-[11px] text-slate-400">Gemini 3.5 Transcribe</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
              job.progress >= 85
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : job.progress >= 50
                ? 'bg-blue-950/30 border-blue-500/40 text-blue-200'
                : 'bg-slate-800/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className={`w-3.5 h-3.5 ${job.progress >= 85 ? 'text-emerald-400' : 'text-slate-600'}`} />
              3. Unificación
            </div>
            <p className="text-[11px] text-slate-400">Alineación de marcas</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
              job.progress >= 95
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className={`w-3.5 h-3.5 ${job.progress >= 95 ? 'text-emerald-400' : 'text-slate-600'}`} />
              4. Resumen & Insights
            </div>
            <p className="text-[11px] text-slate-400">Puntos clave y acuerdos</p>
          </div>
        </div>

        {/* Error Notification */}
        {job.errorMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold">Error al procesar:</p>
              <p className="text-xs text-rose-200">{job.errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Live segments stream preview */}
      {job.segments.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              Fragmentos transcritos en tiempo real ({job.segments.length} líneas)
            </h4>
            <span className="text-xs text-slate-500">Se actualiza automáticamente</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2.5 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
            {job.segments.slice(-5).map((seg) => (
              <div key={seg.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-mono text-blue-400 font-semibold">{seg.formattedTime}</span>
                  <span className="font-medium text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-md">
                    {seg.speaker}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
