import { TranscriptSegment, AudioSummary } from '../types';

function secondsToSRTTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const mmm = ms.toString().padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

function secondsToVTTTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const mmm = ms.toString().padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

export function generateSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, idx) => {
      const startTime = secondsToSRTTime(seg.startSeconds);
      const endTime = secondsToSRTTime(seg.endSeconds || seg.startSeconds + 4);
      return `${idx + 1}\n${startTime} --> ${endTime}\n${seg.speaker ? `${seg.speaker}: ` : ''}${seg.text}\n`;
    })
    .join('\n');
}

export function generateVTT(segments: TranscriptSegment[]): string {
  const content = segments
    .map((seg) => {
      const startTime = secondsToVTTTime(seg.startSeconds);
      const endTime = secondsToVTTTime(seg.endSeconds || seg.startSeconds + 4);
      return `${startTime} --> ${endTime}\n${seg.speaker ? `<v ${seg.speaker}>` : ''}${seg.text}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${content}`;
}

export function generatePlainText(
  segments: TranscriptSegment[],
  includeTimestamps: boolean = true,
  includeSpeakers: boolean = true
): string {
  return segments
    .map((seg) => {
      const timePart = includeTimestamps ? `[${seg.formattedTime}] ` : '';
      const speakerPart = includeSpeakers && seg.speaker ? `${seg.speaker}: ` : '';
      return `${timePart}${speakerPart}${seg.text}`;
    })
    .join('\n\n');
}

export function generateMarkdown(
  title: string,
  durationFormatted: string,
  segments: TranscriptSegment[],
  summary?: AudioSummary
): string {
  let md = `# Transcripción: ${title}\n\n`;
  md += `**Duración total:** ${durationFormatted}\n`;
  md += `**Fecha de transcripción:** ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}\n\n`;

  if (summary) {
    md += `## 📋 Resumen Ejecutivo\n\n${summary.overview}\n\n`;

    if (summary.keyPoints && summary.keyPoints.length > 0) {
      md += `## 💡 Puntos Clave\n\n`;
      summary.keyPoints.forEach((point) => {
        md += `- ${point}\n`;
      });
      md += `\n`;
    }

    if (summary.actionItems && summary.actionItems.length > 0) {
      md += `## ✅ Acuerdos y Tareas Pendientes\n\n`;
      summary.actionItems.forEach((action) => {
        md += `- [ ] ${action}\n`;
      });
      md += `\n`;
    }

    if (summary.topics && summary.topics.length > 0) {
      md += `## 🕒 Índice por Temas y Tiempos\n\n`;
      summary.topics.forEach((topic) => {
        md += `- **[${topic.timestamp}] ${topic.title}:** ${topic.description}\n`;
      });
      md += `\n`;
    }
  }

  md += `## 📝 Transcripción Completa\n\n`;
  segments.forEach((seg) => {
    md += `**[${seg.formattedTime}] ${seg.speaker}:** ${seg.text}\n\n`;
  });

  return md;
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
