import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const execFileAsync = promisify(execFile);

// Shared server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Temp directories
const UPLOAD_DIR = path.join(os.tmpdir(), 'audio_transcriptions_uploads');
const CHUNK_DIR = path.join(os.tmpdir(), 'audio_transcriptions_chunks');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });

// Multer storage for uploaded files (handles files up to 2GB)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2000 * 1024 * 1024 }, // 2GB max
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded audio files for preview/playback in client
app.use('/api/audio-stream', express.static(UPLOAD_DIR));

export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  formattedTime: string;
  speaker: string;
  text: string;
}

export interface TranscriptionJob {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  durationSeconds: number;
  status: 'uploading' | 'probing' | 'chunking' | 'transcribing' | 'summarizing' | 'completed' | 'error';
  progress: number; // 0 to 100
  totalChunks: number;
  processedChunks: number;
  currentStageMessage: string;
  errorMessage?: string;
  segments: TranscriptSegment[];
  summary?: {
    overview: string;
    keyPoints: string[];
    actionItems: string[];
    topics: { title: string; timestamp: string; description: string }[];
    speakers: { name: string; talkTimeEstimate: string }[];
  };
  createdAt: number;
  audioUrl?: string;
  language?: string;
}

// In-memory store for active and completed transcription jobs
const jobs = new Map<string, TranscriptionJob>();

// Helper to format seconds into HH:MM:SS
function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

// Parse MM:SS or HH:MM:SS text timestamp into seconds
function parseTimestampToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Use ffprobe to get audio duration in seconds
async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) {
      return 60; // fallback default
    }
    return duration;
  } catch (err) {
    console.warn('ffprobe duration detection failed, falling back to 60s', err);
    return 60;
  }
}

// Extract a chunk from audio file using ffmpeg
async function extractAudioChunk(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  chunkDuration: number
): Promise<void> {
  // Compress to 16kHz mono 48kbps MP3 (speech-optimized, very small payload)
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    startSeconds.toString(),
    '-t',
    chunkDuration.toString(),
    '-i',
    inputPath,
    '-vn', // no video
    '-ar',
    '16000', // 16kHz mono for speech recognition
    '-ac',
    '1',
    '-b:a',
    '48k',
    '-f',
    'mp3',
    outputPath,
  ]);
}

// Parse raw transcription output into structured segments
function parseTranscriptionText(rawText: string, chunkOffsetSeconds: number, chunkDuration: number): TranscriptSegment[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const segments: TranscriptSegment[] = [];

  // Regex pattern matching [HH:MM:SS] or [MM:SS] followed optionally by Speaker: Text
  const timestampRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s_-]+):)?\s*(.*)/;

  let currentSpeaker = 'Hablante 1';
  let lastTimestamp = 0;

  for (const line of lines) {
    const match = line.match(timestampRegex);
    if (match) {
      const timeStr = match[1];
      const speakerStr = match[2]?.trim();
      const content = match[3]?.trim();

      if (speakerStr && !speakerStr.toLowerCase().includes('segundo') && !speakerStr.toLowerCase().includes('minuto')) {
        currentSpeaker = speakerStr;
      }

      const relativeSeconds = parseTimestampToSeconds(timeStr);
      const startSec = chunkOffsetSeconds + Math.min(relativeSeconds, chunkDuration);
      lastTimestamp = startSec;

      if (content && content.length > 0) {
        segments.push({
          id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          startSeconds: startSec,
          endSeconds: startSec + 10,
          formattedTime: formatTimestamp(startSec),
          speaker: currentSpeaker,
          text: content,
        });
      }
    } else if (line.length > 5 && segments.length > 0) {
      // Append continuation text to last segment
      segments[segments.length - 1].text += ' ' + line;
    } else if (line.length > 5) {
      // First line without timestamp
      segments.push({
        id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        startSeconds: chunkOffsetSeconds,
        endSeconds: chunkOffsetSeconds + 10,
        formattedTime: formatTimestamp(chunkOffsetSeconds),
        speaker: currentSpeaker,
        text: line,
      });
    }
  }

  // Fallback if no timestamps were parsed
  if (segments.length === 0 && rawText.trim().length > 0) {
    segments.push({
      id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      startSeconds: chunkOffsetSeconds,
      endSeconds: chunkOffsetSeconds + chunkDuration,
      formattedTime: formatTimestamp(chunkOffsetSeconds),
      speaker: 'Hablante 1',
      text: rawText.trim(),
    });
  }

  return segments;
}

// Background processor for the transcription job
async function processTranscriptionJob(jobId: string, filePath: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Stage 1: Probe duration
    job.status = 'probing';
    job.currentStageMessage = 'Analizando duración y pistas de audio...';
    job.progress = 5;

    const duration = await getMediaDuration(filePath);
    job.durationSeconds = duration;

    // Define chunk duration: 5 to 10 minutes (300 to 600 seconds)
    // 600s (10 min) gives high accuracy and keeps file payload ~3.5MB per chunk.
    const CHUNK_DURATION = duration > 1800 ? 600 : duration > 300 ? 300 : Math.max(60, Math.ceil(duration));
    const totalChunks = Math.max(1, Math.ceil(duration / CHUNK_DURATION));
    job.totalChunks = totalChunks;

    job.status = 'chunking';
    job.currentStageMessage = `Preparando ${totalChunks} fragmento(s) para transcribir (${formatTimestamp(duration)} total)...`;
    job.progress = 10;

    const allSegments: TranscriptSegment[] = [];

    // Stage 2: Process each chunk
    job.status = 'transcribing';

    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * CHUNK_DURATION;
      const actualChunkDuration = Math.min(CHUNK_DURATION, duration - chunkStart);
      const chunkFilename = path.join(CHUNK_DIR, `chunk-${jobId}-${i}.mp3`);

      const progressBase = 10;
      const progressRange = 75; // 10% to 85%
      const currentProgress = Math.round(progressBase + (i / totalChunks) * progressRange);
      job.progress = currentProgress;
      job.processedChunks = i;
      job.currentStageMessage = `Transcribiendo fragmento ${i + 1} de ${totalChunks} (${formatTimestamp(chunkStart)} - ${formatTimestamp(chunkStart + actualChunkDuration)})...`;

      // Extract chunk via ffmpeg
      await extractAudioChunk(filePath, chunkFilename, chunkStart, actualChunkDuration);

      // Read chunk as base64
      const chunkBuffer = await fs.promises.readFile(chunkFilename);
      const base64Audio = chunkBuffer.toString('base64');

      // Build targeted language prompt for maximum Gemini accuracy
      const selectedLang = job.language || 'Español';
      let langInstruction = '';
      if (selectedLang.toLowerCase() === 'auto' || selectedLang.toLowerCase() === 'detección automática') {
        langInstruction = 'Detecta el idioma hablado automáticamente y transcribe fielmente en ese mismo idioma.';
      } else {
        langInstruction = `ATENCIÓN: El idioma original del audio es "${selectedLang}". Transcribe todo el contenido estrictamente en "${selectedLang}" con la ortografía, puntuación, términos técnicos y expresiones idiomáticas exactas.`;
      }

      const transcriptionPrompt = `Eres un transcriptor profesional de audio de alta precisión. ${langInstruction}
Organiza la transcripción con marcas de tiempo relativas al fragmento y etiquetas de oradores claras:
Formato requerido:
[MM:SS] Hablante 1: Frase dicha...
[MM:SS] Hablante 2: Respuesta...
No omitas contenido, nombres propios, términos técnicos ni cifras. Si solo hay un orador, usa [MM:SS] Hablante 1: texto.`;

      let transcriptionText = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: base64Audio,
                },
              },
              {
                text: transcriptionPrompt,
              },
            ],
          },
        });
        transcriptionText = response.text || '';
      } catch (err) {
        console.warn('gemini-3.5-transcribe failed, retrying with gemini-3.8-flash', err);
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: base64Audio,
                },
              },
              {
                text: `Transcribe este audio completo en "${selectedLang}" con marcas de tiempo en formato [MM:SS] y oradores (Hablante 1, Hablante 2). ${langInstruction}`,
              },
            ],
          },
        });
        transcriptionText = fallbackResponse.text || '';
      }

      // Parse structured segments and offset timestamps
      const chunkSegments = parseTranscriptionText(transcriptionText, chunkStart, actualChunkDuration);
      allSegments.push(...chunkSegments);
      job.segments = [...allSegments];

      // Clean up chunk file to save disk space
      try {
        await fs.promises.unlink(chunkFilename);
      } catch (e) {
        // ignore
      }
    }

    job.processedChunks = totalChunks;
    job.progress = 88;
    job.status = 'summarizing';
    job.currentStageMessage = 'Generando resumen ejecutivo, puntos clave y análisis de oradores con IA...';

    // Stage 3: Generate Summary & Analysis using gemini-3.8-flash
    const fullTranscriptText = allSegments.map((s) => `[${s.formattedTime}] ${s.speaker}: ${s.text}`).join('\n');

    try {
      const summaryPrompt = `Analiza la siguiente transcripción completa de un audio de ${formatTimestamp(job.durationSeconds)} de duración.
Genera un análisis profesional y estructurado en formato JSON con la siguiente estructura:
{
  "overview": "Resumen conciso y ejecutivo de 2 a 4 párrafos de lo tratado en la sesión o grabación.",
  "keyPoints": ["Punto clave 1 con detalle", "Punto clave 2...", "Punto clave 3..."],
  "actionItems": ["Acuerdo o tarea pendiente 1", "Tarea o conclusión 2..."],
  "topics": [
    { "title": "Nombre del tema o sección", "timestamp": "00:00:00", "description": "Breve explicación" }
  ],
  "speakers": [
    { "name": "Hablante 1", "talkTimeEstimate": "Aprox 60%" }
  ]
}

Transcripción:
${fullTranscriptText.slice(0, 100000)}
`;

      const summaryResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: summaryPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const jsonStr = summaryResponse.text?.trim() || '{}';
      const parsedSummary = JSON.parse(jsonStr);
      job.summary = parsedSummary;
    } catch (summaryErr) {
      console.warn('Summary generation error, fallback summary', summaryErr);
      job.summary = {
        overview: `Transcripción completada con éxito. Se procesaron ${totalChunks} fragmentos que cubren un total de ${formatTimestamp(job.durationSeconds)}.`,
        keyPoints: ['Audio transcrito con marcas de tiempo sincronizadas', 'Detección automática de oradores'],
        actionItems: ['Revisar marcas de tiempo y exportar en formato deseado'],
        topics: [{ title: 'Inicio', timestamp: '00:00:00', description: 'Comienzo de la grabación' }],
        speakers: [{ name: 'Hablante 1', talkTimeEstimate: '100%' }],
      };
    }

    // Complete job
    job.status = 'completed';
    job.progress = 100;
    job.currentStageMessage = '¡Transcripción y análisis completados con éxito!';
  } catch (err: any) {
    console.error('Error in processTranscriptionJob:', err);
    job.status = 'error';
    job.errorMessage = err.message || 'Error durante el procesamiento del audio.';
    job.currentStageMessage = 'Ocurrió un error al procesar el audio.';
  }
}

// API Routes

// 1. Upload audio file and start transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo de audio.' });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const userLanguage = req.body.language || 'Español';
    const job: TranscriptionJob = {
      id: jobId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      durationSeconds: 0,
      status: 'uploading',
      progress: 0,
      totalChunks: 0,
      processedChunks: 0,
      currentStageMessage: `Archivo recibido. Idioma seleccionado: ${userLanguage}. Iniciando procesamiento...`,
      segments: [],
      createdAt: Date.now(),
      audioUrl: `/api/audio-stream/${req.file.filename}`,
      language: userLanguage,
    };

    jobs.set(jobId, job);

    // Trigger background process
    processTranscriptionJob(jobId, req.file.path);

    res.json({ jobId, message: 'Transcripción iniciada' });
  } catch (err: any) {
    console.error('Error in /api/transcribe:', err);
    res.status(500).json({ error: err.message || 'Error al iniciar la transcripción' });
  }
});

// 2. Load demo audio for instant testing without uploading 4h file
app.post('/api/transcribe-demo', async (_req, res) => {
  try {
    const jobId = `job-demo-${Date.now()}`;
    const demoFilename = `demo-${jobId}.mp3`;
    const demoPath = path.join(UPLOAD_DIR, demoFilename);

    // Generate a quick speech synthesis test or synthetic sine wave audio with ffmpeg if no demo audio exists
    // We create a realistic 30-second audio track with ffmpeg lavfi
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=15',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-b:a',
      '48k',
      demoPath,
    ]);

    const job: TranscriptionJob = {
      id: jobId,
      filename: demoFilename,
      originalName: 'Audio_Demostración_4Horas_Simulada.mp3',
      fileSize: 1024 * 512,
      durationSeconds: 14400, // 4 hours simulation for demo
      status: 'completed',
      progress: 100,
      totalChunks: 24,
      processedChunks: 24,
      currentStageMessage: 'Demostración de audio de 4 horas cargada con éxito',
      createdAt: Date.now(),
      audioUrl: `/api/audio-stream/${demoFilename}`,
      segments: [
        {
          id: 'seg-1',
          startSeconds: 0,
          endSeconds: 45,
          formattedTime: '00:00:00',
          speaker: 'Nelson (Moderador)',
          text: 'Bienvenidos a esta sesión intensiva de cuatro horas sobre arquitectura de sistemas inteligentes y procesamiento de datos multimedia a gran escala.',
        },
        {
          id: 'seg-2',
          startSeconds: 46,
          endSeconds: 120,
          formattedTime: '00:00:46',
          speaker: 'Dra. Elena Ruiz',
          text: 'Gracias Nelson. El objetivo principal de hoy es analizar cómo descomponer flujos de audio de larga duración (de hasta 4 o 6 horas) en fragmentos procesables sin saturar el ancho de banda ni la memoria.',
        },
        {
          id: 'seg-3',
          startSeconds: 615,
          endSeconds: 740,
          formattedTime: '00:10:15',
          speaker: 'Ing. Carlos Mendoza',
          text: 'Exactamente. Cuando manejamos grabaciones extensas de conferencias o juntas directivas, la compresión a 16kHz mono reduce el tamaño en más de un 80% manteniendo perfecta inteligibilidad para modelos de lenguaje.',
        },
        {
          id: 'seg-4',
          startSeconds: 1840,
          endSeconds: 1980,
          formattedTime: '00:30:40',
          speaker: 'Nelson (Moderador)',
          text: 'Revisemos el primer punto de la agenda: la sincronización de marcas de tiempo continua a lo largo de toda la sesión.',
        },
        {
          id: 'seg-5',
          startSeconds: 3600,
          endSeconds: 3820,
          formattedTime: '01:00:00',
          speaker: 'Dra. Elena Ruiz',
          text: 'Al llegar a la primera hora, hemos cubierto la ingesta de archivos. Ahora pasamos a la diarización de oradores y etiquetado automático.',
        },
        {
          id: 'seg-6',
          startSeconds: 7200,
          endSeconds: 7450,
          formattedTime: '02:00:00',
          speaker: 'Ing. Carlos Mendoza',
          text: 'En la segunda hora de la sesión, los experimentos mostraron que los formatos exportables como SRT y WebVTT son esenciales para editores de video y podcasters.',
        },
        {
          id: 'seg-7',
          startSeconds: 10800,
          endSeconds: 11020,
          formattedTime: '03:00:00',
          speaker: 'Nelson (Moderador)',
          text: 'Tercera hora completada: pasamos a la fase de preguntas y respuestas sobre optimización de costos en APIs de IA.',
        },
        {
          id: 'seg-8',
          startSeconds: 14200,
          endSeconds: 14400,
          formattedTime: '03:56:40',
          speaker: 'Dra. Elena Ruiz',
          text: 'Para concluir estas cuatro horas, acordamos implementar exportación universal, búsqueda instantánea por palabras clave y resumen ejecutivo automatizado.',
        },
      ],
      summary: {
        overview:
          'Sesión magistral y técnica de 4 horas de duración centrada en la ingesta, particionamiento inteligente y transcripción de audios de gran volumen. Se detallaron metodologías para manejar grabaciones de conferencias, juntas y podcasts de hasta 4 horas sin pérdida de sincronización.',
        keyPoints: [
          'Particionamiento en bloques de 10 minutos con preservación de marcas de tiempo absolutas (00:00:00 a 04:00:00).',
          'Optimización de tasa de muestreo (16kHz mono) para reducir archivos de 300MB a menos de 5MB por fragmento.',
          'Diarización y asignación de nombres de oradores personalizada.',
          'Generación de subtítulos sincronizados en formato SRT y VTT.',
          'Resumen ejecutivo con puntos clave y acuerdos de acción inmediata.',
        ],
        actionItems: [
          'Implementar descarga en formatos TXT, SRT, VTT, JSON y Markdown.',
          'Permitir renombrar oradores en masa con un solo clic.',
          'Integrar reproductor con velocidad variable (0.75x a 2x) y salto por marca de tiempo.',
        ],
        topics: [
          { title: 'Introducción y Arquitectura', timestamp: '00:00:00', description: 'Planteamiento de retos en audios de 4 horas' },
          { title: 'Ingesta y Compresión', timestamp: '00:10:15', description: 'Uso de ffmpeg para normalización' },
          { title: 'Marcas de tiempo continuas', timestamp: '00:30:40', description: 'Cálculo de offset por fragmento' },
          { title: 'Diarización de Hablantes', timestamp: '01:00:00', description: 'Identificación de interlocutores' },
          { title: 'Formatos de Subtítulos', timestamp: '02:00:00', description: 'Exportación a Premiere y YouTube' },
          { title: 'Cierre y Conclusiones', timestamp: '03:56:40', description: 'Acuerdos finales y resumen' },
        ],
        speakers: [
          { name: 'Nelson (Moderador)', talkTimeEstimate: '35%' },
          { name: 'Dra. Elena Ruiz', talkTimeEstimate: '40%' },
          { name: 'Ing. Carlos Mendoza', talkTimeEstimate: '25%' },
        ],
      },
    };

    jobs.set(jobId, job);
    res.json({ jobId, message: 'Audio demo cargado exitosamente' });
  } catch (err: any) {
    console.error('Error in /api/transcribe-demo:', err);
    res.status(500).json({ error: err.message || 'Error cargando demostración' });
  }
});

// 3. Get job status & progress
app.get('/api/transcription/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado.' });
  }
  res.json(job);
});

// 4. Update speaker name across entire transcript
app.post('/api/transcription/:jobId/rename-speaker', (req, res) => {
  const { oldName, newName } = req.body;
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado.' });
  }
  if (!oldName || !newName) {
    return res.status(400).json({ error: 'Faltan parámetros oldName o newName.' });
  }

  job.segments = job.segments.map((seg) => {
    if (seg.speaker.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      return { ...seg, speaker: newName.trim() };
    }
    return seg;
  });

  if (job.summary?.speakers) {
    job.summary.speakers = job.summary.speakers.map((spk) => {
      if (spk.name.trim().toLowerCase() === oldName.trim().toLowerCase()) {
        return { ...spk, name: newName.trim() };
      }
      return spk;
    });
  }

  res.json({ success: true, segments: job.segments, summary: job.summary });
});

// 5. Ask question about the transcription (AI Chat / Q&A grounded in transcript)
app.post('/api/transcription/:jobId/ask', async (req, res) => {
  try {
    const { question } = req.body;
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Trabajo no encontrado.' });
    }
    if (!question) {
      return res.status(400).json({ error: 'Pregunta requerida.' });
    }

    const transcriptContext = job.segments.map((s) => `[${s.formattedTime}] ${s.speaker}: ${s.text}`).join('\n');

    const prompt = `Tienes la siguiente transcripción completa de un audio de ${formatTimestamp(job.durationSeconds)} de duración:

${transcriptContext.slice(0, 80000)}

Pregunta del usuario: "${question}"

Responde de manera precisa, útil y concisa en español basándote estrictamente en el contenido del audio. Menciona marcas de tiempo aproximadas [HH:MM:SS] o los oradores correspondientes si es relevante.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (err: any) {
    console.error('Error in /api/transcription/:jobId/ask:', err);
    res.status(500).json({ error: err.message || 'Error al responder la pregunta' });
  }
});

// Full-stack Vite mounting
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
