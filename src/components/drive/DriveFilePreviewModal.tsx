import React, { useState, useRef, useEffect } from 'react';
import { DriveItem } from '../../types';
import { formatFileSize, driveFileStreamUrl } from '../../lib/driveService';
import {
  X,
  ExternalLink,
  Download,
  FileText,
  Mic,
  Image as ImageIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Check,
  Folder,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  AlertCircle,
} from 'lucide-react';

interface DriveFilePreviewModalProps {
  item: DriveItem | null;
  onClose: () => void;
}

export const DriveFilePreviewModal: React.FC<DriveFilePreviewModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsPlayingAudio(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [item?.id]);

  if (!item) return null;

  // Audio is streamed through our server so seeking works
  const audioStreamUrl = item.id ? driveFileStreamUrl(item.id) : item.webViewLink;
  const encodedId = encodeURIComponent(item.id || '');

  // Derive Google Drive preview URL (for PDFs, docs, videos)
  const getPreviewUrl = (id: string, webViewLink: string) => {
    if (id) {
      return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    }
    return webViewLink || `https://docs.google.com/viewer?url=${encodeURIComponent(webViewLink)}&embedded=true`;
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(item.webViewLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.error('Audio play error:', err);
          setAudioError(true);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, (audioRef.current.currentTime || 0) + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleToggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPdf = item.type === 'pdf';
  const isAudio = item.type === 'audio';
  const isImage = item.type === 'image';

  const downloadUrl =
    item.id
      ? `https://drive.google.com/uc?export=download&id=${encodedId}`
      : item.webContentLink || item.webViewLink;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 md:p-4 animate-fade-in overflow-hidden">
      <div
        className={`bg-white w-full flex flex-col shadow-2xl border-0 sm:border border-slate-200 overflow-hidden animate-modal-pop transition-all duration-200 ${
          isFullscreen
            ? 'fixed inset-0 rounded-none h-screen max-w-none z-50'
            : 'h-full sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between gap-2 sm:gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPdf
                  ? 'bg-rose-100 text-rose-600'
                  : isAudio
                  ? 'bg-pink-100 text-pink-600'
                  : isImage
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-pink-100 text-pink-600'
              }`}
            >
              {isPdf ? (
                <FileText className="w-5 h-5" />
              ) : isAudio ? (
                <Mic className="w-5 h-5" />
              ) : isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : (
                <Folder className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm break-words whitespace-normal leading-snug">
                {item.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 break-words">
                {item.size && item.size > 0 && <span>{formatFileSize(item.size)} •</span>}
                <span>{isAudio ? 'Voice Message' : 'Google Drive Resource'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons in header */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Download Button */}
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download</span>
            </a>

            {/* Open in Google Drive Primary Button */}
            <a
              href={item.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:px-3 sm:py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-pink-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in Drive</span>
            </a>

            {/* Fullscreen Toggle (desktop/tablet) */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer hidden sm:block"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Copy Share Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Copy link"
            >
              {copied ? <Check className="w-4 h-4 text-pink-600" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewport */}
        <div className="flex-1 w-full h-full min-h-0 bg-slate-50 flex flex-col items-center justify-center overflow-y-auto p-2 sm:p-4 relative">
          {isPdf ? (
            <div className="w-full h-full flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs">
              <iframe
                src={getPreviewUrl(item.id, item.webViewLink)}
                className="w-full h-full flex-1 border-0"
                style={{ width: '100%', height: '100%', minHeight: '100%' }}
                title={item.name}
                allow="autoplay"
              />
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-7 shadow-sm border border-slate-200 text-center space-y-4 my-auto">
              {/* Real HTML5 Audio Element */}
              <audio
                ref={audioRef}
                src={audioStreamUrl}
                preload="metadata"
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onPlay={() => setIsPlayingAudio(true)}
                onPause={() => setIsPlayingAudio(false)}
                onEnded={() => {
                  setIsPlayingAudio(false);
                  setCurrentTime(0);
                }}
                onError={() => {
                  console.warn('Native HTML5 audio failed, fallback to drive preview');
                  setAudioError(true);
                }}
              />

              {/* Icon & Title */}
              <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto border border-pink-100 shadow-xs shadow-pink-100">
                <Mic className="w-8 h-8" />
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words whitespace-normal">
                  {item.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  {item.description || 'Career Code Voice Note & Mentor Advice Recording'}
                </p>
              </div>

              {/* Sleek Interactive Pink Audio Player Card */}
              <div className="bg-pink-50/40 rounded-2xl p-4 border border-pink-100/80 text-left space-y-3.5">
                {/* Scrubber & Timeline */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>

                {/* Main Playback Row */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSkip(-10)}
                    className="p-2 text-slate-600 hover:text-pink-600 hover:bg-pink-100/60 rounded-xl transition-colors cursor-pointer"
                    title="Skip back 10 seconds"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="w-14 h-14 rounded-full bg-pink-600 hover:bg-pink-700 text-white flex items-center justify-center shadow-md shadow-pink-200 transition-transform active:scale-95 cursor-pointer shrink-0"
                  >
                    {isPlayingAudio ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSkip(10)}
                    className="p-2 text-slate-600 hover:text-pink-600 hover:bg-pink-100/60 rounded-xl transition-colors cursor-pointer"
                    title="Skip forward 10 seconds"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom Controls Row: Speed & Mute */}
                <div className="flex items-center justify-between pt-2 border-t border-pink-100/80">
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-pink-200/60">
                    {[1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => handleSpeedChange(spd)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-pink-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-pink-50'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="p-2 text-slate-500 hover:text-pink-600 hover:bg-pink-100/60 rounded-xl transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* In case of browser audio decode error, Google Drive fallback */}
              {audioError && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2 text-left">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Opening in Google Drive web player...</span>
                  </div>
                  <iframe
                    src={`https://drive.google.com/file/d/${encodedId}/preview`}
                    className="w-full h-28 border-0 rounded-lg bg-white shadow-xs"
                    title={item.name}
                    allow="autoplay"
                  />
                </div>
              )}
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2">
              <img
                src={item.thumbnailLink || item.webViewLink}
                alt={item.name}
                className="max-h-full max-w-full rounded-xl object-contain shadow-sm border border-slate-200 bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80';
                }}
              />
            </div>
          ) : (
            <div className="text-center p-6 bg-white rounded-2xl border border-slate-200 max-w-sm m-4 shadow-sm">
              <Folder className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="font-bold text-slate-900 text-sm mb-1">{item.name}</h4>
              <p className="text-xs text-slate-500 mb-4">
                This document can be opened directly inside Google Drive.
              </p>
              <a
                href={item.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open in Google Drive
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
