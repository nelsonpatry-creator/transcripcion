import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  Clock,
  Play,
  Edit2,
  Check,
  X,
  Filter,
  UserCheck,
  ArrowUpDown,
  BarChart3,
  VolumeX,
  MessageSquare,
  Activity,
  Sparkles,
  Timer,
} from 'lucide-react';
import { TranscriptSegment } from '../types';

// Stopwords list in Spanish & English to extract truly meaningful topical words
const STOPWORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no',
  'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta',
  'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde',
  'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos',
  'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa',
  'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas',
  'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros',
  'vosotras', 'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya',
  'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros',
  'vuestras', 'es', 'son', 'fue', 'era', 'ha', 'han', 'ser', 'sido', 'está', 'están', 'estaba', 'estaban',
  'vamos', 'hacer', 'puede', 'pueden', 'tiene', 'tienen', 'había', 'haber', 'bueno', 'bien', 'aquí', 'ahí',
  'hoy', 'día', 'días', 'después', 'cada', 'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
  'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by',
  'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
  'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
]);

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  durationSeconds?: number;
  onSeek: (seconds: number) => void;
  onRenameSpeaker: (oldName: string, newName: string) => Promise<void>;
  onUpdateSegmentText: (id: string, newText: string) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  currentTime,
  durationSeconds = 0,
  onSeek,
  onRenameSpeaker,
  onUpdateSegmentText,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [editingSpeakerModal, setEditingSpeakerModal] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingSegmentText, setEditingSegmentText] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Extract unique speakers
  const uniqueSpeakers = useMemo(() => {
    const set = new Set<string>();
    segments.forEach((s) => {
      if (s.speaker) set.add(s.speaker);
    });
    return Array.from(set);
  }, [segments]);

  // Total words count
  const totalWords = useMemo(() => {
    return segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
  }, [segments]);

  // Statistical Calculation 1: Most frequent meaningful word
  const mostFrequentWord = useMemo(() => {
    const wordCounts: Record<string, number> = {};

    segments.forEach((seg) => {
      const words = seg.text
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»[\]]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));

      words.forEach((w) => {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });

    let topWord = '';
    let topCount = 0;
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count > topCount) {
        topCount = count;
        topWord = word;
      }
    }

    return {
      word: topWord ? topWord.charAt(0).toUpperCase() + topWord.slice(1) : 'Audio',
      count: topCount || 1,
    };
  }, [segments]);

  // Statistical Calculation 2: Total silence duration detected
  const silenceStats = useMemo(() => {
    if (segments.length === 0) {
      return { totalSeconds: 0, formatted: '0 s', percentage: 0 };
    }

    const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
    let totalSilence = 0;

    // Initial silence before first words
    if (sorted[0].startSeconds > 1.5) {
      totalSilence += sorted[0].startSeconds;
    }

    // Silence gaps between consecutive segments
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].startSeconds - sorted[i - 1].endSeconds;
      if (gap > 1.5) {
        totalSilence += gap;
      }
    }

    // Final silence after last segment
    const effectiveDuration = durationSeconds > 0 ? durationSeconds : sorted[sorted.length - 1].endSeconds + 10;
    const lastEnd = sorted[sorted.length - 1].endSeconds;
    if (effectiveDuration > lastEnd + 2) {
      totalSilence += (effectiveDuration - lastEnd);
    }

    const percentage = effectiveDuration > 0
      ? Math.min(100, Math.round((totalSilence / effectiveDuration) * 100))
      : 0;

    // Format human-readable string (e.g., "14m 20s" or "1h 12m")
    const formatSilence = (seconds: number): string => {
      const s = Math.round(seconds);
      const hours = Math.floor(s / 3600);
      const minutes = Math.floor((s % 3600) / 60);
      const remainingSeconds = s % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
      }
      if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${remainingSeconds}s`;
    };

    return {
      totalSeconds: totalSilence,
      formatted: formatSilence(totalSilence),
      percentage,
    };
  }, [segments, durationSeconds]);

  // Statistical Calculation 3: Speech pace (Words per minute - WPM)
  const speechPaceWpm = useMemo(() => {
    const totalSpeakingSeconds = segments.reduce(
      (acc, s) => acc + Math.max(1, s.endSeconds - s.startSeconds),
      0
    );
    if (totalSpeakingSeconds <= 0 || totalWords <= 0) return 0;
    return Math.round((totalWords / (totalSpeakingSeconds / 60)));
  }, [segments, totalWords]);

  // Filtered segments based on search and speaker filter
  const filteredSegments = useMemo(() => {
    return segments.filter((seg) => {
      const matchesSpeaker = selectedSpeaker === 'all' || seg.speaker === selectedSpeaker;
      const matchesSearch =
        searchQuery.trim() === '' ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.formattedTime.includes(searchQuery);
      return matchesSpeaker && matchesSearch;
    });
  }, [segments, selectedSpeaker, searchQuery]);

  // Handle speaker renaming
  const handleConfirmRename = async () => {
    if (!editingSpeakerModal || !newSpeakerName.trim() || isRenaming) return;
    setIsRenaming(true);
    try {
      await onRenameSpeaker(editingSpeakerModal, newSpeakerName.trim());
      setEditingSpeakerModal(null);
      setNewSpeakerName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle inline segment edit
  const handleSaveSegment = (id: string) => {
    onUpdateSegmentText(id, editingSegmentText);
    setEditingSegmentId(null);
  };

  return (
    <div className="space-y-4">
      {/* PANEL INFORMATIVO DE ESTADÍSTICAS RÁPIDAS DE LA GRABACIÓN */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Estadísticas Rápidas de la Grabación
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  En Vivo
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Métricas analíticas calculadas de la transcripción y marcas de tiempo
              </p>
            </div>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Número Total de Oradores */}
          <div className="bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Oradores Detectados</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">
              {uniqueSpeakers.length}{' '}
              <span className="text-xs font-normal text-slate-400">
                {uniqueSpeakers.length === 1 ? 'orador' : 'oradores'}
              </span>
            </div>
            <div className="text-[11px] text-purple-300 truncate" title={uniqueSpeakers.join(', ')}>
              {uniqueSpeakers.length > 0
                ? `${uniqueSpeakers.slice(0, 2).join(', ')}${uniqueSpeakers.length > 2 ? ` (+${uniqueSpeakers.length - 2})` : ''}`
                : 'Sin oradores'}
            </div>
          </div>

          {/* Card 2: Palabra Más Frecuente */}
          <div
            onClick={() => setSearchQuery(mostFrequentWord.word.toLowerCase())}
            className="bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-1.5 transition-colors cursor-pointer group"
            title="Haz clic para buscar y filtrar esta palabra en la transcripción"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Palabra Más Frecuente</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-black text-blue-300 truncate">
              "{mostFrequentWord.word}"
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{mostFrequentWord.count} {mostFrequentWord.count === 1 ? 'mención' : 'menciones'}</span>
              <span className="text-[10px] text-blue-400 underline opacity-0 group-hover:opacity-100 transition-opacity">
                Filtrar
              </span>
            </div>
          </div>

          {/* Card 3: Duración Total de Silencio */}
          <div className="bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Silencio Total</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <VolumeX className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-black text-amber-300">
              {silenceStats.formatted}
            </div>
            <div className="text-[11px] text-slate-400">
              {silenceStats.percentage}% de pausas/silencio en el audio
            </div>
          </div>

          {/* Card 4: Ritmo de Locución */}
          <div className="bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-1.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Ritmo de Locución</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-300">
              {speechPaceWpm}{' '}
              <span className="text-xs font-normal text-slate-400">PPM</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {totalWords.toLocaleString()} palabras habladas
            </div>
          </div>
        </div>
      </div>

      {/* Top Filter & Search Controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 md:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar palabras clave, temas o marcas de tiempo..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Speaker filter & Rename button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl px-3 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-800">
                Todos los oradores ({uniqueSpeakers.length})
              </option>
              {uniqueSpeakers.map((spk) => (
                <option key={spk} value={spk} className="bg-slate-800">
                  {spk}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (uniqueSpeakers[0]) {
                setEditingSpeakerModal(uniqueSpeakers[0]);
                setNewSpeakerName(uniqueSpeakers[0]);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-2xl transition-colors cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            Renombrar oradores
          </button>
        </div>
      </div>

      {/* Info Stats Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2">
        <div>
          Mostrando <strong className="text-white">{filteredSegments.length}</strong> de{' '}
          <strong className="text-white">{segments.length}</strong> segmentos ({totalWords.toLocaleString()} palabras)
        </div>
        {searchQuery && (
          <div className="text-blue-400 font-medium">
            Filtro activo para "{searchQuery}"
          </div>
        )}
      </div>

      {/* Segments Stream / List */}
      <div className="space-y-3">
        {filteredSegments.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-2">
            <p className="text-slate-300 text-sm font-medium">No se encontraron segmentos coincidentes.</p>
            <p className="text-slate-500 text-xs">Prueba con otra palabra clave o restablece los filtros.</p>
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isCurrent = currentTime >= seg.startSeconds && currentTime <= seg.endSeconds;

            return (
              <div
                key={seg.id}
                className={`group p-4 md:p-5 rounded-2xl border transition-all duration-200 ${
                  isCurrent
                    ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/80'
                }`}
              >
                {/* Segment Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {/* Timestamp seek button */}
                    <button
                      type="button"
                      onClick={() => onSeek(seg.startSeconds)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-400 font-mono text-xs font-bold transition-all cursor-pointer"
                      title="Saltar a este punto en el audio"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {seg.formattedTime}
                    </button>

                    {/* Speaker badge (clickable to rename) */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSpeakerModal(seg.speaker);
                        setNewSpeakerName(seg.speaker);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Haz clic para renombrar a este orador en toda la grabación"
                    >
                      <Users className="w-3 h-3 text-purple-400" />
                      {seg.speaker}
                    </button>
                  </div>

                  {/* Edit button */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSegmentId(seg.id);
                        setEditingSegmentText(seg.text);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Editar texto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Segment Content (editable or static) */}
                {editingSegmentId === seg.id ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      value={editingSegmentText}
                      onChange={(e) => setEditingSegmentText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-800 border border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSegmentId(null)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveSegment(seg.id)}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-200 text-sm md:text-base leading-relaxed pl-1">
                    {searchQuery ? (
                      // Highlight searched phrase
                      seg.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                          <mark key={i} className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      )
                    ) : (
                      seg.text
                    )}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Speaker Rename Modal */}
      {editingSpeakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Renombrar Orador
              </h4>
              <button
                onClick={() => setEditingSpeakerModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Selecciona y cambia el nombre de <strong className="text-white">"{editingSpeakerModal}"</strong> en toda la transcripción de las 4 horas con un solo clic.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Selecciona orador existente:
              </label>
              <select
                value={editingSpeakerModal}
                onChange={(e) => {
                  setEditingSpeakerModal(e.target.value);
                  setNewSpeakerName(e.target.value);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {uniqueSpeakers.map((spk) => (
                  <option key={spk} value={spk}>
                    {spk}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Nuevo nombre del orador:</label>
              <input
                type="text"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                placeholder="Ej: Nelson (Host), Dr. García, Entrevistador..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingSpeakerModal(null)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={isRenaming || !newSpeakerName.trim()}
                className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isRenaming ? 'Actualizando...' : 'Actualizar en todo el audio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
