export interface PublicMentorCategory {
  id: string;
  name: string;
  color?: string;
}

export interface PublicMentor {
  uid: string;
  displayName: string;
  professionalTitle: string;
  shortDescription: string;
  photoURL?: string;
  role: string;
  categories: PublicMentorCategory[];
  isFounder?: boolean;
  averageRating?: number;
  ratingCount?: number;
}

export interface SocialChannel {
  name: string;
  subtitle: string;
  handle: string;
  url: string;
  icon: 'youtube' | 'x' | 'instagram' | 'whatsapp';
  badge: string;
  color: string;
  accentBg: string;
}
