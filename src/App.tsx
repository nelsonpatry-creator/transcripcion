import React, { useState, useEffect, useRef } from 'react';
import {
  FileAudio,
  Sparkles,
  Download,
  Share2,
  RefreshCw,
  FileText,
  ListFilter,
  CheckCircle2,
  Clock,
  Volume2,
  Info,
  Layers,
  ArrowRight,
  Globe2,
} from 'lucide-react';
import { TranscriptionJob, TranscriptSegment } from './types';
import { AudioUploader } from './components/AudioUploader';
import { TranscriptionProgress } from './components/TranscriptionProgress';
import { TranscriptViewer } from './components/TranscriptViewer';
import { SummarySection } from './components/SummarySection';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [currentJob, setCurrentJob] = useState<TranscriptionJob | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Audio Player State
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Polling ref for running transcription
  const pollingRef = useRef<any>(null);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Poll job status until completed or error
  const pollJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/transcription/status/${jobId}`);
      if (!res.ok) return;
      const data: TranscriptionJob = await res.json();
      setCurrentJob(data);

      if (data.status === 'completed' || data.status === 'error') {
        clearInterval(pollingRef.current);
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  // Start polling when job changes to in-progress
  useEffect(() => {
    if (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'error') {
      pollingRef.current = setInterval(() => {
        pollJobStatus(currentJob.id);
      }, 1500);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentJob?.id, currentJob?.status]);

  // Handle uploaded file with selected language
  const handleFileSelect = async (file: File, language: string = 'Español') => {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', language);

    // Initial placeholder job
    const tempJob: TranscriptionJob = {
      id: 'pending-' + Date.now(),
      filename: file.name,
      originalName: file.name,
      fileSize: file.size,
      durationSeconds: 0,
      status: 'uploading',
      progress: 5,
      totalChunks: 0,
      processedChunks: 0,
      currentStageMessage: `Subiendo archivo al servidor (Idioma: ${language})...`,
      segments: [],
      createdAt: Date.now(),
      language: language,
    };
    setCurrentJob(tempJob);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.jobId) {
        pollJobStatus(data.jobId);
      } else {
        throw new Error(data.error || 'Error al iniciar la transcripción');
      }
    } catch (err: any) {
      console.error('Upload error', err);
      setCurrentJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage: err.message || 'Error de conexión durante la subida',
            }
          : null
      );
    }
  };

  // Handle Demo Audio
  const handleLoadDemo = async () => {
    try {
      const res = await fetch('/api/transcribe-demo', { method: 'POST' });
      const data = await res.json();
      if (data.jobId) {
        pollJobStatus(data.jobId);
      }
    } catch (err) {
      console.error('Demo loading error', err);
    }
  };

  // Audio Playback Handlers
  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn('Audio play error:', e));
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Rename speaker across job
  const handleRenameSpeaker = async (oldName: string, newName: string) => {
    if (!currentJob) return;
    try {
      const res = await fetch(`/api/transcription/${currentJob.id}/rename-speaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentJob((prev) =>
          prev
            ? {
                ...prev,
                segments: data.segments,
                summary: data.summary,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Rename speaker failed', err);
    }
  };

  // Inline update segment text
  const handleUpdateSegmentText = (id: string, newText: string) => {
    if (!currentJob) return;
    setCurrentJob((prev) =>
      prev
        ? {
            ...prev,
            segments: prev.segments.map((s) => (s.id === id ? { ...s, text: newText } : s)),
          }
        : null
    );
  };

  const isCompleted = currentJob?.status === 'completed';
  const isRunning =
    currentJob &&
    currentJob.status !== 'completed' &&
    currentJob.status !== 'error';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 pb-28">
      {/* Hidden audio element for playback */}
      {currentJob?.audioUrl && (
        <audio
          ref={audioRef}
          src={currentJob.audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setAudioDuration(audioRef.current.duration || currentJob.durationSeconds || 14400);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                AudioTranscripción Pro
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  4 Horas+
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Gemini 3.5 Transcribe con segmentación de gran volumen
              </p>
            </div>
          </div>

          {/* Header Action buttons */}
          <div className="flex items-center gap-2.5">
            {isCompleted && (
              <>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar (SRT/TXT/MD)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentJob(null);
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  title="Nueva transcripción"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {!currentJob && (
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Demo 4h
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
        {/* VIEW 1: Idle / Upload State */}
        {!currentJob && (
          <div className="space-y-10">
            {/* Hero Section with clear explanation */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                <Sparkles className="w-3.5 h-3.5" /> Diseñado para audios de hasta 4 horas sin caídas
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                Convierte audios de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">4 horas</span> a texto exacto
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                Reuniones largas, conferencias universitarias, podcasts maratónicos o grabaciones judiciales.
                Procesamos archivos pesados de cualquier tamaño mediante segmentación inteligente y el modelo oficial de transcripción de Google Gemini.
              </p>
            </div>

            {/* Uploader Component */}
            <AudioUploader
              onFileSelect={handleFileSelect}
              onLoadDemo={handleLoadDemo}
              isProcessing={false}
            />

            {/* FAQ / How it works */}
            <div className="max-w-4xl mx-auto bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                ¿Cómo procesamos audios de 4 horas sin límite de memoria?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <h5 className="font-semibold text-white">1. Particionamiento con FFmpeg</h5>
                  <p className="text-slate-400">
                    Un audio de 4 horas en MP3 o WAV puede pesar entre 150MB y 1GB. El servidor lo divide en bloques de 10 minutos comprimidos a 16kHz mono, optimizando el ancho de banda y la velocidad.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <h5 className="font-semibold text-white">2. Sincronización continua de tiempo</h5>
                  <p className="text-slate-400">
                    Cada fragmento calcula el offset en segundos, por lo que las marcas van continuas de <code className="text-blue-300">00:00:00</code> hasta <code className="text-blue-300">04:00:00</code> sin reiniciarse.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <h5 className="font-semibold text-white">3. Diarización de oradores</h5>
                  <p className="text-slate-400">
                    Gemini reconoce cuando cambia el hablante ("Hablante 1", "Hablante 2") y permite renombrarlos en lote para toda la grabación con un solo clic.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <h5 className="font-semibold text-white">4. Exportación versátil</h5>
                  <p className="text-slate-400">
                    Descarga en subtítulos SRT para edición de video (Premiere, CapCut), WebVTT para sitios web, texto limpio para documentos o Markdown con resumen ejecutivo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Processing in progress */}
        {isRunning && (
          <TranscriptionProgress job={currentJob} />
        )}

        {/* VIEW 3: Completed Results */}
        {isCompleted && currentJob && (
          <div className="space-y-6">
            {/* Session Overview Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Transcripción Completada
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white truncate max-w-xl">
                  {currentJob.originalName}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1 font-mono text-blue-400 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(currentJob.durationSeconds || 14400)}
                  </span>
                  <span>•</span>
                  <span>{currentJob.segments.length} párrafos sincronizados</span>
                  <span>•</span>
                  <span>{currentJob.totalChunks || 24} bloques de 10 min</span>
                  {currentJob.language && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                        <Globe2 className="w-3 h-3" />
                        {currentJob.language}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('transcript')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'transcript'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Transcripción
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Resumen & Acuerdos
                </button>
              </div>
            </div>

            {/* Active Tab Content */}
            {activeTab === 'transcript' ? (
              <TranscriptViewer
                segments={currentJob.segments}
                currentTime={currentTime}
                durationSeconds={currentJob.durationSeconds || 14400}
                onSeek={handleSeek}
                onRenameSpeaker={handleRenameSpeaker}
                onUpdateSegmentText={handleUpdateSegmentText}
              />
            ) : (
              currentJob.summary && (
                <SummarySection
                  summary={currentJob.summary}
                  jobId={currentJob.id}
                  onSeekToTime={handleSeek}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Audio Player Bar when audio is available */}
      {isCompleted && currentJob && (
        <AudioPlayerBar
          audioUrl={currentJob.audioUrl}
          currentTime={currentTime}
          duration={audioDuration || currentJob.durationSeconds || 14400}
          onSeek={handleSeek}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          playbackRate={playbackRate}
          onPlaybackRateChange={handlePlaybackRateChange}
        />
      )}

      {/* Export Modal */}
      {isCompleted && currentJob && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          segments={currentJob.segments}
          summary={currentJob.summary}
          filename={currentJob.originalName}
          durationFormatted={formatTime(currentJob.durationSeconds || 14400)}
        />
      )}
    </div>
  );
}
