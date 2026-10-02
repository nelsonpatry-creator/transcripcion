import React, { useState } from 'react';
import { X, Download, Copy, Check, FileText, Subtitles, Code, FileCode } from 'lucide-react';
import { TranscriptSegment, AudioSummary } from '../types';
import {
  generatePlainText,
  generateSRT,
  generateVTT,
  generateMarkdown,
  downloadFile,
} from '../utils/exportHelpers';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  summary?: AudioSummary;
  filename: string;
  durationFormatted: string;
}

type ExportType = 'txt' | 'srt' | 'vtt' | 'md' | 'json';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  summary,
  filename,
  durationFormatted,
}) => {
  const [format, setFormat] = useState<ExportType>('txt');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const baseName = filename.replace(/\.[^/.]+$/, '');

  const getExportContent = (): { content: string; filename: string; mime: string } => {
    switch (format) {
      case 'srt':
        return {
          content: generateSRT(segments),
          filename: `${baseName}_subtitulos.srt`,
          mime: 'application/x-subrip;charset=utf-8',
        };
      case 'vtt':
        return {
          content: generateVTT(segments),
          filename: `${baseName}_subtitulos.vtt`,
          mime: 'text/vtt;charset=utf-8',
        };
      case 'md':
        return {
          content: generateMarkdown(baseName, durationFormatted, segments, summary),
          filename: `${baseName}_informe_transcripcion.md`,
          mime: 'text/markdown;charset=utf-8',
        };
      case 'json':
        return {
          content: JSON.stringify({ filename: baseName, duration: durationFormatted, summary, segments }, null, 2),
          filename: `${baseName}_transcripcion.json`,
          mime: 'application/json;charset=utf-8',
        };
      case 'txt':
      default:
        return {
          content: generatePlainText(segments, includeTimestamps, includeSpeakers),
          filename: `${baseName}_transcripcion.txt`,
          mime: 'text/plain;charset=utf-8',
        };
    }
  };

  const handleDownload = () => {
    const { content, filename: exportFileName, mime } = getExportContent();
    downloadFile(content, exportFileName, mime);
  };

  const handleCopy = async () => {
    const { content } = getExportContent();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Exportar Transcripción</h3>
            <p className="text-xs text-slate-400">Elige el formato ideal para tu flujo de trabajo</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setFormat('txt')}
            className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
              format === 'txt'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <FileText className="w-5 h-5 text-blue-400" />
            <div className="font-semibold text-xs text-white">Texto (.TXT)</div>
            <div className="text-[10px] text-slate-400">Ideal para Word, Docs o Notas</div>
          </button>

          <button
            type="button"
            onClick={() => setFormat('srt')}
            className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
              format === 'srt'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Subtitles className="w-5 h-5 text-indigo-400" />
            <div className="font-semibold text-xs text-white">Subtítulos (.SRT)</div>
            <div className="text-[10px] text-slate-400">Premiere, YouTube, CapCut</div>
          </button>

          <button
            type="button"
            onClick={() => setFormat('vtt')}
            className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
              format === 'vtt'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Subtitles className="w-5 h-5 text-purple-400" />
            <div className="font-semibold text-xs text-white">WebVTT (.VTT)</div>
            <div className="text-[10px] text-slate-400">HTML5 Video y Web</div>
          </button>

          <button
            type="button"
            onClick={() => setFormat('md')}
            className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
              format === 'md'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <FileCode className="w-5 h-5 text-emerald-400" />
            <div className="font-semibold text-xs text-white">Markdown (.MD)</div>
            <div className="text-[10px] text-slate-400">Incluye resumen y temas</div>
          </button>

          <button
            type="button"
            onClick={() => setFormat('json')}
            className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
              format === 'json'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Code className="w-5 h-5 text-amber-400" />
            <div className="font-semibold text-xs text-white">Datos JSON (.JSON)</div>
            <div className="text-[10px] text-slate-400">Estructura para desarrolladores</div>
          </button>
        </div>

        {/* Options for TXT */}
        {format === 'txt' && (
          <div className="p-3 bg-slate-800/40 rounded-xl space-y-2 border border-slate-800 text-xs">
            <span className="font-semibold text-slate-300">Opciones de formato TXT:</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 accent-blue-600"
                />
                Incluir marcas de tiempo [HH:MM:SS]
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSpeakers}
                  onChange={(e) => setIncludeSpeakers(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 accent-blue-600"
                />
                Incluir nombres de los oradores
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar texto'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar archivo
          </button>
        </div>
      </div>
    </div>
  );
};
