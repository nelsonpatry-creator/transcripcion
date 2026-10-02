import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  ListOrdered,
  Users,
  Send,
  Loader2,
  Sparkles,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { AudioSummary } from '../types';

interface SummarySectionProps {
  summary: AudioSummary;
  jobId: string;
  onSeekToTime: (seconds: number) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({ summary, jobId, onSeekToTime }) => {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([
    {
      q: '¿Cuál fue el acuerdo principal de la sesión?',
      a: 'El acuerdo principal fue procesar los audios extensos en bloques de 10 minutos con FFmpeg y Gemini para preservar marcas de tiempo absolutas y permitir exportaciones directas en SRT y VTT.',
    },
  ]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || asking) return;

    const currentQuestion = question.trim();
    setQuestion('');
    setAsking(true);

    try {
      const res = await fetch(`/api/transcription/${jobId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion }),
      });
      const data = await res.json();
      if (data.answer) {
        setChatHistory((prev) => [...prev, { q: currentQuestion, a: data.answer }]);
      }
    } catch (err) {
      console.error('Error asking audio', err);
    } finally {
      setAsking(false);
    }
  };

  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 text-blue-400 font-semibold text-sm">
          <FileText className="w-5 h-5" />
          <span>Resumen Ejecutivo de la Grabación</span>
        </div>
        <p className="text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-line">
          {summary.overview}
        </p>
      </div>

      {/* Grid: Key Points & Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Puntos Clave */}
        {summary.keyPoints && summary.keyPoints.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Puntos Clave Discutidos</span>
            </div>
            <ul className="space-y-2.5">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs md:text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acuerdos y Tareas */}
        {summary.actionItems && summary.actionItems.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Acuerdos y Próximos Pasos</span>
            </div>
            <ul className="space-y-2.5">
              {summary.actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs md:text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Topics Timeline and Speakers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topics list */}
        {summary.topics && summary.topics.length > 0 && (
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <ListOrdered className="w-4 h-4" />
              <span>Índice Cronológico por Temas</span>
            </div>
            <div className="space-y-3">
              {summary.topics.map((topic, i) => (
                <div
                  key={i}
                  onClick={() => onSeekToTime(parseTimeToSeconds(topic.timestamp))}
                  className="p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 transition-colors flex items-start gap-3 cursor-pointer group"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                    {topic.timestamp}
                  </button>
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                      {topic.title}
                    </h5>
                    <p className="text-xs text-slate-400 leading-snug">{topic.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Oradores Participantes */}
        {summary.speakers && summary.speakers.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <Users className="w-4 h-4" />
              <span>Participación de Oradores</span>
            </div>
            <div className="space-y-3">
              {summary.speakers.map((spk, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">{spk.name}</span>
                    <span className="font-mono text-purple-400 font-bold">{spk.talkTimeEstimate}</span>
                  </div>
                  <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{
                        width: spk.talkTimeEstimate.includes('%')
                          ? spk.talkTimeEstimate.replace(/[^0-9]/g, '') + '%'
                          : '40%',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pregúntale al audio (Interactive Transcript Q&A) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
          <HelpCircle className="w-5 h-5" />
          <span>Pregúntale a la Grabación (IA Grounded)</span>
        </div>
        <p className="text-xs text-slate-400">
          Haz cualquier consulta sobre lo dicho en las 4 horas de audio. La IA buscará en la transcripción y responderá con precisión y citas.
        </p>

        {/* Chat responses */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {chatHistory.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="bg-blue-600/10 border border-blue-500/20 text-blue-200 text-xs rounded-2xl p-3 inline-block font-medium">
                Pregunta: {item.q}
              </div>
              <div className="bg-slate-800/70 border border-slate-700/60 text-slate-200 text-xs md:text-sm rounded-2xl p-4 leading-relaxed">
                {item.a}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleAsk} className="flex gap-2 pt-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ej: ¿Qué se mencionó sobre los costos o plazos acordados?"
            disabled={asking}
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs md:text-sm font-semibold rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
          >
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Consultar
          </button>
        </form>
      </div>
    </div>
  );
};
