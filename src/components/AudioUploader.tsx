import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  Clock,
  ShieldCheck,
  Sparkles,
  Mic,
  Square,
  Play,
  Languages,
  Check,
  Globe2,
} from 'lucide-react';

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  popular?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'Español', name: 'Español', flag: '🇪🇸', popular: true },
  { code: 'Inglés', name: 'Inglés (English)', flag: '🇺🇸', popular: true },
  { code: 'Portugués', name: 'Portugués (Português)', flag: '🇧🇷', popular: true },
  { code: 'Francés', name: 'Francés (Français)', flag: '🇫🇷', popular: true },
  { code: 'auto', name: 'Detección automática', flag: '✨', popular: true },
  { code: 'Alemán', name: 'Alemán (Deutsch)', flag: '🇩🇪' },
  { code: 'Italiano', name: 'Italiano', flag: '🇮🇹' },
  { code: 'Catalán', name: 'Catalán (Català)', flag: '🚩' },
  { code: 'Gallego', name: 'Gallego (Galego)', flag: '🚩' },
  { code: 'Euskera', name: 'Euskera', flag: '🚩' },
  { code: 'Ruso', name: 'Ruso (Русский)', flag: '🇷🇺' },
  { code: 'Japonés', name: 'Japonés (日本語)', flag: '🇯🇵' },
  { code: 'Chino Mandarín', name: 'Chino Mandarín (中文)', flag: '🇨🇳' },
  { code: 'Árabe', name: 'Árabe (العربية)', flag: '🇸🇦' },
  { code: 'Holandés', name: 'Holandés (Nederlands)', flag: '🇳🇱' },
  { code: 'Coreano', name: 'Coreano (한국어)', flag: '🇰🇷' },
  { code: 'Hindi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'Polaco', name: 'Polaco (Polski)', flag: '🇵🇱' },
  { code: 'Sueco', name: 'Sueco (Svenska)', flag: '🇸🇪' },
];

interface AudioUploaderProps {
  onFileSelect: (file: File, language: string) => void;
  onLoadDemo: (language?: string) => void;
  isProcessing: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onFileSelect, onLoadDemo, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Español');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
  };

  const startTranscription = () => {
    if (selectedFile) {
      onFileSelect(selectedFile, selectedLanguage);
    }
  };

  // Microphone recording for instant testing
  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const recordedFile = new File([audioBlob], `grabacion-${Date.now()}.webm`, { type: 'audio/webm' });
          setSelectedFile(recordedFile);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start(1000);
        setIsRecording(true);
        setRecordingSeconds(0);
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.');
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const activeLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || {
    code: selectedLanguage,
    name: selectedLanguage,
    flag: '🌐',
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Banner de confirmación para 4 Horas */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900/40 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl mt-1">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                ¡Sí! Es 100% posible transcribir audios de 4 horas o más
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                Soporte hasta 4h+ (2GB)
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Un audio de 4 horas suele saturar herramientas convencionales por su gran peso (100MB - 500MB).
              Nuestra arquitectura procesa el archivo con <strong>FFmpeg</strong> en el servidor dividiéndolo en fragmentos optimizados de 10 minutos
              y utiliza <strong>Gemini 3.5 Transcribe</strong> con marcas de tiempo continuas (desde <code className="text-blue-300">00:00:00</code> hasta <code className="text-blue-300">04:00:00</code>) y detección de interlocutores.
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" /> Marcas de tiempo continuas
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Diarización de oradores
              </span>
              <span className="flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-purple-400" /> Exporta a TXT, SRT, VTT, MD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTOR DE IDIOMA PREVIO A LA CARGA */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Idioma original del audio
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Mejora la precisión de Gemini
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Especificar el idioma exacto ayuda a Gemini a interpretar correctamente acentos, nombres propios y jerga técnica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300 self-end sm:self-auto bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <span className="text-base">{activeLangObj.flag}</span>
            <span className="font-semibold text-white">{activeLangObj.name}</span>
          </div>
        </div>

        {/* Quick Language Pills & Dropdown */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {SUPPORTED_LANGUAGES.filter((l) => l.popular).map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelectedLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedLanguage === lang.code
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {selectedLanguage === lang.code && <Check className="w-3 h-3 ml-0.5" />}
            </button>
          ))}

          {/* Full select dropdown for more languages */}
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700/60 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="" disabled className="bg-slate-800">
                -- Más idiomas --
              </option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-800">
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selector de Archivo / Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-8 transition-all duration-200 text-center ${
          dragActive
            ? 'border-blue-400 bg-blue-500/10'
            : selectedFile
            ? 'border-emerald-500/50 bg-emerald-950/10'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac,.wma,.mp4,.mkv,.webm,.mov"
          onChange={handleInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        {!selectedFile ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">
                Arrastra y suelta tu archivo de audio o video aquí
              </h3>
              <p className="text-sm text-slate-400">
                Soporta MP3, M4A, WAV, AAC, OGG, FLAC, MP4, WebM (cualquier tamaño, hasta 2 GB)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                Explorar archivos en tu equipo
              </button>

              <button
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing}
                className={`px-4 py-2.5 border text-sm font-medium rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                    : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-white" /> Detener ({recordingSeconds}s)
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-rose-400" /> Grabar con micrófono
                  </>
                )}
              </button>
            </div>

            {/* Quick Demo Test Option */}
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400 mb-2">
                ¿No tienes a mano un audio de 4 horas? Prueba de inmediato con nuestro ejemplo simulado:
              </p>
              <button
                type="button"
                onClick={() => onLoadDemo(selectedLanguage)}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-indigo-300" /> Cargar sesión de prueba de 4 Horas (Demostración instantánea)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileAudio className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                Archivo seleccionado listo para procesar
              </div>
              <h4 className="text-base font-bold text-white truncate max-w-md mx-auto">
                {selectedFile.name}
              </h4>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                <span>
                  Tamaño: <strong className="text-slate-200">{formatFileSize(selectedFile.size)}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  Idioma seleccionado: <strong className="text-blue-400 font-semibold">{activeLangObj.flag} {activeLangObj.name}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={startTranscription}
                disabled={isProcessing}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5" /> Iniciar Transcripción en {activeLangObj.name}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={isProcessing}
                className="px-4 py-3 border border-slate-700 hover:border-slate-600 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cambiar archivo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature cards explaining the 4-hour process */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h4 className="font-semibold text-white text-sm">Particionamiento Inteligente</h4>
          <p className="text-xs text-slate-400">
            FFmpeg segmenta audios de 4 horas en bloques optimizados de 10 min, evitando caídas de red y saturación de memoria.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h4 className="font-semibold text-white text-sm">IA Gemini con Idioma Guiado</h4>
          <p className="text-xs text-slate-400">
            Al indicarle el idioma original, Gemini 3.5 Transcribe reduce drásticamente las alucinaciones y mejora la concordancia gramatical.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h4 className="font-semibold text-white text-sm">Resumen y Exportación Universal</h4>
          <p className="text-xs text-slate-400">
            Exporta a subtítulos (SRT/VTT), documento (TXT/Markdown) y genera resumen ejecutivo con puntos clave y acuerdos.
          </p>
        </div>
      </div>
    </div>
  );
};
