export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  formattedTime: string;
  speaker: string;
  text: string;
}

export interface TopicItem {
  title: string;
  timestamp: string;
  description: string;
}

export interface SpeakerStats {
  name: string;
  talkTimeEstimate: string;
}

export interface AudioSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  topics: TopicItem[];
  speakers: SpeakerStats[];
}

export interface TranscriptionJob {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  durationSeconds: number;
  status: 'uploading' | 'probing' | 'chunking' | 'transcribing' | 'summarizing' | 'completed' | 'error';
  progress: number;
  totalChunks: number;
  processedChunks: number;
  currentStageMessage: string;
  errorMessage?: string;
  segments: TranscriptSegment[];
  summary?: AudioSummary;
  createdAt: number;
  audioUrl?: string;
  language?: string;
}
