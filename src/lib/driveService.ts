import { DriveItem, DriveItemType, DriveConfig } from '../types';

export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  return trimmed;
}

export function detectItemType(mimeType: string, name: string): DriveItemType {
  const lowerName = name.toLowerCase();
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('audio') || lowerName.endsWith('.mp3') || lowerName.endsWith('.m4a') || lowerName.endsWith('.wav') || lowerName.endsWith('.ogg')) return 'audio';
  if (mimeType.includes('image') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'doc';
  if (mimeType.includes('video') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv')) return 'video';
  return 'other';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Built-in Seeded Guidance Library mapped to Career Code's Disciplines
export const SEED_DRIVE_ROOT_ID = 'root_career_code_vault';

export const SEEDED_DRIVE_ITEMS: DriveItem[] = [
  // 1. Top-Level Discipline Folders (General at top!)
  {
    id: 'folder-general-guidance',
    name: 'General Guidance & Roadmaps',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 4,
    categoryTag: 'General Guidance',
    webViewLink: 'https://drive.google.com/drive/folders/folder-general-guidance',
    description: 'Post-intermediate career roadmaps, degree switching strategies, and university selection.',
  },
  {
    id: 'folder-ca-acca',
    name: 'CA & ACCA Resources',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 4,
    categoryTag: 'CA/ACCA',
    webViewLink: 'https://drive.google.com/drive/folders/folder-ca-acca',
    description: 'ICAP CAF exam prep, training induction, ACCA paper exemption charts, and salary scales.',
  },
  {
    id: 'folder-cs-it',
    name: 'CS, IT & AI Guides',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 4,
    categoryTag: 'CS/IT',
    webViewLink: 'https://drive.google.com/drive/folders/folder-cs-it',
    description: 'Degree selection (CS vs SE vs AI vs DS), coding roadmaps, and FAST/NUST/PUCIT merit guides.',
  },
  {
    id: 'folder-engineering',
    name: 'Engineering & ECAT',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 4,
    categoryTag: 'Engineering',
    webViewLink: 'https://drive.google.com/drive/folders/folder-engineering',
    description: 'ECAT aggregate formula, past papers, UET/NUST/GIKI admissions, and branch scopes.',
  },
  {
    id: 'folder-mdcat',
    name: 'MDCAT & Medical',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 4,
    categoryTag: 'MDCAT',
    webViewLink: 'https://drive.google.com/drive/folders/folder-mdcat',
    description: 'PMDC syllabus, public/private medical colleges merit trends, and backup career paths.',
  },
  {
    id: 'folder-dvm',
    name: 'DVM (Veterinary Medicine)',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 3,
    categoryTag: 'DVM',
    webViewLink: 'https://drive.google.com/drive/folders/folder-dvm',
    description: 'UVAS admissions, clinical rotations, animal nutrition, and international licensing guides.',
  },
  {
    id: 'folder-law',
    name: 'Law & LLB Guidance',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 3,
    categoryTag: 'Law/LLB',
    webViewLink: 'https://drive.google.com/drive/folders/folder-law',
    description: 'LAT test preparation, Punjab University Law College merits, and judicial services prep.',
  },
  {
    id: 'folder-scholarships',
    name: 'Scholarships & Schemes',
    mimeType: 'application/vnd.google-apps.folder',
    type: 'folder',
    parentId: SEED_DRIVE_ROOT_ID,
    itemCount: 3,
    categoryTag: 'Scholarships & Government Schemes',
    webViewLink: 'https://drive.google.com/drive/folders/folder-scholarships',
    description: 'HEC need-based aid, PEEF scholarships, Punjab government laptop and electric bike guidelines.',
  },

  // 2. Files Inside General Guidance
  {
    id: 'file-gen-1',
    name: 'Career Code - Master Academic Roadmap 2026.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-general-guidance',
    size: 2450000,
    categoryTag: 'General Guidance',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Comprehensive 40-page guide comparing 50+ bachelor degree programs across Pakistan.',
  },
  {
    id: 'file-gen-2',
    name: 'University Selection Decision Matrix.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-general-guidance',
    size: 1180000,
    categoryTag: 'General Guidance',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Evaluation criteria: HEC ranking, faculty qualification, fee affordability, and campus placement.',
  },
  {
    id: 'file-gen-3',
    name: 'Mentor Audio - Handling Admission Stress & Career Selection.mp3',
    mimeType: 'audio/mpeg',
    type: 'audio',
    parentId: 'folder-general-guidance',
    size: 3200000,
    categoryTag: 'General Guidance',
    webViewLink: 'https://drive.google.com/file/d/1kG3q9jV_audio_mentor_advice/view',
    description: 'Career Code Counselor briefing on managing merit list pressure and alternatives.',
  },
  {
    id: 'file-gen-4',
    name: 'Degree Switching & Equivalent Equivalence Chart.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-general-guidance',
    size: 890000,
    categoryTag: 'General Guidance',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Switching from Pre-Medical to Computing/Commerce guidelines and IBCC rules.',
  },

  // 3. Files Inside CA/ACCA
  {
    id: 'file-ca-1',
    name: 'ICAP CAF Complete Study & Exam Plan 2026.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-ca-acca',
    size: 1950000,
    categoryTag: 'CA/ACCA',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Group A & Group B paper combinations, recommended teachers, and practice test schedule.',
  },
  {
    id: 'file-ca-2',
    name: 'CA Articleship Induction Manual - Big 4 & Mid-Tier Firms.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-ca-acca',
    size: 2100000,
    categoryTag: 'CA/ACCA',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'CV preparation, assessment test questions, and interview tips for AF Ferguson, KPMG, EY, and PwC.',
  },
  {
    id: 'file-ca-3',
    name: 'Counselor Voice Note - CA vs ACCA Pros & Cons.mp3',
    mimeType: 'audio/mpeg',
    type: 'audio',
    parentId: 'folder-ca-acca',
    size: 4100000,
    categoryTag: 'CA/ACCA',
    webViewLink: 'https://drive.google.com/file/d/1kG3q9jV_audio_ca_acca/view',
    description: 'Hamza Saif guidance on international mobility, pass rates, and corporate acceptance.',
  },
  {
    id: 'file-ca-4',
    name: 'ACCA Paper Exemptions & Fast-Track Route Chart.png',
    mimeType: 'image/png',
    type: 'image',
    parentId: 'folder-ca-acca',
    size: 780000,
    categoryTag: 'CA/ACCA',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Visual diagram of applied knowledge, applied skills, and strategic professional levels.',
  },

  // 4. Files Inside CS/IT
  {
    id: 'file-cs-1',
    name: 'CS vs Software Engineering vs Artificial Intelligence.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-cs-it',
    size: 1750000,
    categoryTag: 'CS/IT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Course curriculum breakdown, industry demand, and job opportunities for each tech specialization.',
  },
  {
    id: 'file-cs-2',
    name: 'Top 15 Computing Universities in Pakistan & Closing Merits.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-cs-it',
    size: 2300000,
    categoryTag: 'CS/IT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'FAST, NUST, PUCIT, ITU, COMSATS, GIKI merit criteria and test syllabus.',
  },
  {
    id: 'file-cs-3',
    name: 'First Year Tech Student Skill Roadmap.png',
    mimeType: 'image/png',
    type: 'image',
    parentId: 'folder-cs-it',
    size: 1100000,
    categoryTag: 'CS/IT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Semester-by-semester programming roadmap: C++, OOP, Data Structures, and Web/App stacks.',
  },
  {
    id: 'file-cs-4',
    name: 'Counselor Voice Note - Preparing for FAST Entry Test.mp3',
    mimeType: 'audio/mpeg',
    type: 'audio',
    parentId: 'folder-cs-it',
    size: 3800000,
    categoryTag: 'CS/IT',
    webViewLink: 'https://drive.google.com/file/d/1kG3q9jV_audio_fast_prep/view',
    description: 'Tips for solving advanced mathematics, analytical reasoning, and negative marking strategy.',
  },

  // 5. Files Inside Engineering
  {
    id: 'file-eng-1',
    name: 'ECAT Syllabus Breakdown & Past Papers 2021-2025.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-engineering',
    size: 4200000,
    categoryTag: 'Engineering',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Official UET ECAT syllabus, weighted aggregate calculator, and topic-wise questions.',
  },
  {
    id: 'file-eng-2',
    name: 'UET Lahore & Sub-Campuses Closing Merit Trends.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-engineering',
    size: 1450000,
    categoryTag: 'Engineering',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Electrical, Mechanical, Chemical, Civil, and Mechatronics merit history.',
  },
  {
    id: 'file-eng-3',
    name: 'Counselor Voice Note - GIKI & NUST NET Strategy.mp3',
    mimeType: 'audio/mpeg',
    type: 'audio',
    parentId: 'folder-engineering',
    size: 2900000,
    categoryTag: 'Engineering',
    webViewLink: 'https://drive.google.com/file/d/1kG3q9jV_audio_net_tips/view',
    description: 'Umair Gul on time distribution between Physics, Mathematics, and Chemistry.',
  },
  {
    id: 'file-eng-4',
    name: 'Engineering Disciplines Scope & Career Opportunities.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-engineering',
    size: 1800000,
    categoryTag: 'Engineering',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Market demand in Pakistan, GCC countries, and multinational engineering consultancy.',
  },

  // 6. Files Inside MDCAT
  {
    id: 'file-med-1',
    name: 'PMDC MDCAT Official Syllabus & Core Topics.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-mdcat',
    size: 2700000,
    categoryTag: 'MDCAT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Detailed topic breakdown for Biology, Chemistry, Physics, and English/Logical reasoning.',
  },
  {
    id: 'file-med-2',
    name: 'Punjab Public Medical Colleges Merit Lists & UHS Quotas.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-mdcat',
    size: 1650000,
    categoryTag: 'MDCAT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'King Edward, Allama Iqbal, Services, Nishtar, and Rawalpindi Medical University past closing merits.',
  },
  {
    id: 'file-med-3',
    name: 'Counselor Voice Note - Backup Options If Not Selected in MBBS.mp3',
    mimeType: 'audio/mpeg',
    type: 'audio',
    parentId: 'folder-mdcat',
    size: 4500000,
    categoryTag: 'MDCAT',
    webViewLink: 'https://drive.google.com/file/d/1kG3q9jV_audio_mbbs_backups/view',
    description: 'Haly Noor guidance on BDS, DPT, Pharm-D, DVM, and Allied Health Sciences.',
  },
  {
    id: 'file-med-4',
    name: 'MDCAT Aggregate Calculator Formula & UHS Criteria.png',
    mimeType: 'image/png',
    type: 'image',
    parentId: 'folder-mdcat',
    size: 850000,
    categoryTag: 'MDCAT',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Official 50% MDCAT + 40% FSc + 10% Matric weightage calculation graphic.',
  },

  // 7. Files Inside Scholarships
  {
    id: 'file-sch-1',
    name: 'HEC Need-Based & Ehsaas Scholarship Application Form & Guide.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-scholarships',
    size: 2100000,
    categoryTag: 'Scholarships & Government Schemes',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Step-by-step document verification, utility bill requirements, and interview questions.',
  },
  {
    id: 'file-sch-2',
    name: 'Punjab Government Laptop & Electric Bike Scheme 2026.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-scholarships',
    size: 1300000,
    categoryTag: 'Scholarships & Government Schemes',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Eligibility criteria, CGPA cutoff, quota distributions, and delivery tracking.',
  },
  {
    id: 'file-sch-3',
    name: 'International Fully-Funded Undergraduate Scholarships Directory.pdf',
    mimeType: 'application/pdf',
    type: 'pdf',
    parentId: 'folder-scholarships',
    size: 3400000,
    categoryTag: 'Scholarships & Government Schemes',
    webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    description: 'Turkiye Burslari, MEXT Japan, Chinese CSC, and Hungarian Stipendium Hungaricum roadmaps.',
  },
];

export async function fetchDriveFolderContents(
  folderId: string = SEED_DRIVE_ROOT_ID,
  isManualRefresh = false
): Promise<{
  items: DriveItem[];
  folderName: string;
  source: 'google_drive' | 'cached_vault';
}> {
  try {
    const res = await fetch(
      `/api/drive/folder-contents?folderId=${encodeURIComponent(folderId)}${
        isManualRefresh ? '&refresh=true' : ''
      }`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.items)) {
        if (data.source === 'google_drive' || data.items.length > 0) {
          return {
            items: data.items,
            folderName: data.folderName || 'Career Code Drive',
            source: 'google_drive',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[driveService] Server fetch failed:', err);
  }

  // Only fall back to local demo items if folder is the mock demo placeholder
  if (folderId === SEED_DRIVE_ROOT_ID || folderId.startsWith('folder-')) {
    const items = SEEDED_DRIVE_ITEMS.filter((item) => {
      if (folderId === SEED_DRIVE_ROOT_ID || !folderId) {
        return item.parentId === SEED_DRIVE_ROOT_ID || !item.parentId;
      }
      return item.parentId === folderId;
    });

    const parentFolder = SEEDED_DRIVE_ITEMS.find((f) => f.id === folderId);
    return {
      items,
      folderName: parentFolder ? parentFolder.name : 'Career Code Knowledge Base',
      source: 'cached_vault',
    };
  }

  return {
    items: [],
    folderName: 'Career Code Drive',
    source: 'google_drive',
  };
}

export async function getDriveConfig(): Promise<DriveConfig> {
  try {
    const res = await fetch('/api/drive/config');
    if (res.ok) {
      const data = await res.json();
      if (data.config) return data.config;
    }
  } catch (err) {
    console.warn('[driveService] Could not fetch drive config from server:', err);
  }

  return {
    rootFolderId: SEED_DRIVE_ROOT_ID,
    rootFolderName: 'Career Code Knowledge Base',
    rootFolderUrl: 'https://drive.google.com/drive/folders/career_code_resources',
    lastSyncedAt: Date.now(),
    syncStatus: 'synced',
  };
}

export async function updateDriveConfig(config: Partial<DriveConfig>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/drive/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update Drive configuration.' };
  }
}
