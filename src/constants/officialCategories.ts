export interface OfficialCategoryConfig {
  id: string;
  name: string;
  description: string;
  assignedAdminIds: string[];
  primaryAdminId: string;
}

/**
 * Standard category sorter:
 * Places 'General' / 'General Guidance' at the very top (first item),
 * followed by all other academic & career disciplines in strict alphabetical order (A-Z).
 */
export function sortCategoriesGeneralFirst<T extends { name?: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const aName = (a.name || '').trim();
    const bName = (b.name || '').trim();
    const aIsGeneral = aName.toLowerCase().startsWith('general') || aName.toLowerCase().includes('general guidance');
    const bIsGeneral = bName.toLowerCase().startsWith('general') || bName.toLowerCase().includes('general guidance');
    if (aIsGeneral && !bIsGeneral) return -1;
    if (!aIsGeneral && bIsGeneral) return 1;
    return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
  });
}

export const OFFICIAL_23_CATEGORIES: OfficialCategoryConfig[] = [
  {
    id: 'cat-general-guidance',
    name: 'General Guidance',
    description: 'General post-intermediate academic counselling, degree switching, student motivation, and educational pathways.',
    assignedAdminIds: [
      'admin_muhammad_talha',
      'admin_aqsa_javed',
      'admin_suraiz_bhatti',
    ],
    primaryAdminId: 'admin_muhammad_talha',
  },
  {
    id: 'cat-admissions',
    name: 'Admissions',
    description: 'Comprehensive university admissions guidance, closing merit lists, eligibility rules, and document processing.',
    assignedAdminIds: [
      'admin_muhammad_ali_munir',
      'admin_aliya_athar',
      'admin_abdullah_iftikhar',
      'admin_suraiz_bhatti',
    ],
    primaryAdminId: 'admin_muhammad_ali_munir',
  },
  {
    id: 'cat-ai',
    name: 'AI',
    description: 'Artificial Intelligence, Machine Learning, Data Science degrees, emerging tech, and career pathways.',
    assignedAdminIds: ['admin_muhammad_baksh', 'admin_ali_atif'],
    primaryAdminId: 'admin_ali_atif',
  },
  {
    id: 'cat-allied-health',
    name: 'Allied Health',
    description: 'Allied Health Sciences degree programs (MIT, MLT, BSN, Ott, etc.), eligibility criteria, and careers.',
    assignedAdminIds: ['admin_aliya_athar', 'admin_abdullah_iftikhar'],
    primaryAdminId: 'admin_aliya_athar',
  },
  {
    id: 'cat-ca-acca',
    name: 'CA/ACCA',
    description: 'Chartered Accountancy (ICAP CAF/CFAP) & ACCA pathways, exam prep, and finance career mentoring.',
    assignedAdminIds: ['admin_hamza_saif', 'admin_huzaifa_khalil', 'admin_nacl', 'admin_laiba_yousaf'],
    primaryAdminId: 'admin_hamza_saif',
  },
  {
    id: 'cat-cardiac-perfusion',
    name: 'Cardiac Perfusion',
    description: 'Cardiac Perfusion Technology programs, specialized heart-lung machine clinical training, and hospital roles.',
    assignedAdminIds: ['admin_nacl'],
    primaryAdminId: 'admin_nacl',
  },
  {
    id: 'cat-cs-it',
    name: 'CS/IT',
    description: 'Computer Science, Software Engineering, IT degree selection, programming roadmaps, and tech careers.',
    assignedAdminIds: ['admin_muhammad_baksh', 'admin_abdullah_iftikhar'],
    primaryAdminId: 'admin_muhammad_baksh',
  },
  {
    id: 'cat-css-pms',
    name: 'CSS/PMS',
    description: 'Competitive civil service exams, CSS/PMS preparation strategy, syllabus breakdown, and interview tips.',
    assignedAdminIds: ['admin_umair_gul'],
    primaryAdminId: 'admin_umair_gul',
  },
  {
    id: 'cat-debates-mun',
    name: 'Debates/MUN',
    description: 'Parliamentary debates, declamations, Model United Nations (MUN), public speaking, and collegiate society activities.',
    assignedAdminIds: ['admin_hamna_zainab'],
    primaryAdminId: 'admin_hamna_zainab',
  },
  {
    id: 'cat-digital-media',
    name: 'Digital Media',
    description: 'Social media management, digital marketing, content writing, video editing, and modern digital career guidance.',
    assignedAdminIds: ['admin_muhammad_baksh', 'admin_ayesha'],
    primaryAdminId: 'admin_ayesha',
  },
  {
    id: 'cat-dpt',
    name: 'DPT',
    description: 'Doctor of Physical Therapy admissions, physiotherapy curricula, clinical training, and hospital practice.',
    assignedAdminIds: ['admin_haly_noor'],
    primaryAdminId: 'admin_haly_noor',
  },
  {
    id: 'cat-dvm',
    name: 'DVM',
    description: 'Doctor of Veterinary Medicine admissions, clinical rotations, animal health sciences, and career opportunities.',
    assignedAdminIds: ['admin_muhammad_talha'],
    primaryAdminId: 'admin_muhammad_talha',
  },
  {
    id: 'cat-ecat',
    name: 'ECAT',
    description: 'Engineering College Admission Test (ECAT) preparation, UET eligibility, past papers, and aggregate calculation.',
    assignedAdminIds: ['admin_muhammad_ali_munir', 'admin_umair_gul'],
    primaryAdminId: 'admin_muhammad_ali_munir',
  },
  {
    id: 'cat-engineering',
    name: 'Engineering',
    description: 'Chemical, Mechanical, Electrical, Civil Engineering degree pathways, admissions, and engineering careers.',
    assignedAdminIds: ['admin_umair_gul'],
    primaryAdminId: 'admin_umair_gul',
  },
  {
    id: 'cat-english-communication',
    name: 'English/Communication',
    description: 'Spoken English, written communication, personality grooming, AFNS, CSS, BS English, and interview preparation.',
    assignedAdminIds: ['admin_grammlogic', 'admin_muhammad_baksh', 'admin_hamna_zainab'],
    primaryAdminId: 'admin_grammlogic',
  },
  {
    id: 'cat-law-llb',
    name: 'Law/LLB',
    description: 'LLB admissions, LAT/GAT preparation, legal profession pathways, and judicial career guidance.',
    assignedAdminIds: ['admin_hamna_zainab', 'admin_muhammad_baksh', 'admin_suraiz_bhatti'],
    primaryAdminId: 'admin_hamna_zainab',
  },
  {
    id: 'cat-mdcat',
    name: 'MDCAT',
    description: 'Medical & Dental College Admission Test (MDCAT) guidance, syllabus review, aggregate formula, and retake strategies.',
    assignedAdminIds: ['admin_haly_noor', 'admin_hamza_saif'],
    primaryAdminId: 'admin_haly_noor',
  },
  {
    id: 'cat-mlt-pathology',
    name: 'MLT/Pathology',
    description: 'Medical Laboratory Technology, Pathology, Microbiology, Biochemistry, and hospital lab internships.',
    assignedAdminIds: ['admin_anees_ahmad', 'admin_abdullah_iftikhar'],
    primaryAdminId: 'admin_anees_ahmad',
  },
  {
    id: 'cat-optometry',
    name: 'Optometry',
    description: 'BS Optometry admissions, King Edward Medical University / COAVS eligibility, and vision sciences careers.',
    assignedAdminIds: ['admin_aliya_athar'],
    primaryAdminId: 'admin_aliya_athar',
  },
  {
    id: 'cat-pharm-d',
    name: 'Pharm-D',
    description: 'Doctor of Pharmacy programs, Punjab University admissions, hospital & clinical pharmacy careers.',
    assignedAdminIds: ['admin_ayesha', 'admin_bint_e_iqbal'],
    primaryAdminId: 'admin_ayesha',
  },
  {
    id: 'cat-psychology',
    name: 'Psychology',
    description: 'BS Psychology degree pathways, clinical counseling, cognitive sciences, and student mental wellbeing.',
    assignedAdminIds: ['admin_aqsa_javed'],
    primaryAdminId: 'admin_aqsa_javed',
  },
  {
    id: 'cat-scholarships',
    name: 'Scholarships & Government Schemes',
    description: 'National and international scholarships, government laptop and electric bike schemes, merit and need-based financial aid.',
    assignedAdminIds: ['admin_khurram_farooq', 'admin_muhammad_ali_munir', 'admin_ke'],
    primaryAdminId: 'admin_khurram_farooq',
  },
  {
    id: 'cat-study-abroad',
    name: 'Study Abroad',
    description: 'International study opportunities, visa guidance, foreign university shortlisting, and entrance test assistance.',
    assignedAdminIds: ['admin_huzaifa_khalil', 'admin_ke', 'admin_muhammad_ali_munir'],
    primaryAdminId: 'admin_huzaifa_khalil',
  },
];
