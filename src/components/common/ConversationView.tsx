import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { QueryTicket, ConversationMessage, AttachmentItem, UserProfile, formatRoleName, CoffeeTreatItem } from '../../types';
import { offlineStorage } from '../../lib/offlineStorage';
import { CustomSelect } from './CustomSelect';
import { CoffeeTreatModal } from './CoffeeTreatModal';
import { LinkifiedText } from './LinkifiedText';
import {
  Send,
  Paperclip,
  CheckCheck,
  FileText,
  User,
  ShieldCheck,
  Download,
  Bookmark,
  BookmarkCheck,
  Mic,
  Volume2,
  Square,
  Trash2,
  Play,
  Pause,
  Phone,
  Mail,
  GraduationCap,
  X,
  Info,
  Calendar,
  Sparkles,
  ArrowLeft,
  Star,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Coffee,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ConversationViewProps {
  ticket: QueryTicket;
  onUpdateTicketStatus?: (status: QueryTicket['status']) => Promise<void>;
  onClose?: () => void;
  onBookmarkSaved?: (msg: ConversationMessage) => void;
  isOversight?: boolean;
}

// Voice Note Audio Player Component (WhatsApp Style)
const WhatsAppVoicePlayer: React.FC<{ audioUrl: string; duration?: number; isMe: boolean }> = ({
  audioUrl,
  duration,
  isMe,
}) => {
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
      const dur = audio.duration && isFinite(audio.duration) ? audio.duration : audioDuration || duration || 1;
      setProgress((audio.currentTime / dur) * 100);
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.onerror = (e) => {
      console.warn('Audio element error:', e);
      setIsPlaying(false);
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
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Voice note playback was interrupted or blocked:', err);
            setIsPlaying(false);
          });
      }
    }
  };

  const handleCycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const dur =
      audioRef.current.duration && isFinite(audioRef.current.duration)
        ? audioRef.current.duration
        : audioDuration || duration || 1;
    const targetTime = ratio * dur;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setProgress(ratio * 100);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalTime = audioDuration || duration || 0;

  return (
    <div className="flex items-center gap-2 sm:gap-3 py-1 w-full max-w-[280px] min-w-0 select-none">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-colors cursor-pointer ${
          isMe
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
        title={isPlaying ? 'Pause' : 'Play Voice Note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-white" />
        ) : (
          <Play className="w-4 h-4 fill-white ml-0.5" />
        )}
      </button>

      <div className="flex-1 space-y-1">
        {/* Interactive Waveform representation (Clickable to seek) */}
        <div
          onClick={handleSeek}
          className="flex items-center gap-0.5 h-6 cursor-pointer py-1"
          title="Click to seek"
        >
          {[35, 75, 55, 90, 30, 80, 60, 100, 45, 70, 85, 50, 65, 95, 40, 70, 50, 80, 60, 75].map(
            (h, i) => {
              const barProgress = (i / 20) * 100;
              const isPlayed = progress >= barProgress;
              return (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    isPlayed
                      ? 'bg-emerald-600'
                      : isMe
                      ? 'bg-emerald-300/80 hover:bg-emerald-400'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              );
            }
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>{formatSeconds(isPlaying ? currentTime : totalTime)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCycleSpeed}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
              title="Toggle playback speed"
            >
              {playbackSpeed}x
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
              <Mic className="w-3 h-3 text-emerald-600" /> Voice Note
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConversationView: React.FC<ConversationViewProps> = ({
  ticket,
  onUpdateTicketStatus,
  onClose,
  onBookmarkSaved,
  isOversight = false,
}) => {
  const { userProfile, updateActivityTimestamp } = useAuth();
  const { markNotificationsForQueryAsRead } = useNotifications();
  const [currentTicket, setCurrentTicket] = useState<QueryTicket>(ticket);
  const [showNewQueryForm, setShowNewQueryForm] = useState(false);
  const [newQueryTitle, setNewQueryTitle] = useState('');
  const [newQueryDetail, setNewQueryDetail] = useState('');
  const [newQueryAttachments, setNewQueryAttachments] = useState<File[]>([]);
  const [submittingNewQuery, setSubmittingNewQuery] = useState(false);
  const [newQueryError, setNewQueryError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentTicket(ticket);
    if (ticket?.id) {
      markNotificationsForQueryAsRead(ticket.id);
    }
  }, [ticket, markNotificationsForQueryAsRead]);

  useEffect(() => {
    if (!ticket?.id) return;
    const unsub = onSnapshot(doc(db, 'queries', ticket.id), (snap) => {
      if (snap.exists()) {
        setCurrentTicket({ id: snap.id, ...snap.data() } as QueryTicket);
      }
    });
    return () => unsub();
  }, [ticket?.id]);

  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    return offlineStorage.get<ConversationMessage[]>(`cc_chat_msgs_${ticket.id}`, []);
  });

  // Instantly load cached offline messages whenever ticket opens/changes
  useEffect(() => {
    const cached = offlineStorage.get<ConversationMessage[]>(`cc_chat_msgs_${ticket.id}`, []);
    if (cached.length > 0) {
      setMessages(cached);
      setTimeout(() => {
        scrollToBottom(false);
      }, 20);
    }
  }, [ticket.id]);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<string[]>([]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState<UserProfile[]>([]);
  const [selectedNewAdminId, setSelectedNewAdminId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const timerIntervalRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatStreamRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputComposerRef = useRef<HTMLDivElement>(null);

  // Dynamic visual viewport height and keyboard tracking for mobile (Android & iOS)
  const [mobileHeight, setMobileHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const scrollToBottom = (smooth = true) => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTo({
        top: chatStreamRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  const handleInputFocus = () => {
    if (typeof window === 'undefined') return;

    const syncViewport = () => {
      // Ensure page scroll stays at (0, 0)
      window.scrollTo(0, 0);

      if (window.visualViewport) {
        const vv = window.visualViewport;
        const currentH = Math.round(vv.height);
        setMobileHeight(currentH);
        document.documentElement.style.setProperty('--chat-visual-height', `${currentH}px`);
        const keyboardActive = (window.innerHeight - currentH) > 100;
        setIsKeyboardOpen(keyboardActive);
      } else {
        const h = window.innerHeight;
        setMobileHeight(h);
        document.documentElement.style.setProperty('--chat-visual-height', `${h}px`);
      }

      scrollToBottom(true);
    };

    // Sync across the keyboard animation sequence (immediate, 60ms, 180ms, 350ms, 500ms)
    syncViewport();
    requestAnimationFrame(syncViewport);
    setTimeout(syncViewport, 60);
    setTimeout(syncViewport, 180);
    setTimeout(syncViewport, 350);
    setTimeout(syncViewport, 500);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobile = () => window.innerWidth < 1280;

    const handleViewportChange = () => {
      if (!isMobile()) {
        setMobileHeight(null);
        setIsKeyboardOpen(false);
        document.documentElement.style.removeProperty('--chat-visual-height');
        return;
      }

      if (window.visualViewport) {
        const vv = window.visualViewport;
        const currentHeight = Math.round(vv.height);
        setMobileHeight(currentHeight);
        document.documentElement.style.setProperty('--chat-visual-height', `${currentHeight}px`);

        const keyboardActive = (window.innerHeight - currentHeight) > 100;
        setIsKeyboardOpen(keyboardActive);

        // Keep page scroll at (0, 0) to prevent browser layout-viewport drift
        if (window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
      } else {
        const h = window.innerHeight;
        setMobileHeight(h);
        document.documentElement.style.setProperty('--chat-visual-height', `${h}px`);
        setIsKeyboardOpen(false);
      }

      scrollToBottom(false);
    };

    handleViewportChange();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      document.documentElement.style.removeProperty('--chat-visual-height');
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  // Determine who is viewing:
  // If the logged-in user's role is 'student', they are a student consulting a counselor.
  // If the logged-in user is an admin (normal_admin, expert_admin, super_admin), they are an admin guiding a student.
  const isViewerStudent = userProfile?.role === 'student';
  const isStudent = isViewerStudent;
  const isAdmin = !isViewerStudent;

  // Crucial requirement: Check if the logged-in user is specifically the assigned counselor.
  // When super_admin or expert_admin opens any chat in oversight mode, isAssignedAdmin will be false,
  // meaning it will NOT mark the query as read/opened or clear unread notifications for the assigned counselor!
  const isAssignedAdmin =
    !isViewerStudent &&
    !isOversight &&
    Boolean(
      userProfile &&
        (userProfile.uid === ticket.expertId ||
          userProfile.uid === ticket.assignedAdminId ||
          (userProfile.email &&
            ticket.expertEmail &&
            userProfile.email.toLowerCase() === ticket.expertEmail.toLowerCase()))
    );

  // Live admin/counselor profile listener
  const [adminDetails, setAdminDetails] = useState<UserProfile | null>(null);
  // Live student profile listener
  const [studentDetails, setStudentDetails] = useState<UserProfile | null>(null);

  useEffect(() => {
    const adminId = ticket.expertId || ticket.assignedAdminId;
    if (!adminId || adminId === 'unassigned') {
      setAdminDetails(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', adminId),
      (snap) => {
        if (snap.exists()) {
          setAdminDetails({ uid: snap.id, ...snap.data() } as UserProfile);
        }
      },
      (err) => {
        console.warn('Could not fetch admin profile:', err);
      }
    );
    return () => unsub();
  }, [ticket.expertId, ticket.assignedAdminId]);

  useEffect(() => {
    if (!ticket.studentId) return;
    const unsub = onSnapshot(
      doc(db, 'users', ticket.studentId),
      (snap) => {
        if (snap.exists()) {
          setStudentDetails({ uid: snap.id, ...snap.data() } as UserProfile);
        }
      },
      (err) => {
        console.warn('Could not fetch student profile:', err);
      }
    );
    return () => unsub();
  }, [ticket.studentId]);

  // Load available counselors when admin opens reassign modal
  useEffect(() => {
    if (!showReassignModal) return;
    const loadAdmins = async () => {
      try {
        const q = query(collection(db, 'users'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as UserProfile;
          if (['super_admin', 'expert_admin', 'normal_admin'].includes(u.role) && u.uid !== userProfile?.uid) {
            list.push(u);
          }
        });
        list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setAvailableAdmins(list);
        if (list.length > 0) {
          setSelectedNewAdminId((prev) => prev || list[0].uid);
        }
      } catch (e) {
        console.warn('Could not load admins:', e);
      }
    };
    loadAdmins();
  }, [showReassignModal, userProfile?.uid]);

  const handleExecuteReassignment = async () => {
    if (!selectedNewAdminId || !userProfile) return;
    setreassigningState();
  };

  const setreassigningState = async () => {
    setReassigning(true);
    try {
      const now = Date.now();
      const targetAdmin = availableAdmins.find((a) => a.uid === selectedNewAdminId);
      const targetAdminName = targetAdmin?.displayName || 'Assigned Counselor';
      const prevAdminName = currentTicket.expertName || currentTicket.assignedAdminName || userProfile?.displayName || 'Previous Counselor';

      // 1. In CURRENT chat: Insert subtle system message
      await addDoc(collection(db, 'messages'), {
        queryId: currentTicket.id,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'super_admin',
        content: `🔄 This query has been reassigned to ${targetAdminName}.`,
        isSystemMessage: true,
        isRead: true,
        createdAt: now,
      });

      // Update current ticket in Firestore
      const oldTicketRef = doc(db, 'queries', currentTicket.id);
      await updateDoc(oldTicketRef, {
        assignmentStatus: 'reassigned',
        reassignedToAdminId: selectedNewAdminId,
        reassignedToAdminName: targetAdminName,
        status: 'resolved',
        lastReplyPreview: `🔄 Reassigned to ${targetAdminName}`,
        lastReplyAt: now,
        updatedAt: now,
      });

      // 2. CHECK IF STUDENT ALREADY HAS A CHAT WITH TARGET COUNSELOR
      const existingChatsQuery = query(
        collection(db, 'queries'),
        where('studentId', '==', currentTicket.studentId),
        where('expertId', '==', selectedNewAdminId)
      );
      const existingSnap = await getDocs(existingChatsQuery);

      // Filter out chats deleted for student or target admin, or already reassigned away
      const existingList: QueryTicket[] = [];
      existingSnap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as QueryTicket;
        const isDeleted =
          Array.isArray(item.deletedForUsers) &&
          (item.deletedForUsers.includes(currentTicket.studentId) ||
            item.deletedForUsers.includes(selectedNewAdminId));
        if (!isDeleted) {
          existingList.push(item);
        }
      });

      let targetTicketId = '';
      let targetTicketNumber = '';

      // Find voice note if present on ticket or in messages thread
      let voiceUrlToReassign = currentTicket.audioUrl || ticket.audioUrl;
      let voiceDurationToReassign = currentTicket.audioDuration || ticket.audioDuration;

      if (!voiceUrlToReassign && messages && messages.length > 0) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].audioUrl) {
            voiceUrlToReassign = messages[i].audioUrl;
            voiceDurationToReassign = messages[i].audioDuration;
            break;
          }
        }
      }

      if (existingList.length > 0) {
        // EXISTING ACTIVE CHAT FOUND: Append into existing chat like a follow-up query
        existingList.sort((a, b) => (b.lastReplyAt || b.createdAt) - (a.lastReplyAt || a.createdAt));
        const existingChat = existingList[0];
        targetTicketId = existingChat.id;
        targetTicketNumber = existingChat.ticketNumber;

        // Reopen existing chat if it was resolved or reassigned, or keep active with new query alert
        await updateDoc(doc(db, 'queries', existingChat.id), {
          status: 'open',
          assignmentStatus: 'assigned',
          hasUnreadStudentReply: false,
          hasUnreadAdminReply: true,
          isInitialQueryReadByAdmin: false,
          lastReplyPreview: voiceUrlToReassign
            ? `🎤 Reassigned Voice Note: ${currentTicket.title}`
            : `📌 Reassigned Query: ${currentTicket.title}`,
          lastReplyAt: now,
          lastSenderRole: 'student',
          updatedAt: now,
          rating: null,
          ratingFeedback: '',
          ratingTags: [],
          ratedAt: null,
          ...(voiceUrlToReassign ? { audioUrl: voiceUrlToReassign, audioDuration: voiceDurationToReassign || 0 } : {}),
        });

        // Insert reassigned query into that existing chat
        await addDoc(collection(db, 'messages'), {
          queryId: existingChat.id,
          senderId: currentTicket.studentId,
          senderName: currentTicket.studentName,
          senderRole: 'student',
          senderAvatarUrl: currentTicket.studentAvatarUrl || '',
          content: `📌 **New Query (Reassigned from ${prevAdminName}): ${currentTicket.title}**\n\n${currentTicket.detail}`,
          ...(voiceUrlToReassign ? { audioUrl: voiceUrlToReassign, audioDuration: voiceDurationToReassign || 0 } : {}),
          attachments: currentTicket.attachments || [],
          isNewQueryHeader: true,
          queryTitle: currentTicket.title,
          isRead: false,
          createdAt: now,
        });
      } else {
        // NO EXISTING CHAT: Create new chat ticket under target admin's name
        const newTicketNumber = `${currentTicket.ticketNumber.replace(/-R\d*$/, '')}-R`;
        targetTicketNumber = newTicketNumber;
        const newTicketData = {
          ticketNumber: newTicketNumber,
          studentId: currentTicket.studentId,
          studentName: currentTicket.studentName,
          studentEmail: currentTicket.studentEmail,
          studentPhone: currentTicket.studentPhone || '',
          studentQualification: currentTicket.studentQualification || 'Not Specified',
          studentBoard: currentTicket.studentBoard || '',
          studentAvatarUrl: currentTicket.studentAvatarUrl || '',
          categoryId: currentTicket.categoryId,
          categoryName: currentTicket.categoryName,
          expertId: selectedNewAdminId,
          expertEmail: targetAdmin?.email ? targetAdmin.email.toLowerCase() : '',
          expertName: targetAdminName,
          expertRole: targetAdmin?.role || 'normal_admin',
          expertTitle: targetAdmin?.professionalTitle || 'Admissions Counselor',
          expertAvatarUrl: targetAdmin?.photoURL || '',
          assignedAdminId: selectedNewAdminId,
          assignedAdminName: targetAdminName,
          title: currentTicket.title,
          detail: currentTicket.detail,
          attachments: currentTicket.attachments || [],
          status: 'open' as QueryTicket['status'],
          assignmentStatus: 'assigned' as const,
          hasUnreadStudentReply: false,
          hasUnreadAdminReply: true,
          isInitialQueryReadByAdmin: false,
          lastReplyPreview: voiceUrlToReassign
            ? `🎤 Voice Note: ${currentTicket.title}`
            : `📌 Initial Query: ${currentTicket.title}`,
          lastReplyAt: now,
          lastSenderRole: 'student' as const,
          reassignedFromAdminId: currentTicket.expertId || currentTicket.assignedAdminId,
          reassignedFromAdminName: prevAdminName,
          reassignedInitialTicketId: currentTicket.id,
          createdAt: now,
          updatedAt: now,
          ...(voiceUrlToReassign ? { audioUrl: voiceUrlToReassign, audioDuration: voiceDurationToReassign || 0 } : {}),
        };

        const newTicketRef = await addDoc(collection(db, 'queries'), newTicketData);
        targetTicketId = newTicketRef.id;
        // The newly created ticket already contains the title, detail, attachments, and voice note,
        // which are rendered at the top of the chat. No duplicate message is inserted.
      }

      // Notifications
      await addDoc(collection(db, 'notifications'), {
        userId: selectedNewAdminId,
        title: `Query Reassigned to You: ${targetTicketNumber}`,
        message: `${currentTicket.studentName}'s query "${currentTicket.title.slice(0, 60)}" has been reassigned to you from ${prevAdminName}.`,
        type: 'new_query',
        queryId: targetTicketId,
        isRead: false,
        createdAt: now,
      }).catch(() => {});

      if (currentTicket.studentId) {
        await addDoc(collection(db, 'notifications'), {
          userId: currentTicket.studentId,
          title: `Query Reassigned to ${targetAdminName}`,
          message: `Your query "${currentTicket.title.slice(0, 50)}" has been transferred to counselor ${targetAdminName}.`,
          type: 'new_reply',
          queryId: targetTicketId,
          isRead: false,
          createdAt: now,
        }).catch(() => {});
      }

      setReassignSuccessMsg(`Query successfully reassigned to ${targetAdminName}.`);
      setCurrentTicket((prev) => ({
        ...prev,
        status: 'resolved',
        assignmentStatus: 'reassigned',
        reassignedToAdminName: targetAdminName,
      }));
      setTimeout(() => {
        setShowReassignModal(false);
        setReassignSuccessMsg(null);
      }, 1200);
    } catch (e: any) {
      console.error('Reassignment error:', e);
    } finally {
      setReassigning(false);
    }
  };

  // Target counterparty info with guaranteed robust fallbacks
  const studentDisplayName =
    studentDetails?.displayName?.trim() ||
    ticket.studentName?.trim() ||
    (ticket as any).userName?.trim() ||
    (ticket as any).name?.trim() ||
    ticket.studentEmail?.split('@')[0] ||
    'Student';

  const rawExpertName =
    adminDetails?.displayName?.trim() ||
    ticket.expertName?.trim() ||
    ticket.assignedAdminName?.trim() ||
    '';

  const expertDisplayName =
    rawExpertName && rawExpertName !== 'unassigned' && rawExpertName !== 'General Expert Queue'
      ? rawExpertName
      : ticket.expertEmail && ticket.expertEmail.includes('@')
      ? ticket.expertEmail.split('@')[0]
      : (ticket.expertTitle || 'Academic Counselor');

  // The counterparty displayed at the top:
  // Student viewer -> sees Counselor's name & details
  // Admin viewer -> sees Student's name & details
  const counterpartyName = isViewerStudent ? expertDisplayName : studentDisplayName;
  const counterpartyAvatar = isViewerStudent
    ? (adminDetails?.photoURL || ticket.expertAvatarUrl || '')
    : (studentDetails?.photoURL || ticket.studentAvatarUrl || '');
  const counterpartyRole = isViewerStudent
    ? (adminDetails?.role || ticket.expertRole || 'expert_admin')
    : 'student';

  const counterpartyProfile = isViewerStudent ? adminDetails : studentDetails;
  // A user is online ONLY if their isOnline flag is active and last active within the last 2 minutes
  const isCounterpartyOnline = Boolean(
    counterpartyProfile?.isOnline === true &&
    counterpartyProfile?.lastActiveAt &&
    Date.now() - counterpartyProfile.lastActiveAt < 2 * 60 * 1000
  );

  // Rating state for student evaluation when resolved
  const [selectedRating, setSelectedRating] = useState<number>(ticket.rating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(ticket.ratingTags || []);
  const [ratingComment, setRatingComment] = useState<string>(ticket.ratingFeedback || '');
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [hasRatedLocally, setHasRatedLocally] = useState<boolean>(Boolean(ticket.rating));

  useEffect(() => {
    const activeRating = currentTicket.rating || ticket.rating;
    if (activeRating) {
      setSelectedRating(activeRating);
      setHasRatedLocally(true);
      if (currentTicket.ratingFeedback || ticket.ratingFeedback) {
        setRatingComment(currentTicket.ratingFeedback || ticket.ratingFeedback || '');
      }
      if (currentTicket.ratingTags || ticket.ratingTags) {
        setSelectedTags(currentTicket.ratingTags || ticket.ratingTags || []);
      }
    } else {
      setSelectedRating(0);
      setHasRatedLocally(false);
      setRatingComment('');
      setSelectedTags([]);
    }
  }, [ticket.rating, currentTicket.rating]);

  // Coffee Treat state for appreciation donations
  const [showCoffeeModal, setShowCoffeeModal] = useState<boolean>(false);
  const [existingCoffeeTreat, setExistingCoffeeTreat] = useState<CoffeeTreatItem | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState<boolean>(false);

  useEffect(() => {
    if (!ticket?.id) return;
    const qCoffee = query(
      collection(db, 'coffee_treats'),
      where('ticketId', '==', ticket.id)
    );
    const unsub = onSnapshot(
      qCoffee,
      (snapshot) => {
        if (!snapshot.empty) {
          const treatData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CoffeeTreatItem;
          setExistingCoffeeTreat(treatData);
        } else {
          setExistingCoffeeTreat(null);
        }
      },
      (err) => {
        console.warn('Error listening to coffee treats:', err);
      }
    );
    return () => unsub();
  }, [ticket?.id]);

  // Minimize state for resolved rating & coffee section to prevent obscuring previous chat messages
  const [isResolvedPanelMinimized, setIsResolvedPanelMinimized] = useState<boolean>(() => {
    return Boolean(ticket.rating || currentTicket.rating);
  });

  const QUICK_RATING_TAGS = [
    'Clear Guidance',
    'Quick Response',
    'Solved My Query',
    'Accurate Eligibility Info',
    'Polite & Encouraging',
  ];

  const RATING_DESCRIPTIONS: Record<number, string> = {
    1: '1 Star — Unsatisfactory',
    2: '2 Stars — Fair Guidance',
    3: '3 Stars — Good & Helpful',
    4: '4 Stars — Very Helpful & Detailed',
    5: '5 Stars — Excellent & Highly Recommended',
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0 || submittingRating) return;
    setSubmittingRating(true);
    try {
      const now = Date.now();
      const ticketRef = doc(db, 'queries', ticket.id);
      await updateDoc(ticketRef, {
        rating: selectedRating,
        ratingFeedback: ratingComment.trim(),
        ratingTags: selectedTags,
        ratedAt: now,
      });

      const adminId = ticket.expertId || ticket.assignedAdminId;
      if (adminId && adminId !== 'unassigned') {
        const adminRef = doc(db, 'users', adminId);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          const data = adminSnap.data();
          const currentCount = Number(data.ratingCount) || 0;
          const currentSum = Number(data.ratingSum) || (currentCount * (Number(data.averageRating) || 0));
          const newCount = currentCount + 1;
          const newSum = currentSum + selectedRating;
          const newAverage = Math.round((newSum / newCount) * 10) / 10;
          await updateDoc(adminRef, {
            ratingCount: newCount,
            ratingSum: newSum,
            averageRating: newAverage,
          });
        }

        await addDoc(collection(db, 'notifications'), {
          userId: adminId,
          title: `⭐ New ${selectedRating}-Star Rating Received!`,
          message: `${userProfile?.displayName || 'Student'} rated your guidance on ticket #${ticket.ticketNumber} (${selectedRating}/5 stars).`,
          type: 'query_rating',
          queryId: ticket.id,
          isRead: false,
          createdAt: now,
        }).catch(() => {});
      }

      setCurrentTicket((prev) => ({
        ...prev,
        rating: selectedRating,
        ratingFeedback: ratingComment.trim(),
        ratingTags: selectedTags,
        ratedAt: now,
      }));
      setHasRatedLocally(true);
      setTimeout(() => {
        setIsResolvedPanelMinimized(true);
      }, 1500);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleStartFollowUpQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryTitle.trim()) {
      setNewQueryError('Please enter a title for your new query.');
      return;
    }
    if (!newQueryDetail.trim()) {
      setNewQueryError('Please explain your question or query in detail.');
      return;
    }
    if (!userProfile) return;

    setSubmittingNewQuery(true);
    setNewQueryError(null);
    try {
      const now = Date.now();
      const attachmentsPayload: AttachmentItem[] = [];

      for (const file of newQueryAttachments) {
        const reader = new FileReader();
        const fileDataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        attachmentsPayload.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: fileDataUrl,
        });
      }

      // 1. Add follow-up query as a highlighted message in this existing chat thread
      const msgData: any = {
        queryId: currentTicket.id,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderRole: userProfile.role,
        senderAvatarUrl: userProfile.photoURL || '',
        content: `📌 **New Query: ${newQueryTitle.trim()}**\n\n${newQueryDetail.trim()}`,
        attachments: attachmentsPayload,
        isNewQueryHeader: true,
        queryTitle: newQueryTitle.trim(),
        isRead: false,
        createdAt: now,
      };

      await addDoc(collection(db, 'messages'), msgData);

      // 2. Reopen ticket status to in_progress and reset rating
      const ticketRef = doc(db, 'queries', currentTicket.id);
      const updateData: any = {
        status: 'in_progress',
        title: newQueryTitle.trim(),
        detail: newQueryDetail.trim(),
        lastReplyPreview: `📌 New Query: ${newQueryTitle.trim()}`,
        lastReplyAt: now,
        lastSenderRole: 'student',
        hasUnreadAdminReply: true,
        hasUnreadStudentReply: false,
        updatedAt: now,
        rating: null,
        ratingFeedback: '',
        ratingTags: [],
        ratedAt: null,
      };

      await updateDoc(ticketRef, updateData);
      setCurrentTicket((prev) => ({ ...prev, ...updateData }));
      if (onUpdateTicketStatus) {
        onUpdateTicketStatus('in_progress');
      }

      // 3. Notify mentor
      const mentorId =
        currentTicket.expertId && currentTicket.expertId !== 'unassigned'
          ? currentTicket.expertId
          : currentTicket.assignedAdminId;

      if (mentorId && mentorId !== 'unassigned') {
        await addDoc(collection(db, 'notifications'), {
          userId: mentorId,
          title: `New Query from ${userProfile.displayName}: ${currentTicket.ticketNumber}`,
          message: `Student asked a follow-up query: "${newQueryTitle.trim().slice(0, 70)}"`,
          type: 'new_query',
          queryId: currentTicket.id,
          isRead: false,
          createdAt: now,
        }).catch(() => {});
      }

      await updateActivityTimestamp();
      setNewQueryTitle('');
      setNewQueryDetail('');
      setNewQueryAttachments([]);
      setShowNewQueryForm(false);
      setHasRatedLocally(false);
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    } catch (err: any) {
      setNewQueryError('Failed to start new query: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingNewQuery(false);
    }
  };

  const handleUpdateTicketStatus = async (newStatus: QueryTicket['status']) => {
    try {
      const ticketRef = doc(db, 'queries', currentTicket.id);
      const updates: any = {
        status: newStatus,
        updatedAt: Date.now(),
      };
      if (newStatus === 'resolved') {
        updates.rating = null;
        updates.ratingFeedback = '';
        updates.ratingTags = [];
        updates.ratedAt = null;
      }
      await updateDoc(ticketRef, updates);
      setCurrentTicket((prev) => ({
        ...prev,
        ...updates,
      }));
      if (newStatus === 'resolved') {
        setSelectedRating(0);
        setHoverRating(0);
        setHasRatedLocally(false);
        setRatingComment('');
        setSelectedTags([]);
      }
      if (onUpdateTicketStatus) {
        onUpdateTicketStatus(newStatus);
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const handleReopenQuickChat = async () => {
    try {
      const ticketRef = doc(db, 'queries', currentTicket.id);
      await updateDoc(ticketRef, {
        status: 'in_progress',
        hasUnreadAdminReply: true,
        hasUnreadStudentReply: false,
        rating: null,
        ratingFeedback: '',
        ratingTags: [],
        ratedAt: null,
        updatedAt: Date.now(),
      });
      setCurrentTicket((prev) => ({
        ...prev,
        status: 'in_progress',
        rating: null as any,
        ratingFeedback: '',
        ratingTags: [],
        ratedAt: null as any,
      }));
      setSelectedRating(0);
      setHoverRating(0);
      setHasRatedLocally(false);
      setRatingComment('');
      setSelectedTags([]);
      if (onUpdateTicketStatus) {
        onUpdateTicketStatus('in_progress');
      }
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminReopenChat = async () => {
    try {
      const ticketRef = doc(db, 'queries', currentTicket.id);
      await updateDoc(ticketRef, {
        status: 'in_progress',
        rating: null,
        ratingFeedback: '',
        ratingTags: [],
        ratedAt: null,
        updatedAt: Date.now(),
      });
      setCurrentTicket((prev) => ({
        ...prev,
        status: 'in_progress',
        rating: null as any,
        ratingFeedback: '',
        ratingTags: [],
        ratedAt: null as any,
      }));
      setSelectedRating(0);
      setHoverRating(0);
      setHasRatedLocally(false);
      setRatingComment('');
      setSelectedTags([]);
      if (onUpdateTicketStatus) {
        onUpdateTicketStatus('in_progress');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Listen to messages for this ticket
  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('queryId', '==', ticket.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ConversationMessage[] = [];
        snapshot.forEach((d) => {
          msgs.push({ id: d.id, ...d.data() } as ConversationMessage);
        });
        setMessages(msgs);
        offlineStorage.set(`cc_chat_msgs_${ticket.id}`, msgs);
        setTimeout(() => {
          scrollToBottom(true);
        }, 80);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'messages');
      }
    );

    return () => unsubscribe();
  }, [ticket.id]);

  // Mark unread ticket flags as read on mount ONLY if viewing user is student OR the assigned admin!
  // When super_admin or expert_admin opens any chat in oversight mode, do NOT mark as opened/read.
  useEffect(() => {
    const markRead = async () => {
      try {
        const ticketRef = doc(db, 'queries', ticket.id);
        if (isStudent && ticket.hasUnreadStudentReply) {
          await updateDoc(ticketRef, { hasUnreadStudentReply: false });
        } else if (isAdmin && isAssignedAdmin) {
          const updates: any = {};
          if (ticket.hasUnreadAdminReply) updates.hasUnreadAdminReply = false;
          if (!ticket.isInitialQueryReadByAdmin) updates.isInitialQueryReadByAdmin = true;
          if (Object.keys(updates).length > 0) {
            await updateDoc(ticketRef, updates);
          }
        }
      } catch (err) {
        // Non-blocking
      }
    };
    markRead();
  }, [ticket.id, isStudent, isAdmin, isAssignedAdmin, ticket.hasUnreadStudentReply, ticket.hasUnreadAdminReply, ticket.isInitialQueryReadByAdmin]);

  // Mark all unread messages sent by counterparty as read so they get genuine blue ticks
  // ONLY if student is viewing, OR the assigned admin is viewing!
  // Oversight super/expert admins should NOT turn the student's ticks blue!
  useEffect(() => {
    if (!userProfile || messages.length === 0) return;
    if (isAdmin && !isAssignedAdmin) return; // Do NOT mark messages as read for oversight viewers!

    const unreadMessages = messages.filter(
      (m) => m.senderId !== userProfile.uid && !m.isRead
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach(async (m) => {
        try {
          await updateDoc(doc(db, 'messages', m.id), { isRead: true });
        } catch (e) {
          // Non-blocking
        }
      });
    }
  }, [messages, userProfile, isAdmin, isAssignedAdmin]);

  // Cleanup audio recorder on unmount
  // Safe audio cleanup
  const cleanupAudioStream = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      audioStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  // Cleanup audio recorder on unmount
  useEffect(() => {
    return () => {
      cleanupAudioStream();
    };
  }, []);

  // Detect supported audio mime types across Chrome, Safari, Firefox, iOS, Android
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
      'audio/aac',
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  // Central voice message publisher to Firestore
  const sendVoiceMessagePayload = async (
    base64Audio: string,
    duration: number,
    customTitle?: string
  ) => {
    if (!userProfile) return;
    const now = Date.now();
    const finalDuration = Math.max(1, Math.round(duration));

    const msgData = {
      queryId: ticket.id,
      senderId: userProfile.uid,
      senderName: userProfile.displayName,
      senderRole: userProfile.role,
      senderAvatarUrl: userProfile.photoURL || '',
      content: customTitle ? `🎤 Voice Note (${customTitle})` : '🎤 Voice Message',
      audioUrl: base64Audio,
      audioDuration: finalDuration,
      attachments: [],
      isRead: false,
      createdAt: now,
    };

    await addDoc(collection(db, 'messages'), msgData);

    // Update query ticket
    const ticketRef = doc(db, 'queries', ticket.id);
    const isSenderStudent = userProfile.role === 'student';
    const updateData: any = {
      lastReplyPreview: '🎤 Voice Message',
      lastReplyAt: now,
      lastSenderRole: userProfile.role,
      lastSenderName: userProfile.displayName,
      lastSenderId: userProfile.uid,
      updatedAt: now,
    };

    if (isSenderStudent) {
      updateData.hasUnreadAdminReply = true;
      if (ticket.status === 'replied' || ticket.status === 'resolved' || currentTicket.status === 'resolved') {
        updateData.status = 'in_progress';
      }
    } else {
      updateData.hasUnreadStudentReply = true;
      updateData.status = 'replied';
      const adminUserRef = doc(db, 'users', userProfile.uid);
      await updateDoc(adminUserRef, { lastReplyAt: now }).catch(() => {});
    }

    if (currentTicket.rating || ticket.rating) {
      updateData.rating = null;
      updateData.ratingFeedback = '';
      updateData.ratingTags = [];
      updateData.ratedAt = null;
    }

    await updateDoc(ticketRef, updateData);

    const recipientId = isSenderStudent
      ? (ticket.expertId && ticket.expertId !== 'unassigned' ? ticket.expertId : (ticket.assignedAdminId && ticket.assignedAdminId !== 'unassigned' ? ticket.assignedAdminId : ''))
      : ticket.studentId;

    if (recipientId) {
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        title: isSenderStudent
          ? `Student Voice Note: ${ticket.ticketNumber}`
          : `Expert Voice Note: ${ticket.ticketNumber}`,
        message: `${userProfile.displayName} sent a voice note (${finalDuration}s)`,
        type: 'new_reply',
        queryId: ticket.id,
        isRead: false,
        createdAt: now,
      }).catch(() => {});
    } else if (isSenderStudent) {
      try {
        const adminsSnap = await getDocs(
          query(collection(db, 'users'), where('role', 'in', ['super_admin', 'expert_admin', 'normal_admin']))
        );
        adminsSnap.forEach(async (adminDoc) => {
          await addDoc(collection(db, 'notifications'), {
            userId: adminDoc.id,
            title: `Student Voice Note: ${ticket.ticketNumber}`,
            message: `${userProfile.displayName} sent a voice note (${finalDuration}s)`,
            type: 'new_reply',
            queryId: ticket.id,
            isRead: false,
            createdAt: now,
          }).catch(() => {});
        });
      } catch {}
    }

    await updateActivityTimestamp();
  };

  // START RECORDING VOICE MESSAGE
  const startVoiceRecording = async () => {
    setRecordingError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setRecordingError('Audio recording is not supported in this browser. You can upload an audio note instead.');
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

      // 250ms timeslice guarantees continuous data chunks
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone start error:', err);
      setRecordingError('Microphone permission blocked or no audio device. You can allow mic access or upload an audio note.');
      cleanupAudioStream();
    }
  };

  // CANCEL VOICE RECORDING
  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupAudioStream();
  };

  // STOP & SEND VOICE MESSAGE
  const sendVoiceRecording = () => {
    if (!mediaRecorderRef.current || !userProfile) {
      cleanupAudioStream();
      return;
    }

    const duration = recordingSeconds || 1;

    mediaRecorderRef.current.onstop = async () => {
      try {
        if (audioChunksRef.current.length === 0) {
          setRecordingError('No audio data captured. Please speak into your mic and try again.');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await sendVoiceMessagePayload(base64Audio, duration);
        };
        reader.readAsDataURL(audioBlob);
      } catch (err: any) {
        console.error('Error saving voice recording:', err);
        setRecordingError('Failed to encode voice note.');
      } finally {
        cleanupAudioStream();
      }
    };

    try {
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.requestData();
        } catch {}
        mediaRecorderRef.current.stop();
      } else {
        cleanupAudioStream();
      }
    } catch (e) {
      cleanupAudioStream();
    }
  };

  // Upload an audio memo / voice file directly
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    setRecordingError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const tempAudio = new Audio(base64Audio);
        tempAudio.onloadedmetadata = async () => {
          const dur = Math.round(tempAudio.duration) || 4;
          await sendVoiceMessagePayload(base64Audio, dur, file.name);
        };
        tempAudio.onerror = async () => {
          await sendVoiceMessagePayload(base64Audio, 4, file.name);
        };
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setRecordingError('Could not upload audio note: ' + err.message);
    }
    e.target.value = '';
  };

  // Send a test voice note using Web Audio API synthesis
  const handleSendTestVoiceNote = async () => {
    if (!userProfile) return;
    setRecordingError(null);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        setRecordingError('Web Audio is not supported in this browser.');
        return;
      }
      const ctx = new AudioCtx();
      const sampleRate = ctx.sampleRate;
      const durationSeconds = 3;
      const numFrames = sampleRate * durationSeconds;
      const buffer = ctx.createBuffer(1, numFrames, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < numFrames; i++) {
        const t = i / sampleRate;
        const freq = t < 1 ? 392 : t < 2 ? 440 : 523.25; // G4 -> A4 -> C5
        const envelope = Math.sin((Math.PI * (t % 1)) / 1);
        data[i] = Math.sin(2 * Math.PI * freq * t) * 0.25 * envelope;
      }

      // Convert buffer to WAV
      const numChannels = 1;
      const bitDepth = 16;
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const dataLength = data.length * bytesPerSample;
      const arrayBuffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(arrayBuffer);

      const writeStr = (offset: number, str: string) => {
        for (let j = 0; j < str.length; j++) view.setUint8(offset + j, str.charCodeAt(j));
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeStr(36, 'data');
      view.setUint32(40, dataLength, true);

      let offset = 44;
      for (let i = 0; i < data.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, data[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }

      const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await sendVoiceMessagePayload(base64, durationSeconds, 'Voice Note');
      };
      reader.readAsDataURL(wavBlob);
    } catch (e: any) {
      setRecordingError('Failed to create test audio note: ' + e.message);
    }
  };

  // SEND TEXT OR FILE MESSAGE
  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const textToSend = newMessage.trim();
    const filesToSend = [...attachmentFiles];
    if (!textToSend && filesToSend.length === 0) return;
    if (!userProfile) return;

    // Immediately clear text input and attachments state so UI resets instantly
    setNewMessage('');
    setAttachmentFiles([]);
    if (textInputRef.current) {
      textInputRef.current.value = '';
      textInputRef.current.style.height = 'auto';
    }

    setSending(true);
    try {
      const now = Date.now();
      const attachmentsPayload: AttachmentItem[] = [];

      for (const file of filesToSend) {
        const reader = new FileReader();
        const fileDataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        attachmentsPayload.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: fileDataUrl,
        });
      }

      // Add to messages collection
      const msgData = {
        queryId: ticket.id,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderRole: userProfile.role,
        senderAvatarUrl: userProfile.photoURL || '',
        content: textToSend,
        attachments: attachmentsPayload,
        isRead: false,
        createdAt: now,
      };

      await addDoc(collection(db, 'messages'), msgData);

      // Update query ticket metadata
      const ticketRef = doc(db, 'queries', ticket.id);
      const isSenderStudent = userProfile.role === 'student';

      const updateData: any = {
        lastReplyPreview: textToSend.slice(0, 120) || (attachmentsPayload.length > 0 ? '📎 File Attachment' : ''),
        lastReplyAt: now,
        lastSenderRole: userProfile.role,
        lastSenderName: userProfile.displayName,
        lastSenderId: userProfile.uid,
        updatedAt: now,
      };

      if (isSenderStudent) {
        updateData.hasUnreadAdminReply = true;
        if (ticket.status === 'replied' || ticket.status === 'resolved' || currentTicket.status === 'resolved') {
          updateData.status = 'in_progress';
        }
      } else {
        updateData.hasUnreadStudentReply = true;
        updateData.status = 'replied';
        const adminUserRef = doc(db, 'users', userProfile.uid);
        await updateDoc(adminUserRef, { lastReplyAt: now }).catch(() => {});
      }

      if (currentTicket.rating || ticket.rating) {
        updateData.rating = null;
        updateData.ratingFeedback = '';
        updateData.ratingTags = [];
        updateData.ratedAt = null;
      }

      await updateDoc(ticketRef, updateData);

      const recipientId = isSenderStudent
        ? (ticket.expertId && ticket.expertId !== 'unassigned' ? ticket.expertId : (ticket.assignedAdminId && ticket.assignedAdminId !== 'unassigned' ? ticket.assignedAdminId : ''))
        : ticket.studentId;

      if (recipientId) {
        await addDoc(collection(db, 'notifications'), {
          userId: recipientId,
          title: isSenderStudent ? `Student Reply: ${ticket.ticketNumber}` : `Expert Reply: ${ticket.ticketNumber}`,
          message: `${userProfile.displayName}: ${textToSend.slice(0, 80) || 'Sent an attachment'}`,
          type: 'new_reply',
          queryId: ticket.id,
          isRead: false,
          createdAt: now,
        }).catch(() => {});
      } else if (isSenderStudent) {
        try {
          const adminsSnap = await getDocs(
            query(collection(db, 'users'), where('role', 'in', ['super_admin', 'expert_admin', 'normal_admin']))
          );
          adminsSnap.forEach(async (adminDoc) => {
            await addDoc(collection(db, 'notifications'), {
              userId: adminDoc.id,
              title: `Student Reply: ${ticket.ticketNumber}`,
              message: `${userProfile.displayName}: ${textToSend.slice(0, 80) || 'Sent an attachment'}`,
              type: 'new_reply',
              queryId: ticket.id,
              isRead: false,
              createdAt: now,
            }).catch(() => {});
          });
        } catch {}
      }

      await updateActivityTimestamp();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setSending(false);
    }
  };

  const handleSaveAnswerBookmark = async (msg: ConversationMessage) => {
    if (!userProfile) return;
    try {
      const now = Date.now();
      await addDoc(collection(db, 'savedAnswers'), {
        studentId: userProfile.uid,
        queryId: ticket.id,
        queryTitle: ticket.title,
        categoryName: ticket.categoryName,
        expertName: msg.senderName,
        questionText: ticket.detail,
        answerText: msg.content,
        savedAt: now,
      });
      setSavedMessageIds((prev) => [...prev, msg.id]);
      if (onBookmarkSaved) onBookmarkSaved(msg);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'savedAnswers');
    }
  };

  return (
    <div
      className="bg-[#efeae2] flex flex-col h-full min-h-0 w-full overflow-hidden relative"
      style={{
        height:
          mobileHeight && typeof window !== 'undefined' && window.innerWidth < 1280
            ? `${mobileHeight}px`
            : '100%',
        maxHeight:
          mobileHeight && typeof window !== 'undefined' && window.innerWidth < 1280
            ? `${mobileHeight}px`
            : '100%',
      }}
    >
      {/* TOP APP BAR - RESPONSIVE & MOBILE/TABLET-FIRST */}
      <div className="bg-[#f0f2f5] border-b border-slate-300 shrink-0 z-20 shadow-xs">
        {/* Contact Row: Back Button + Avatar + Name + Category + Info Button */}
        <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 min-w-0">
          {/* Left: Back Button (Mobile & Tablet) + Avatar + Contact Name + Status */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-200/80 transition-colors xl:hidden shrink-0 cursor-pointer active:scale-95"
                title="Back to chats"
                aria-label="Back to chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div
              onClick={() => setShowProfileDrawer(true)}
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 cursor-pointer hover:bg-slate-200/50 p-1 rounded-xl transition-colors select-none"
              title="Click to view contact profile & info"
            >
              {/* Avatar with Online green badge */}
              <div className="relative shrink-0">
                {counterpartyAvatar ? (
                  <img
                    src={counterpartyAvatar}
                    alt={counterpartyName}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-300 shadow-xs"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs">
                    {(counterpartyName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {isCounterpartyOnline && (
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0 shadow-xs ring-1 ring-emerald-400/50" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-snug">
                    {counterpartyName}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                      isViewerStudent ? 'bg-emerald-100 text-emerald-800' : 'bg-pink-100 text-pink-800'
                    }`}
                  >
                    {isViewerStudent ? 'Counselor' : 'Student'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                  <span className="font-semibold text-emerald-700 truncate max-w-[130px] sm:max-w-none">
                    {ticket.categoryName}
                  </span>
                  <span className="text-slate-400">·</span>
                  {currentTicket.assignmentStatus === 'reassigned' ? (
                    <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                      Reassigned
                    </span>
                  ) : currentTicket.status === 'resolved' ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Resolved
                    </span>
                  ) : isCounterpartyOnline ? (
                    <span className="text-emerald-600 font-semibold truncate flex items-center gap-1">Online</span>
                  ) : (
                    <span className="text-slate-400 truncate">Offline</span>
                  )}
                  {ticket.studentQualification && !isViewerStudent && (
                    <span className="hidden sm:inline text-slate-400">· {ticket.studentQualification}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions (Profile Info, Desktop Close) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowProfileDrawer(true)}
              className="p-1.5 sm:p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-200/70 rounded-full transition-colors cursor-pointer"
              title="View Profile Details"
              aria-label="View Profile Details"
            >
              <Info className="w-5 h-5" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200/60 transition-colors cursor-pointer hidden xl:inline-flex"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Oversight Mode Banner: Alerts super/expert admin that this chat is assigned to another counselor and remains unread for them */}
        {isAdmin && !isAssignedAdmin && (
          <div className="bg-amber-50 border-b border-amber-200/80 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">
                <strong>Oversight Mode:</strong> Assigned to{' '}
                <span className="font-bold text-amber-950">{ticket.expertName || 'Counselor'}</span>. Opening here does not mark it as read for them.
              </span>
            </div>
            <span className="text-[10px] bg-amber-200/70 text-amber-900 font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">
              Unread Status Preserved
            </span>
          </div>
        )}

        {/* Dedicated Admin Status Bar - Responsive & Mobile-Optimized */}
        {isAdmin && onUpdateTicketStatus && (
          <div className="px-2.5 sm:px-4 py-1.5 bg-white border-t border-slate-200/90 flex items-center justify-between gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar flex-nowrap shrink-0">
            {currentTicket.assignmentStatus === 'reassigned' ? (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Status:</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs inline-flex items-center gap-1">
                    <span>🔄 Reassigned to {currentTicket.reassignedToAdminName || 'Counselor'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Chat Closed
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Left: Interactive Status Pill (Shows current status and allows direct change) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Status:</span>
                  <div className="relative inline-flex items-center min-w-[115px]">
                    <CustomSelect
                      value={currentTicket.status}
                      onChange={(val) => handleUpdateTicketStatus(val as QueryTicket['status'])}
                      options={[
                        { value: 'open', label: '● Open' },
                        { value: 'in_progress', label: '● Pending' },
                        { value: 'replied', label: '● Replied' },
                        { value: 'resolved', label: '● Resolved' },
                      ]}
                      size="sm"
                      triggerClassName={`!py-1 !px-2.5 !rounded-full !text-[11px] !font-bold ${
                        currentTicket.status === 'resolved'
                          ? '!bg-emerald-50 !text-emerald-800 !border-emerald-300'
                          : currentTicket.status === 'in_progress'
                          ? '!bg-amber-50 !text-amber-800 !border-amber-300'
                          : currentTicket.status === 'replied'
                          ? '!bg-blue-50 !text-blue-800 !border-blue-300'
                          : '!bg-slate-50 !text-slate-800 !border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Right: Quick Action Buttons (Mark Resolved/Pending + Reassign) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {currentTicket.status !== 'resolved' ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus('resolved')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all whitespace-nowrap shrink-0"
                      title="Mark this query as Resolved"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus('in_progress')}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all whitespace-nowrap shrink-0"
                      title="Mark this query as Pending"
                    >
                      <span>Mark Pending</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowReassignModal(true)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 font-bold rounded-lg text-[11px] shadow-2xs cursor-pointer inline-flex items-center gap-1 transition-all whitespace-nowrap shrink-0"
                    title="Reassign this query to another counselor"
                  >
                    <span>🔄 Reassign</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* CHAT STREAM */}
      <div
        ref={chatStreamRef}
        className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3 overscroll-contain"
        style={{
          backgroundImage: `radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px)`,
          backgroundSize: '24px 24px',
        }}
      >
        {/* Date Stamp Pill */}
        <div className="flex justify-center my-2">
          <span className="text-[11px] font-semibold text-slate-600 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full shadow-xs border border-slate-200 uppercase tracking-wider">
            {new Date(ticket.createdAt).toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* FIRST MESSAGE: STUDENT'S INITIAL QUERY (Clear, prominent, unhidden!) */}
        <div className="flex flex-col items-start max-w-2xl mr-auto w-full">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-bold text-slate-900">{studentDisplayName}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-pink-100 text-pink-800 uppercase tracking-wider">
              {currentTicket.reassignedFromAdminName || ticket.reassignedFromAdminName ? 'Reassigned Query' : 'Initial Query'}
            </span>
          </div>

          {(() => {
            const initialVoiceUrl = currentTicket?.audioUrl || ticket?.audioUrl;
            const initialVoiceDuration = currentTicket?.audioDuration || ticket?.audioDuration || 0;
            const displayTitle = currentTicket?.title || ticket?.title;
            const displayDetail = currentTicket?.detail || ticket?.detail;
            const displayCategory = currentTicket?.categoryName || ticket?.categoryName;
            const displayAttachments = currentTicket?.attachments || ticket?.attachments;
            const reassignedFrom = currentTicket?.reassignedFromAdminName || ticket?.reassignedFromAdminName;

            return (
              <div className="bg-white rounded-2xl rounded-tl-xs p-4 sm:p-5 text-sm text-slate-800 shadow-sm border border-slate-200/80 max-w-full sm:max-w-[92%] relative animate-message-in">
                <div className="pb-2 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {displayCategory}
                    </span>
                    {reassignedFrom && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        🔄 Reassigned from {reassignedFrom}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">{displayTitle}</h3>
                </div>

                <p className="whitespace-pre-wrap leading-relaxed text-slate-800 text-[14px]">
                  <LinkifiedText text={displayDetail || ''} />
                </p>

                {/* Student Voice Note in Initial Query */}
                {initialVoiceUrl && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mb-1.5">
                      <Mic className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Student Voice Note Query</span>
                    </div>
                    <WhatsAppVoicePlayer
                      audioUrl={initialVoiceUrl}
                      duration={initialVoiceDuration}
                      isMe={isViewerStudent}
                    />
                  </div>
                )}

                {/* Query Attachments */}
                {displayAttachments && displayAttachments.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2">
                    {displayAttachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        download={att.name}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span className="max-w-[150px] truncate">{att.name}</span>
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Initial Query Double Ticks: Blue when actually seen by counselor, grey when pending */}
                {(() => {
                  const isInitialSeen = Boolean(
                    currentTicket.isInitialQueryReadByAdmin ||
                    ticket.isInitialQueryReadByAdmin ||
                    !currentTicket.hasUnreadAdminReply ||
                    currentTicket.status !== 'open' ||
                    currentTicket.lastReplyAt
                  );
                  return (
                    <div
                      className="flex items-center justify-end gap-1 mt-2 pt-1 text-[11px] text-slate-400 select-none"
                      title={isInitialSeen ? 'Read by Counselor' : 'Delivered, awaiting counselor review'}
                    >
                      <span className="tabular-nums">
                        {new Date(currentTicket.createdAt || ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <CheckCheck
                        className={`w-3.5 h-3.5 ${isInitialSeen ? 'text-[#53bdeb]' : 'text-slate-400'}`}
                      />
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>

        {/* FOLLOW-UP MESSAGES THREAD (Filtered to never duplicate the initial reassigned query) */}
        {(() => {
          const isReassignedTicket = Boolean(
            currentTicket.reassignedFromAdminName ||
            currentTicket.reassignedInitialTicketId ||
            currentTicket.ticketNumber?.includes('-R') ||
            ticket.reassignedFromAdminName ||
            ticket.ticketNumber?.includes('-R')
          );

          const displayMessages = messages.filter((msg) => {
            if (
              isReassignedTicket &&
              (msg.content?.startsWith('📌 **Reassigned Query:') || msg.content?.startsWith('📌 Reassigned Query:'))
            ) {
              return false;
            }
            return true;
          });

          return displayMessages.map((msg) => {
            const isMe = msg.senderId === userProfile?.uid;
            const isMsgAdmin = msg.senderRole !== 'student';
            const isSaved = savedMessageIds.includes(msg.id);
            const isNewQuery = Boolean(msg.isNewQueryHeader || msg.content?.startsWith('📌 **New Query:'));

          if (msg.isSystemMessage || msg.senderId === 'system' || msg.content?.startsWith('🔄')) {
            return (
              <div key={msg.id} className="w-full my-3 flex justify-center select-none animate-fade-in px-4">
                <div className="bg-amber-50 border border-amber-200/90 text-amber-900 text-xs px-4 py-2 rounded-2xl shadow-2xs flex items-center gap-2 max-w-md text-center leading-relaxed">
                  <span className="text-base shrink-0">🔄</span>
                  <span className="font-semibold text-[12px]">{msg.content}</span>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={msg.id}>
              {isNewQuery && (
                <div className="w-full my-6 flex flex-col items-center select-none animate-fade-in">
                  <div className="flex items-center gap-3 w-full max-w-lg my-1">
                    <div className="h-px bg-slate-300 flex-1" />
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3.5 py-1 rounded-full shadow-2xs flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>New Follow-up Query Started</span>
                    </span>
                    <div className="h-px bg-slate-300 flex-1" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {new Date(msg.createdAt).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              <div
                className={`flex flex-col ${isMe ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-2xl w-full`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      isMsgAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-pink-100 text-pink-800'
                    }`}
                  >
                    {isMsgAdmin ? 'Counselor' : 'Student'}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-3.5 sm:p-4 text-sm text-slate-900 shadow-sm border max-w-full sm:max-w-[85%] relative animate-message-in ${
                    isNewQuery
                      ? 'bg-white border-2 border-emerald-500/50 rounded-tl-xs shadow-md'
                      : isMe
                      ? 'bg-[#d9fdd3] border-[#c0f0ba] rounded-tr-xs'
                      : 'bg-white border-slate-200/80 rounded-tl-xs'
                  }`}
                >
                  {isNewQuery ? (
                    <div className="space-y-2">
                      <div className="pb-2 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider">
                            Follow-up Query
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {msg.queryTitle && (
                          <h4 className="text-base font-bold text-slate-900 mt-1">
                            {msg.queryTitle}
                          </h4>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-[14px] text-slate-800">
                        <LinkifiedText
                          text={msg.content.replace(/^📌 \*\*New Query:[^\n]+\*\*\n\n/, '')}
                          isMe={isMe}
                        />
                      </p>
                      {msg.audioUrl && (
                        <div className="pt-2 border-t border-slate-100">
                          <WhatsAppVoicePlayer
                            audioUrl={msg.audioUrl}
                            duration={msg.audioDuration}
                            isMe={isMe}
                          />
                        </div>
                      )}
                    </div>
                  ) : msg.audioUrl ? (
                  <WhatsAppVoicePlayer
                    audioUrl={msg.audioUrl}
                    duration={msg.audioDuration}
                    isMe={isMe}
                  />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed text-[14px]">
                    <LinkifiedText text={msg.content} isMe={isMe} />
                  </p>
                )}

                {/* File attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-black/10 space-y-1.5">
                    {msg.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        download={att.name}
                        className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-800 border border-slate-200 shadow-xs transition-colors"
                      >
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[180px]">{att.name}</span>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Bookmark button for student */}
                {isStudent && isMsgAdmin && !msg.audioUrl && (
                  <div className="mt-2 pt-1.5 border-t border-black/10 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSaveAnswerBookmark(msg)}
                      disabled={isSaved}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        isSaved ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-800'
                      }`}
                      title="Save answer to Bookmarks"
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Saved in Bookmarks</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save to Bookmarks</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Bubble Timestamp & Double Blue Ticks (Blue only when actually read by counterparty) */}
                <div
                  className="flex items-center justify-end gap-1 mt-1 text-[11px] text-slate-400 select-none"
                  title={msg.isRead ? 'Seen' : 'Delivered'}
                >
                  <span className="tabular-nums">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                    <CheckCheck
                      className={`w-3.5 h-3.5 ${msg.isRead ? 'text-[#53bdeb]' : 'text-slate-400'}`}
                    />
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      });
    })()}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT COMPOSER & VOICE RECORDER - DOCKED AT BOTTOM */}
      <div
        ref={inputComposerRef}
        className={`p-2 sm:p-2.5 lg:p-3 bg-[#f0f2f5] border-t border-slate-300 shrink-0 z-20 transition-all ${
          isKeyboardOpen ? 'pb-2' : 'pb-[max(0.6rem,env(safe-area-inset-bottom,0.6rem))]'
        }`}
      >
        {recordingError && (
          <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150">
            <div>
              <span className="font-semibold block">{recordingError}</span>
              <span className="text-[11px] text-amber-700">You can upload an audio note or send a test audio memo.</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[11px] font-bold text-amber-900 cursor-pointer shadow-xs inline-flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Upload Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioFileUpload}
                />
              </label>
              <button
                type="button"
                onClick={handleSendTestVoiceNote}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Send Test Note</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordingError(null)}
                className="text-amber-500 hover:text-amber-800 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Selected Attachment Files preview */}
        {attachmentFiles.length > 0 && !isRecording && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachmentFiles.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 text-xs bg-white text-slate-800 px-2.5 py-1 rounded-lg border border-slate-300 font-medium shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600 ml-1 text-sm font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* REASSIGNED NOTICE / RESOLVED QUERY RATING / CLOSED BAR OR ACTIVE RECORDING / TEXT INPUT */}
        {currentTicket.assignmentStatus === 'reassigned' ? (
          <div className="py-2">
            <div className="bg-purple-50/95 border border-purple-200 rounded-2xl p-4 sm:p-5 text-center max-w-lg mx-auto shadow-xs animate-fade-up">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-2">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold mb-2 border border-purple-200">
                <span>🔄 Query Reassigned</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {isStudent
                  ? `Your query has been transferred to counselor ${currentTicket.reassignedToAdminName || 'another counselor'}.`
                  : `This query has been transferred to counselor ${currentTicket.reassignedToAdminName || 'another counselor'}.`}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {isStudent
                  ? `Discussion for this query has been transferred to your chat with counselor ${currentTicket.reassignedToAdminName || ''}. This session is now closed.`
                  : `This chat session has been closed because the query was reassigned.`}
              </p>
            </div>
          </div>
        ) : currentTicket.status === 'resolved' ? (
          isResolvedPanelMinimized ? (
            /* Minimized Slim Bar: Only ~44px, leaving 95%+ of screen space for previous chat messages */
            <div className="py-1 px-1 max-w-lg mx-auto animate-fade-in">
              <div className="bg-white/95 backdrop-blur-md border border-pink-200/90 rounded-2xl p-2 px-3 shadow-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      Query Resolved
                    </span>
                    {Boolean((currentTicket.rating && currentTicket.rating > 0) || (hasRatedLocally && selectedRating > 0)) ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>{(currentTicket.rating || selectedRating)}.0★</span>
                      </span>
                    ) : isStudent ? (
                      <span className="text-[10px] font-semibold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100 shrink-0">
                        Unrated
                      </span>
                    ) : null}
                    {existingCoffeeTreat && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">
                        <Coffee className="w-3 h-3 text-amber-600 fill-amber-500/20" />
                        <span>Coffee</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isStudent && (
                    <button
                      type="button"
                      onClick={() => setShowCoffeeModal(true)}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 active:scale-95"
                    >
                      <Coffee className="w-3 h-3 fill-white/20" />
                      <span>Coffee</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsResolvedPanelMinimized(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    title="Expand Review & Coffee Panel"
                  >
                    <span>{isStudent && !Boolean(currentTicket.rating || selectedRating) ? 'Rate' : 'Details'}</span>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Expanded Panel - Single unified card without nested independent scrolling */
            <div className="py-1 max-w-lg mx-auto">
              <div className="bg-white border-2 border-pink-200/90 rounded-2xl p-3 sm:p-4 shadow-md space-y-3 animate-fade-up">
                {/* Header with Minimize Toggle */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-extrabold text-slate-900">
                      Query Marked Resolved
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsResolvedPanelMinimized(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    title="Minimize to read previous chat messages"
                  >
                    <span>Minimize (View Chat)</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>

                {isStudent ? (
                  <>
                    {Boolean((currentTicket.rating && currentTicket.rating > 0) || (hasRatedLocally && selectedRating > 0)) ? (
                      /* Already rated confirmation summary */
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Rating Submitted</span>
                        </div>
                        <p className="text-xs text-slate-600 mb-1.5 font-medium">
                          You rated your counseling session with <span className="font-bold text-slate-800">{counterpartyName}</span>:
                        </p>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                s <= (currentTicket.rating || selectedRating)
                                  ? 'fill-amber-400 text-amber-400 drop-shadow-2xs'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="font-bold text-xs sm:text-sm text-slate-800 ml-1.5">
                            {(currentTicket.rating || selectedRating)}.0 / 5.0
                          </span>
                        </div>

                        {(currentTicket.ratingFeedback || ratingComment) && (
                          <p className="text-[11px] text-slate-600 italic bg-white rounded-lg p-2 border border-slate-200/80 mt-1.5 text-left">
                            "{currentTicket.ratingFeedback || ratingComment}"
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
                          {(currentTicket.ratingTags || selectedTags).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full"
                            >
                              ✓ {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Student Interactive Rating Form */
                      <div className="space-y-3">
                        <div className="text-center">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                            How satisfied are you with {counterpartyName}'s guidance?
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Rate your counselor to help other students choose the best mentor.
                          </p>
                        </div>

                        {/* 5 Interactive Stars */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setSelectedRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                className="p-1 transition-transform hover:scale-115 active:scale-95 cursor-pointer focus:outline-none"
                                aria-label={`Rate ${star} star`}
                              >
                                <Star
                                  className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                                    star <= (hoverRating || selectedRating)
                                      ? 'fill-amber-400 text-amber-400 drop-shadow-2xs'
                                      : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 mt-0.5">
                            {hoverRating > 0 || selectedRating > 0
                              ? RATING_DESCRIPTIONS[hoverRating || selectedRating]
                              : 'Tap a star to rate counselor'}
                          </span>
                        </div>

                        {/* Quick Rating Tags */}
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {QUICK_RATING_TAGS.map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  setSelectedTags((prev) =>
                                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                                  );
                                }}
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer border ${
                                  isSelected
                                    ? 'bg-pink-600 text-white border-pink-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-pink-300'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>

                        {/* Feedback Review Comment */}
                        <div>
                          <textarea
                            rows={2}
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Write a brief comment about guidance (optional)..."
                            className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-slate-400"
                          />
                        </div>

                        {/* Submit Button */}
                        <button
                          type="button"
                          disabled={submittingRating || selectedRating === 0}
                          onClick={handleSubmitRating}
                          className={`w-full py-2 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 ${
                            selectedRating === 0
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-pink-600 hover:bg-pink-700 text-white cursor-pointer active:scale-[0.99]'
                          }`}
                        >
                          {submittingRating ? (
                            <span>Submitting Rating...</span>
                          ) : selectedRating === 0 ? (
                            <span>Tap a star above to rate (1 to 5 stars)</span>
                          ) : (
                            <>
                              <Star className="w-4 h-4 fill-white" />
                              <span>Submit Rating ({selectedRating} Stars)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Buy Him a Coffee Button - Compact & Clean */}
                    <div className="flex flex-col items-center justify-center pt-1 border-t border-slate-100">
                      {existingCoffeeTreat ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs font-semibold shadow-2xs">
                          <Coffee className="w-4 h-4 text-amber-600 fill-amber-500/20 shrink-0" />
                          <span>You treated {counterpartyName} to a coffee! ☕</span>
                          <button
                            type="button"
                            onClick={() => setShowReceiptViewer(true)}
                            className="text-pink-600 hover:text-pink-800 font-bold underline ml-1 cursor-pointer"
                          >
                            View Receipt
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCoffeeModal(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95"
                        >
                          <Coffee className="w-3.5 h-3.5 fill-amber-100/30 text-amber-100" />
                          <span>Buy {counterpartyName} a Coffee ☕</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  /* Admin Resolved View */
                  <div className="text-center space-y-2">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      If the student asks a follow-up query, this chat will automatically reopen. You can also reopen now.
                    </p>

                    <div>
                      <button
                        type="button"
                        onClick={handleAdminReopenChat}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>Reopen Chat to Send Guidance</span>
                      </button>
                    </div>

                    {currentTicket.rating ? (
                      <div className="pt-2 border-t border-slate-100 flex flex-col items-center">
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>Student Rating: {currentTicket.rating}.0 / 5.0</span>
                        </div>
                        {currentTicket.ratingFeedback && (
                          <p className="text-[11px] text-slate-600 italic mt-1 max-w-sm">
                            "{currentTicket.ratingFeedback}"
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        Awaiting student review and rating.
                      </p>
                    )}

                    {existingCoffeeTreat && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col items-center">
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          <Coffee className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
                          <span>Student sent a ☕ Coffee Treat</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowReceiptViewer(true)}
                          className="mt-1 text-[11px] font-bold text-pink-600 hover:underline cursor-pointer"
                        >
                          View Payment Screenshot & Details →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        ) : isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-full border border-slate-300 shadow-sm animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-bold text-rose-700">Recording...</span>
              <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">
                {Math.floor(recordingSeconds / 60)}:
                {recordingSeconds % 60 < 10 ? '0' : ''}
                {recordingSeconds % 60}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                title="Cancel Voice Message"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={sendVoiceRecording}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Send Voice</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD WHATSAPP TEXT / FILE / MIC BAR (Non-form container avoids Android/Gboard payment autofill toolbar) */
          <div
            className="flex items-end gap-1 sm:gap-2"
          >
            {/* Attachment paperclip */}
            <label
              title="Attach document or image"
              className="p-2 sm:p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60 rounded-full cursor-pointer transition-colors shrink-0 mb-0.5"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setAttachmentFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
                  }
                }}
              />
            </label>

            {/* Audio Voice Note Upload option */}
            <label
              title="Upload recorded audio note (.mp3, .m4a, .wav, .ogg)"
              className="p-1.5 sm:p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 rounded-full cursor-pointer transition-colors shrink-0 mb-0.5"
            >
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioFileUpload}
              />
            </label>

            {/* Auto-expanding Chat Textarea (Disables browser card/payment/password autofill toolbar) */}
            <textarea
              ref={textInputRef}
              rows={1}
              name="chat_message_entry"
              id="chat_message_entry"
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              inputMode="text"
              enterKeyHint="send"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-dashlane-ignore="true"
              data-prevent-autofill="true"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                  if (textInputRef.current) {
                    textInputRef.current.style.height = 'auto';
                  }
                }
              }}
              onFocus={handleInputFocus}
              onClick={handleInputFocus}
              placeholder="Type a message..."
              className="flex-1 min-w-0 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs resize-none overflow-y-auto max-h-28 leading-relaxed"
            />

            {/* If user typed or attached something -> Show Send Button; else Show Mic Button for Voice Note! */}
            {newMessage.trim() || attachmentFiles.length > 0 ? (
              <button
                type="button"
                disabled={sending}
                onClick={() => handleSendMessage()}
                className="p-2 sm:p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50 mb-0.5"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="p-2 sm:p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xs transition-colors shrink-0 cursor-pointer mb-0.5"
                title="Click to record Voice Note"
              >
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* WHATSAPP-STYLE CONTACT INFO / PROFILE SLIDE-OVER DRAWER */}
      {showProfileDrawer && (
        <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full sm:w-96 bg-[#f0f2f5] h-full shadow-2xl flex flex-col overflow-y-auto animate-slide-in-right border-l border-slate-300">
            {/* Drawer Header */}
            <div className="p-4 bg-[#008069] text-white flex items-center justify-between shrink-0 shadow-xs">
              <span className="font-bold text-sm tracking-wide">
                {isStudent ? 'Counselor Profile' : 'Student Contact Info'}
              </span>
              <button
                type="button"
                onClick={() => setShowProfileDrawer(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Profile DP & Name Section */}
            <div className="bg-white p-6 flex flex-col items-center text-center border-b border-slate-200 shadow-xs">
              {counterpartyAvatar ? (
                <img
                  src={counterpartyAvatar}
                  alt={counterpartyName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-md mb-3"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-3xl shadow-md mb-3">
                  {counterpartyName ? counterpartyName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <h2 className="text-lg font-bold text-slate-900">{counterpartyName}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mt-1">
                {isStudent ? 'Verified PrepTitans Counselor' : 'Registered Student'}
              </span>

              {/* Counselor Star Rating Display */}
              {isStudent && (
                adminDetails && Number(adminDetails.ratingCount) > 0 ? (
                  <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full shadow-2xs">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-xs text-amber-900">
                      {adminDetails.averageRating ? adminDetails.averageRating.toFixed(1) : '5.0'} / 5.0
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">
                      ({adminDetails.ratingCount} {adminDetails.ratingCount === 1 ? 'student review' : 'student reviews'})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-2.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] text-slate-500 font-medium">
                    <span>Not yet rated</span>
                  </div>
                )
              )}
            </div>

            {/* Details List */}
            <div className="p-4 space-y-3 flex-1 text-xs">
              {isStudent ? (
                /* COUNSELOR VIEW: STRICT PRIVACY - ONLY NAME, TITLE, DESCRIPTION, RATING, CATEGORY. NO CONTACT INFO! */
                <>
                  {/* Professional Title */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Designation</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {adminDetails?.professionalTitle || ticket.expertTitle || 'Academic & Admissions Counselor'}
                    </p>
                  </div>

                  {/* Short Bio / Description */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">About Counselor</span>
                    <p className="text-slate-700 leading-relaxed">
                      {adminDetails?.shortDescription ||
                        'Verified academic counselor providing specialized guidance in university admissions, entry tests, and career roadmaps.'}
                    </p>
                  </div>

                  {/* Specialized Category */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Guidance Domain</span>
                    <span className="inline-block font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      {ticket.categoryName}
                    </span>
                  </div>

                  {/* Active Consultation Info */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Consultation Session</span>
                    <p className="font-semibold text-slate-800">{ticket.status === 'resolved' ? 'Resolved & Closed' : 'Active Discussion'}</p>
                    <p className="text-slate-500 text-[11px]">
                      Started on {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </>
              ) : (
                /* ADMIN VIEWING STUDENT: CONTACT DETAILS */
                <>
                  {/* Phone */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Phone Number</span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-sm">
                        {ticket.studentPhone || 'Not provided'}
                      </span>
                      {ticket.studentPhone && (
                        <a
                          href={`tel:${ticket.studentPhone}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Email</span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 truncate mr-2">
                        {ticket.studentEmail}
                      </span>
                      <a
                        href={`mailto:${ticket.studentEmail}`}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    </div>
                  </div>

                  {/* Academic Qualification */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Education & Board</span>
                    <p className="font-semibold text-slate-900">
                      {ticket.studentQualification}
                    </p>
                    {ticket.studentBoard && (
                      <p className="text-slate-600 text-[11px]">{ticket.studentBoard}</p>
                    )}
                  </div>

                  {/* Academic Field Category */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Selected Category</span>
                    <span className="inline-block font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {ticket.categoryName}
                    </span>
                  </div>

                  {/* Session Information */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-slate-400 text-[11px] block uppercase font-semibold">Consultation Session</span>
                    <p className="font-semibold text-slate-800">{ticket.status === 'resolved' ? 'Resolved' : 'Active Discussion'}</p>
                    <p className="text-slate-500 text-[11px]">
                      Submitted on {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Close Drawer Button */}
            <div className="p-4 bg-white border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowProfileDrawer(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN QUERY MODAL FOR ADMINS */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 animate-modal-pop">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                  🔄
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Reassign Query</h3>
                  <p className="text-[11px] text-slate-500">{currentTicket.ticketNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reassignSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <p className="text-sm font-bold text-emerald-800">{reassignSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-3.5 pt-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Select the advisor who should take over student <strong>{studentDisplayName}</strong>'s query.
                  A note will appear in this chat, and a brand new chat under the new counselor's name will be opened with the initial query at the top.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select New Counselor *
                  </label>
                  <CustomSelect
                    value={selectedNewAdminId}
                    onChange={(val) => setSelectedNewAdminId(val)}
                    options={availableAdmins.map((adm) => ({
                      value: adm.uid,
                      label: adm.displayName || 'Advisor',
                      sublabel: formatRoleName(adm.role),
                    }))}
                    placeholder="Select new counselor"
                    searchable
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowReassignModal(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reassigning || !selectedNewAdminId}
                    onClick={handleExecuteReassignment}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coffee Treat Modal */}
      {showCoffeeModal && (
        <CoffeeTreatModal
          isOpen={showCoffeeModal}
          onClose={() => setShowCoffeeModal(false)}
          ticket={currentTicket}
          userProfile={userProfile}
          counselorName={counterpartyName}
          counselorId={currentTicket.expertId || currentTicket.assignedAdminId}
          onSuccessSubmitted={() => {
            // Updated via real-time onSnapshot
          }}
        />
      )}

      {/* Coffee Treat Receipt & Screenshot Details Modal */}
      {showReceiptViewer && existingCoffeeTreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-100 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-inner">
                  <Coffee className="w-5 h-5 text-amber-700 fill-amber-700/20" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Coffee Treat Details</h3>
                  <p className="text-[11px] text-slate-500">JazzCash Payment Proof</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptViewer(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2 text-xs border border-slate-200/80">
              <div className="flex justify-between text-slate-600">
                <span>Student:</span>
                <span className="font-bold text-slate-800">{existingCoffeeTreat.studentName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Counselor:</span>
                <span className="font-bold text-slate-800">{existingCoffeeTreat.expertName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount:</span>
                <span className="font-bold text-emerald-600">Rs. {existingCoffeeTreat.amount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Account & Method:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  03087144168 (Hamza Saif - {existingCoffeeTreat.paymentMethod || 'JazzCash / EasyPaisa / SadaPay'})
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Submitted:</span>
                <span className="text-slate-700">{new Date(existingCoffeeTreat.createdAt).toLocaleString()}</span>
              </div>
              {existingCoffeeTreat.note && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5 font-medium">Message from Student:</span>
                  <p className="italic text-slate-800 bg-white p-2 rounded-xl border border-slate-200/60 font-medium">
                    "{existingCoffeeTreat.note}"
                  </p>
                </div>
              )}
            </div>

            {existingCoffeeTreat.screenshotUrl && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  JazzCash Transaction Screenshot:
                </span>
                <div className="rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-900 max-h-72 flex items-center justify-center p-1">
                  <img
                    src={existingCoffeeTreat.screenshotUrl}
                    alt="Payment Screenshot Proof"
                    className="max-h-70 object-contain rounded-xl"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowReceiptViewer(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
