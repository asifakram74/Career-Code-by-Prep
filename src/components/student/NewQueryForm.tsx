import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CategoryItem, UserProfile, QueryTicket } from '../../types';
import { api, errorMessage, MAX_UPLOAD_BYTES } from '../../lib/api';
import { sortCategoriesGeneralFirst } from '../../constants/officialCategories';
import { CustomSelect } from '../common/CustomSelect';
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Check,
  Star,
  Mic,
  Square,
  Play,
  Pause,
  Volume2,
  Loader2,
  UploadCloud,
  Image as ImageIcon,
} from 'lucide-react';
import {
  compressImage,
  readFileDataUrl,
  formatFileSize,
  ProcessedAttachment,
  uploadDataUrls,
  uploadDataUrl,
} from '../../lib/fileUploadHelper';

const MAX_UPLOAD_LABEL = `${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;
const MAX_FILES_PER_QUERY = 10;

/** Counselor as returned by GET /queries-meta/experts. */
type ExpertOption = Pick<
  UserProfile,
  'uid' | 'displayName' | 'role' | 'professionalTitle' | 'shortDescription' | 'photoURL' | 'isOnline' | 'averageRating' | 'ratingCount'
>;

/** Approximate decoded byte size of a base64 data URL. */
const dataUrlByteSize = (dataUrl: string) => {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.round((b64.length * 3) / 4);
};

const audioExtension = (mime: string) => {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('aac')) return 'aac';
  return 'webm';
};

// Audio Player for recorded voice note preview
const VoiceNotePlayer: React.FC<{
  audioUrl: string;
  duration?: number;
  onDelete: () => void;
}> = ({ audioUrl, duration, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioDuration, setAudioDuration] = useState<number>(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.src = audioUrl;
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    audio.ontimeupdate = () => {
      const dur =
        audio.duration && isFinite(audio.duration)
          ? audio.duration
          : audioDuration || duration || 1;
      setProgress((audio.currentTime / dur) * 100);
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleCycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalTime = audioDuration || duration || 0;

  return (
    <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95 transition-transform"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold mb-1">
            <span className="flex items-center gap-1 text-emerald-800">
              <Mic className="w-3.5 h-3.5 text-emerald-600" />
              <span>Voice Note Recorded</span>
            </span>
            <span className="tabular-nums font-mono text-[10px]">
              {formatSeconds(isPlaying ? currentTime : totalTime)}
            </span>
          </div>

          <div className="w-full bg-emerald-200/90 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCycleSpeed}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
          title="Toggle speed"
        >
          {playbackSpeed}x
        </button>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
        title="Delete voice note and re-record"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

interface NewQueryFormProps {
  onSuccessTicket: (ticket: QueryTicket) => void;
  onCancel: () => void;
}

export const NewQueryForm: React.FC<NewQueryFormProps> = ({
  onSuccessTicket,
  onCancel,
}) => {
  const { userProfile, updateActivityTimestamp } = useAuth();

  // Dynamic Categories and Experts
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [eligibleExperts, setEligibleExperts] = useState<ExpertOption[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<ExpertOption | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [attachments, setAttachments] = useState<ProcessedAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Voice Note State & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVoiceUrl, setRecordedVoiceUrl] = useState<string | null>(null);
  const [recordedVoiceDuration, setRecordedVoiceDuration] = useState<number>(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  // True between "Done Recording" and the recording being ready to attach
  const [encodingVoice, setEncodingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  const cleanupAudioStream = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    return () => {
      cleanupAudioStream();
    };
  }, []);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const startRecording = async () => {
    setRecordingError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setRecordingError('Audio recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const detectedMime = getSupportedMimeType();
      mimeTypeRef.current = detectedMime || 'audio/webm';
      const options = detectedMime ? { mimeType: detectedMime } : undefined;
      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone error:', err);
      setRecordingError('Microphone permission denied or no audio device detected.');
      cleanupAudioStream();
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      cleanupAudioStream();
      return;
    }
    const duration = recordingSeconds || 1;

    mediaRecorderRef.current.onstop = () => {
      try {
        if (audioChunksRef.current.length === 0) {
          setRecordingError('No audio captured. Please speak into your mic and try again.');
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        });
        const reader = new FileReader();
        setEncodingVoice(true);
        reader.onload = () => {
          const base64Audio = reader.result as string;
          setRecordedVoiceUrl(base64Audio);
          setRecordedVoiceDuration(duration);
          setEncodingVoice(false);
        };
        reader.onerror = reader.onabort = () => {
          console.error('Error reading voice recording:', reader.error);
          setRecordingError('Failed to encode voice note. Please record again.');
          setEncodingVoice(false);
        };
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        console.error('Error encoding voice recording:', err);
        setRecordingError('Failed to encode voice note.');
        setEncodingVoice(false);
      } finally {
        cleanupAudioStream();
      }
    };

    try {
      if (mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.requestData(); } catch {}
        mediaRecorderRef.current.stop();
      } else {
        cleanupAudioStream();
      }
    } catch {
      cleanupAudioStream();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    cleanupAudioStream();
  };

  const deleteVoiceNote = () => {
    setRecordedVoiceUrl(null);
    setRecordedVoiceDuration(0);
  };

  // State & Loading
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const items = await api.get<CategoryItem[]>('/categories?status=active');
        const list: CategoryItem[] = [];
        const seenCatIds = new Set<string>();
        items.forEach((c) => {
          if (c.status === 'active' && !seenCatIds.has(c.id)) {
            seenCatIds.add(c.id);
            list.push(c);
          }
        });
        setCategories(sortCategoriesGeneralFirst(list));
      } catch (err) {
        console.error('Failed to load categories:', err);
        setError(errorMessage(err, 'Could not load categories. Please refresh and try again.'));
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Whenever selected category changes, fetch strictly assigned active administrators
  useEffect(() => {
    if (!selectedCategoryId) {
      setEligibleExperts([]);
      setSelectedExpert(null);
      return;
    }

    let cancelled = false;
    const fetchExperts = async () => {
      try {
        const targetCategory = categories.find((c) => c.id === selectedCategoryId);
        if (!targetCategory) {
          setEligibleExperts([]);
          setSelectedExpert(null);
          return;
        }

        // Server returns only active counselors assigned to this category
        const rawExperts = await api.get<ExpertOption[]>(
          `/queries-meta/experts?categoryId=${encodeURIComponent(selectedCategoryId)}`
        );
        if (cancelled) return;

        const seenUids = new Set<string>();
        const uniqueExperts: ExpertOption[] = [];
        for (const exp of rawExperts) {
          const uidKey = (exp.uid || '').trim();
          if (!uidKey || seenUids.has(uidKey)) continue;
          seenUids.add(uidKey);
          uniqueExperts.push({ ...exp, displayName: exp.displayName || 'Counselor' });
        }

        // Put primary designated expert first, then alphabetical
        uniqueExperts.sort((a, b) => {
          if (a.uid === targetCategory.primaryAdminId) return -1;
          if (b.uid === targetCategory.primaryAdminId) return 1;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });

        setEligibleExperts(uniqueExperts);
        if (uniqueExperts.length > 0) {
          setSelectedExpert((prev) => {
            // Keep previously selected if still among the eligible experts
            if (prev) {
              const stillValid = uniqueExperts.find((e) => e.uid === prev.uid);
              if (stillValid) return stillValid;
            }
            // Otherwise default to the first (primary) expert
            return uniqueExperts[0];
          });
        } else {
          setSelectedExpert(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load counselors:', err);
        setEligibleExperts([]);
        setSelectedExpert(null);
        setError(errorMessage(err, 'Could not load counselors for this category.'));
      }
    };

    fetchExperts();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, categories]);

  const updateAttachmentProgress = (id: string, progress: number) => {
    setAttachments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, progress } : item))
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    setError(null);

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError(`File "${file.name}" has an unsupported format. Please upload JPG, PNG, WebP, or PDF.`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `${isImage ? 'Image' : 'PDF'} "${file.name}" (${formatFileSize(file.size)}) exceeds the ${MAX_UPLOAD_LABEL} per-file limit.${
            isImage ? '' : ' Please compress your PDF or upload photo screenshots.'
          }`
        );
        continue;
      }

      const tempId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const newAttachment: ProcessedAttachment = {
        id: tempId,
        file,
        name: file.name,
        originalSize: file.size,
        finalSize: file.size,
        type: file.type,
        dataUrl: '',
        previewUrl: '',
        progress: 15,
        status: 'processing',
      };

      setAttachments((prev) => [...prev, newAttachment]);

      try {
        if (isImage) {
          const result = await compressImage(
            file,
            1280,
            1280,
            0.78,
            (pct) => updateAttachmentProgress(tempId, pct)
          );
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === tempId
                ? {
                    ...att,
                    dataUrl: result.dataUrl,
                    previewUrl: result.dataUrl,
                    finalSize: result.size,
                    progress: 100,
                    status: 'ready',
                  }
                : att
            )
          );
        } else {
          // PDF document
          const result = await readFileDataUrl(file, (pct) =>
            updateAttachmentProgress(tempId, pct)
          );
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === tempId
                ? {
                    ...att,
                    dataUrl: result.dataUrl,
                    finalSize: result.size,
                    progress: 100,
                    status: 'ready',
                  }
                : att
            )
          );
        }
      } catch (err: any) {
        console.error('Error processing attachment file:', err);
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === tempId
              ? {
                  ...att,
                  progress: 0,
                  status: 'error',
                  error: 'Failed to process file',
                }
              : att
          )
        );
        setError(`Could not process "${file.name}". Please try a different file.`);
      }
    }

    // Reset input so re-selecting same file triggers change
    e.target.value = '';
  };

  const removeAttachment = (idOrIndex: string | number) => {
    setAttachments((prev) =>
      typeof idOrIndex === 'number'
        ? prev.filter((_, i) => i !== idOrIndex)
        : prev.filter((att) => att.id !== idOrIndex)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userProfile) {
      setError('You must be signed in as a student to submit a query.');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select an academic or career category.');
      return;
    }
    if (isRecording) {
      setError('Please finish your voice recording (tap "Done Recording") or cancel it before submitting.');
      return;
    }
    if (encodingVoice) {
      setError('Please wait a moment while your voice note is being prepared.');
      return;
    }

    const finalDetail =
      detail.trim() ||
      (recordedVoiceUrl
        ? '(Voice note consultation query - please listen to attached audio recording)'
        : '');

    if (!title.trim()) {
      setError('Query Title is required.');
      return;
    }
    if (!finalDetail && !recordedVoiceUrl) {
      setError('Please provide a detailed question explanation or record a voice note.');
      return;
    }

    // Check if attachments are still optimizing
    const isStillProcessing = attachments.some((a) => a.status === 'processing');
    if (isStillProcessing) {
      setError('Please wait a moment for attachments to finish uploading and optimizing.');
      return;
    }

    const hasAttachmentErrors = attachments.some((a) => a.status === 'error');
    if (hasAttachmentErrors) {
      setError('One or more attachments could not be processed. Please remove them before submitting.');
      return;
    }

    if (attachments.length > MAX_FILES_PER_QUERY) {
      setError(`You can attach up to ${MAX_FILES_PER_QUERY} files per query. Please remove some attachments.`);
      return;
    }

    const oversized = attachments.find((a) => (a.finalSize || a.originalSize) > MAX_UPLOAD_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" exceeds the ${MAX_UPLOAD_LABEL} per-file limit. Please remove it or upload a smaller file.`);
      return;
    }

    if (recordedVoiceUrl && dataUrlByteSize(recordedVoiceUrl) > MAX_UPLOAD_BYTES) {
      setError(`Your voice note exceeds the ${MAX_UPLOAD_LABEL} limit. Please record a shorter voice note.`);
      return;
    }

    setSubmitting(true);
    setUploadProgress(20);

    try {
      // 1. Upload attachments and the voice note; the API only accepts uploaded file URLs
      const uploadedAttachments = await uploadDataUrls(
        attachments.map((att) => ({ dataUrl: att.dataUrl, name: att.name }))
      );
      setUploadProgress(50);

      let audioUrl: string | undefined;
      if (recordedVoiceUrl) {
        const mime = recordedVoiceUrl.slice(5, recordedVoiceUrl.indexOf(';')) || mimeTypeRef.current;
        audioUrl = await uploadDataUrl(recordedVoiceUrl, `voice-note-${Date.now()}.${audioExtension(mime)}`);
      }
      setUploadProgress(75);

      // 2. Create the query. The server assigns the ticket number, merges into an existing
      //    chat with the same counselor, writes the header message and sends notifications.
      const { ticket } = await api.post<{ ticket: QueryTicket; merged: boolean }>('/queries', {
        categoryId: selectedCategoryId,
        ...(selectedExpert ? { expertId: selectedExpert.uid } : {}),
        title: title.trim(),
        detail: finalDetail,
        attachments: uploadedAttachments,
        ...(audioUrl ? { audioUrl, audioDuration: Math.round(recordedVoiceDuration || 0) } : {}),
      });

      await updateActivityTimestamp().catch(() => {});
      setUploadProgress(100);

      onSuccessTicket(ticket);
    } catch (err: any) {
      console.error('Error submitting query:', err);
      setError(errorMessage(err, 'An error occurred while submitting your ticket. Please retry.'));
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8">
      {/* Title */}
      <div className="pb-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Submit a New Career Guidance Query
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connect directly with verified counselors and academic experts for personalized guidance.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* 1. Pre-Filled Student Credentials (Read-Only) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            1. Student Information <span className="text-slate-400 font-normal">(Verified Profile)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Student Name</span>
              <span className="font-semibold text-slate-900">{userProfile?.displayName}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Email Address</span>
              <span className="font-semibold text-slate-900 truncate block">{userProfile?.email}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Phone Number</span>
              <span className="font-semibold text-slate-900">{userProfile?.phoneNumber || 'Not provided'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Qualification</span>
              <span className="font-semibold text-slate-900">
                {userProfile?.qualification}
                {userProfile?.qualificationDetail ? ` (${userProfile.qualificationDetail})` : ''}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Board</span>
              <span className="font-semibold text-slate-900">{userProfile?.board || 'Not Applicable'}</span>
            </div>
          </div>
        </div>

        {/* 2. Category Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            2. Select Category / Field <span className="text-rose-500">*</span>
          </label>
          {loadingCategories ? (
            <div className="text-xs text-slate-400 py-2">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              No categories have been created yet. An administrator needs to add categories in Category Management before queries can be submitted.
            </div>
          ) : (
            <CustomSelect
              value={selectedCategoryId}
              onChange={(val) => setSelectedCategoryId(val)}
              placeholder="-- Choose Category / Academic Field --"
              options={categories.map((cat) => ({
                value: cat.id,
                label: cat.name,
                sublabel: cat.description ? (cat.description.length > 50 ? `${cat.description.slice(0, 50)}...` : cat.description) : undefined,
              }))}
              searchable
            />
          )}
        </div>

        {/* 3. Expert Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-700">
              3. Choose Your Expert Advisor <span className="text-rose-500">*</span>
            </label>
            {selectedCategoryId && (
              <span className="text-[11px] font-medium text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100">
                {eligibleExperts.length === 1
                  ? '1 mentor assigned (Automatically selected)'
                  : `${eligibleExperts.length} mentors assigned (Click to select preferred)`}
              </span>
            )}
          </div>

          {!selectedCategoryId ? (
            <div className="p-5 rounded-2xl border border-dashed border-pink-200 bg-pink-50/30 text-center text-xs text-slate-600 flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mb-2 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="font-semibold text-slate-800">Please select a category above first</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                To guarantee specialized guidance, only counselors and experts assigned to your selected category will be shown.
              </p>
            </div>
          ) : eligibleExperts.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 text-center text-xs text-amber-900">
              <p className="font-semibold">No expert is specifically assigned to this category at the moment.</p>
              <p className="text-[11px] text-amber-700 mt-1">
                Your query will be submitted to the General Executive Queue and reviewed by platform administration.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fade-in">
                {eligibleExperts.map((exp) => {
                  const currentCat = categories.find((c) => c.id === selectedCategoryId);
                  const isPrimary = currentCat?.primaryAdminId === exp.uid;
                  const isSelected = selectedExpert?.uid === exp.uid;
                  return (
                    <div
                      key={exp.uid}
                      onClick={() => setSelectedExpert(exp)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                        isSelected
                          ? 'border-pink-600 bg-pink-50/50 ring-1.5 ring-pink-500 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-pink-200 hover:shadow-xs'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs shadow-pink-200">
                        {exp.displayName.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-start justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 whitespace-normal break-words leading-tight">
                              {exp.displayName}
                            </h4>
                            {isPrimary && (
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded shrink-0">
                                Primary
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-pink-700 font-bold bg-pink-100 px-2 py-0.5 rounded-full shrink-0">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-pink-700 font-semibold whitespace-normal break-words">
                          {exp.professionalTitle || 'Academic & Career Specialist'}
                        </p>

                        <p className="text-[11px] text-slate-600 line-clamp-3 mt-1 leading-relaxed">
                          {exp.shortDescription || 'Dedicated counselor helping students achieve admission and professional success.'}
                        </p>

                        {/* Public Star Rating & Explicit Availability Status */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {Number(exp.ratingCount) > 0 ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{exp.averageRating ? exp.averageRating.toFixed(1) : '5.0'}</span>
                              <span className="text-[9px] text-amber-700/80 font-medium">
                                ({exp.ratingCount} {exp.ratingCount === 1 ? 'review' : 'reviews'})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center text-[10px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              <span>Not yet rated</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Available</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedExpert && (
                <div className="p-3 bg-pink-50/80 border border-pink-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-slate-700 font-medium">Selected Counselor: </span>
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 whitespace-normal break-words">
                        {selectedExpert.displayName}
                      </strong>
                      <span className="text-[11px] text-pink-700 font-medium ml-1">
                        · {selectedExpert.professionalTitle || 'Career Specialist'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Query Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              4. Query Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Can I switch from FSc Pre-Medical to BS Computer Science? What are the admission criteria?"
              className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Detailed Query {recordedVoiceUrl ? <span className="text-slate-400 font-normal">(Optional when voice note is attached)</span> : <span className="text-rose-500">*</span>}
              </label>
              <span className="text-[11px] text-pink-600 font-medium">Text and/or Voice Note</span>
            </div>
            <textarea
              required={!recordedVoiceUrl}
              rows={5}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={recordedVoiceUrl ? "Optional: Add any additional notes or details (or submit with voice note alone)..." : "Explain your question in detail so that the expert can guide you accurately. You can also record a Voice Note below instead of or in addition to typing."}
              className="block w-full p-3.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>{recordedVoiceUrl ? '✓ Voice note attached' : 'Type above or record a voice note below'}</span>
              <span className="tabular-nums">{detail.length} characters</span>
            </div>
          </div>

          {/* Voice Note Recording Section */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-pink-600" />
                Voice Note Query
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Optional alternative to typing</span>
            </label>

            {recordingError && (
              <div className="mb-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{recordingError}</span>
              </div>
            )}

            {recordedVoiceUrl ? (
              <VoiceNotePlayer
                audioUrl={recordedVoiceUrl}
                duration={recordedVoiceDuration}
                onDelete={deleteVoiceNote}
              />
            ) : isRecording ? (
              <div className="p-3.5 rounded-xl bg-pink-50 border-2 border-pink-400 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse-subtle">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                      Recording Voice Query...
                    </span>
                    <span className="text-[11px] text-slate-500">Speak clearly into your microphone</span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-pink-200">
                    {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
                    {(recordingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Done Recording
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-gradient-to-r from-pink-50/70 to-slate-50 border border-pink-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">
                      Want to speak instead of typing?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Record a voice note explaining your question, marks, and goals.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-pink-600 text-pink-700 hover:text-white border border-pink-300 hover:border-pink-600 rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 shrink-0 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record Voice Note</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 5. Attachments */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              5. Media & Document Attachments <span className="text-slate-400 font-normal">(Optional: Result cards, transcripts, notices)</span>
            </label>
            {attachments.length > 0 && (
              <span className="text-[11px] font-semibold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100">
                {attachments.length} {attachments.length === 1 ? 'file' : 'files'} attached (
                {formatFileSize(attachments.reduce((sum, a) => sum + (a.finalSize || a.originalSize), 0))})
              </span>
            )}
          </div>

          <div className="border-2 border-dashed border-pink-200 rounded-xl p-5 text-center hover:border-pink-400 hover:bg-pink-50/20 transition-all group">
            <input
              type="file"
              multiple
              id="file-upload"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 text-xs font-semibold text-pink-600 group-hover:text-pink-700"
            >
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 group-hover:scale-105 transition-transform shadow-2xs">
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-800">
                Click to Upload Files or Images
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Supports camera photos (JPG, PNG, WebP) and PDF documents. Photos are automatically optimized for instant submission.
              </span>
            </label>
          </div>

          {/* Uploaded Files with Live Progress & Status */}
          {attachments.length > 0 && (
            <div className="mt-3.5 space-y-2.5">
              {attachments.map((item) => {
                const isImage = item.type.startsWith('image/');
                const isReady = item.status === 'ready';
                const isProcessing = item.status === 'processing';
                const isError = item.status === 'error';

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Thumbnail or File Icon */}
                        {isImage && item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-slate-800 break-words leading-tight">
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                            {isProcessing && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing & Compressing ({item.progress}%)...
                              </span>
                            )}
                            {isReady && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                100% Uploaded & Ready
                              </span>
                            )}
                            {isError && (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                {item.error || 'Failed to process'}
                              </span>
                            )}

                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 tabular-nums">
                              {item.originalSize !== item.finalSize
                                ? `${formatFileSize(item.originalSize)} → ${formatFileSize(item.finalSize)} (Optimized)`
                                : formatFileSize(item.finalSize)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isError
                            ? 'bg-rose-500'
                            : isReady
                            ? 'bg-emerald-500'
                            : 'bg-pink-600'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Submission Progress Bar when uploading */}
        {submitting && (
          <div className="p-3.5 bg-pink-50 border border-pink-200 rounded-xl space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-pink-900">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
                Uploading Media & Sending Query to Expert...
              </span>
              <span className="tabular-nums font-mono">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-pink-200/90 rounded-full h-2 overflow-hidden">
              <div
                className="bg-pink-600 h-full rounded-full transition-all duration-300 shadow-xs"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {attachments.length > 0
              ? '✓ All attachments will be transmitted securely to your chosen expert.'
              : 'Tip: You can attach marksheets, result cards, or record a voice note for faster assistance.'}
          </div>

          <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || categories.length === 0 || attachments.some((a) => a.status === 'processing')}
              className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-pink-200 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Query ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <span>Submit Query to Expert</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
