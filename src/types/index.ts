export type UserRole = 'student' | 'normal_admin' | 'expert_admin' | 'super_admin';

export const formatRoleName = (role?: string) => {
  if (!role) return 'Member';
  if (role === 'super_admin') return 'Expert Admin';
  if (role === 'expert_admin') return 'Expert Admin';
  if (role === 'normal_admin') return 'Admin';
  if (role === 'student') return 'Student';
  return role.replace('_', ' ');
};

export type AccountStatus = 'active' | 'deactivated';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  qualification?: string;
  qualificationDetail?: string;
  board?: string;
  phoneNumber?: string;
  professionalTitle?: string;
  shortDescription?: string;
  photoURL?: string;
  assignedCategories?: string[]; // Category IDs
  ratingCount?: number;
  ratingSum?: number;
  averageRating?: number;
  status: AccountStatus;
  createdAt: number; // millisecond timestamp
  lastActiveAt: number; // millisecond timestamp
  lastReplyAt?: number;
  isOnline?: boolean;
  /** Set after an admin creates the account or resets its password. */
  mustChangePassword?: boolean;
}

export interface AdminCategoryAssignment {
  adminId: string;
  categoryId: string;
  assignedAt: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  subcategories?: string[];
  assignedAdminIds: string[];
  primaryAdminId?: string;
  backupAdminId?: string;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  storagePath?: string;
}

export type QueryStatus = 'open' | 'in_progress' | 'replied' | 'waiting_for_student' | 'resolved';

export interface QueryTicket {
  id: string;
  ticketNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  studentQualification: string;
  studentBoard?: string;
  studentAvatarUrl?: string;
  categoryId: string;
  categoryName: string;
  expertId: string;
  expertEmail?: string;
  expertName: string;
  expertRole: string;
  expertTitle?: string;
  expertAvatarUrl?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  title: string;
  detail: string;
  audioUrl?: string;
  audioDuration?: number;
  attachments?: AttachmentItem[];
  status: QueryStatus;
  assignmentStatus: 'assigned' | 'unassigned' | 'reassigned';
  hasUnreadStudentReply: boolean;
  hasUnreadAdminReply: boolean;
  isInitialQueryReadByAdmin?: boolean;
  lastReplyPreview?: string;
  lastReplyAt?: number;
  lastSenderRole?: UserRole;
  lastSenderName?: string;
  lastSenderId?: string;
  rating?: number; // 1 to 5 stars
  ratingFeedback?: string;
  ratingTags?: string[];
  ratedAt?: number;
  deletedForUsers?: string[];
  reassignedToAdminId?: string;
  reassignedToAdminName?: string;
  reassignedFromAdminId?: string;
  reassignedFromAdminName?: string;
  reassignedInitialTicketId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  id: string;
  queryId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatarUrl?: string;
  content: string;
  audioUrl?: string;
  audioDuration?: number;
  attachments?: AttachmentItem[];
  isNewQueryHeader?: boolean;
  queryTitle?: string;
  isSystemMessage?: boolean;
  isRead: boolean;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type:
    | 'query_update'
    | 'new_reply'
    | 'new_query'
    | 'admin_alert'
    | 'assignment'
    | 'query_rating'
    | 'query_resolved'
    | 'coffee_treat'
    | 'platform_review';
  queryId?: string;
  isRead: boolean;
  createdAt: number;
}

export interface CoffeeTreatItem {
  id?: string;
  ticketId: string;
  ticketNumber?: string;
  ticketTitle?: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  expertId: string;
  expertName: string;
  expertTitle?: string;
  amount: number;
  paymentMethod: string;
  accountNumber: string;
  accountTitle: string;
  screenshotUrl: string;
  screenshotName?: string;
  note?: string;
  status: 'submitted' | 'confirmed' | 'delivered';
  createdAt: number;
}

export interface SavedAnswerItem {
  id: string;
  studentId: string;
  queryId: string;
  /** The bookmarked reply, when saved from a specific chat message. */
  messageId?: string;
  queryTitle: string;
  categoryName: string;
  expertName: string;
  questionText: string;
  answerText: string;
  savedAt: number;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  timestamp: number;
}

export const QUALIFICATION_OPTIONS = [
  'Matric',
  'Intermediate / FSc',
  'ICS',
  'ICom',
  'FA',
  'A Levels',
  'Diploma',
  "Undergraduate / Bachelor's",
  "Graduate / Master's",
  'Other',
];

export const BOARD_OPTIONS = [
  'Lahore Board',
  'Gujranwala Board',
  'Multan Board',
  'Faisalabad Board',
  'AJK Board',
  'Sargodha Board',
  'Sahiwal Board',
  'Bahawalpur Board',
  'Rawalpindi Board',
  'Federal Board',
  'Other',
  'Not Applicable / Prefer Not to Say',
];

export type DriveItemType = 'folder' | 'pdf' | 'audio' | 'image' | 'doc' | 'video' | 'other';

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  type: DriveItemType;
  parentId?: string;
  size?: number;
  modifiedTime?: string | number;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  itemCount?: number;
  categoryTag?: string;
  description?: string;
}

export interface DriveConfig {
  rootFolderId: string;
  rootFolderName: string;
  rootFolderUrl?: string;
  lastSyncedAt?: number;
  syncStatus?: 'synced' | 'syncing' | 'error' | 'idle';
}

export interface ArticleItem {
  id: string;
  title: string;
  description: string;
  coverImage: string; // Mandatory image data url or web link
  content: string; // Formatted rich content (HTML / formatted text with bold, italic, underline, highlight, etc.)
  category: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorPhotoURL?: string;
  authorProfessionalTitle?: string;
  authorQualification?: string;
  authorBio?: string;
  readTimeMinutes: number;
  likesCount?: number;
  likedBy?: string[];
  viewsCount?: number;
  createdAt: number; // millisecond timestamp
  updatedAt: number; // millisecond timestamp
}

export interface PlatformReviewItem {
  id: string;
  studentId?: string;
  studentName: string;
  studentEmail?: string;
  studentQualification: string;
  studentBoard?: string;
  studentAvatarUrl?: string;
  rating: number; // 1 - 5
  ratingFeedback: string;
  ratingTags?: string[];
  categoryName?: string;
  expertName?: string;
  status: 'active';
  createdAt: number; // millisecond timestamp
}
