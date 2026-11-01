import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function credDocId(email: string): string {
  return 'cred_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export const ALL_17_ADMINS = [
  // 1. Super Admin
  {
    name: 'Hamza Saif',
    email: 'mentoflux@gmail.com',
    password: 'Hamza@admin1',
    role: 'super_admin' as const,
    professionalTitle: 'Senior Mentor',
    description: 'Professional in handling queries related to FSc, Board Policies, CA, and general educational and career guidance.',
    uid: 'admin_hamza_saif',
  },
  // 2. Expert Admin
  {
    name: 'Huzaifa Khalil Ahmed',
    email: 'huzaifa678ops@gmail.com',
    password: 'Huzaifa@admin2',
    role: 'expert_admin' as const,
    professionalTitle: 'Senior Mentor',
    description: 'CA Student (ICAP, CAF). Provides guidance related to CA, ACCA, university admissions, and general career planning.',
    uid: 'admin_huzaifa_khalil',
  },
  // 3. Admin 3
  {
    name: 'Muhammad Talha',
    email: 'talhashahidmzg@gmail.com',
    password: 'Talha@admin3',
    role: 'normal_admin' as const,
    professionalTitle: 'DVM & Student Mentor',
    description: 'DVM student currently in the 7th semester. Provides guidance related to veterinary sciences, DVM admissions, career opportunities, student motivation, and general Islamic guidance.',
    uid: 'admin_muhammad_talha',
  },
  // 4. Admin 4
  {
    name: 'Muhammad Baksh',
    email: 'fscstudysquad@gmail.com',
    password: 'Baksh@admin4',
    role: 'normal_admin' as const,
    professionalTitle: 'Computing & Communication Mentor',
    description: 'BS Computer Science student at KFUEIT. Microsoft-certified professional with experience in spoken English teaching, personality development, digital marketing, content creation, content writing, AI prompt engineering, and beginner-level web development. Provides guidance related to computing and law.',
    uid: 'admin_muhammad_baksh',
  },
  // 5. Admin 5
  {
    name: 'Haly Noor',
    email: 'halynoor001a@gmail.com',
    password: 'Haly@admin5',
    role: 'normal_admin' as const,
    professionalTitle: 'DPT Mentor',
    description: 'Physiotherapy and MDCAT mentor. Provides guidance related to DPT, MDCAT preparation, university admissions, and healthcare career options.',
    uid: 'admin_haly_noor',
  },
  // 6. Admin 6
  {
    name: 'Hamna Zainab',
    email: 'zainabhamna276@gmail.com',
    password: 'Hamna@admin6',
    role: 'normal_admin' as const,
    professionalTitle: 'Law & Public Speaking Mentor',
    description: 'Provides guidance related to LLB admissions, LAT, GAT, debating, declamation, Model United Nations (MUN), parliamentary debates, university societies, and extracurricular activities.',
    uid: 'admin_hamna_zainab',
  },
  // 7. Admin 7
  {
    name: 'Umair Gul Khan',
    email: 'umairgulkhan711@gmail.com',
    password: 'Umair@admin7',
    role: 'normal_admin' as const,
    professionalTitle: 'Engineering & Competitive Exams Mentor',
    description: 'Chemical Engineer providing guidance related to engineering degrees, internships, career opportunities, CSS, PMS, FPSC, KPPSC, PPSC, and government recruitment examinations.',
    uid: 'admin_umair_gul',
  },
  // 8. Admin 8
  {
    name: 'Aliya Athar',
    email: 'aliyaathar07@gmail.com',
    password: 'Aliya@admin8',
    role: 'normal_admin' as const,
    professionalTitle: 'Optometry & Allied Health Mentor',
    description: 'Third-year BS Optometry student at COAVS, KEMU. Provides guidance related to Optometry, Allied Health Sciences, KEMU admissions, eligibility criteria, and healthcare career pathways.',
    uid: 'admin_aliya_athar',
  },
  // 9. Admin 9
  {
    name: 'NaCl',
    email: 'a33115500@gmail.com',
    password: 'Nacl@admin9',
    role: 'normal_admin' as const,
    professionalTitle: 'CA & Cardiac Perfusion Mentor',
    description: 'CA student providing guidance related to CA studies, Cardiac Perfusion, relevant degree pathways, admissions, and career options.',
    uid: 'admin_nacl',
  },
  // 10. Admin 10
  {
    name: 'Ayesha',
    email: 'abmansha732@gmail.com',
    password: 'Ayesha@admin10',
    role: 'normal_admin' as const,
    professionalTitle: 'Pharm-D & Digital Media Mentor',
    description: 'First-semester Pharm-D student at Punjab University. Provides guidance related to Pharm-D, pharmacy career options, social media management, group discussion preparation, and video editing.',
    uid: 'admin_ayesha',
  },
  // 11. Admin 11
  {
    name: 'Muhammad Ali Munir',
    email: 'malimunir18@gmail.com',
    password: 'AliMunir@admin11',
    role: 'normal_admin' as const,
    professionalTitle: 'IT, ECAT & Scholarships Mentor',
    description: 'Provides guidance related to IT degree options, ECAT preparation, university admissions, and international scholarships.',
    uid: 'admin_muhammad_ali_munir',
  },
  // 12. Admin 12
  {
    name: 'Ali Atif',
    email: 'dralitiff@gmail.com',
    password: 'AliAtif@admin12',
    role: 'normal_admin' as const,
    professionalTitle: 'AI & Technology Mentor',
    description: 'Provides guidance related to Artificial Intelligence, emerging technologies, relevant degree programs, and technology career opportunities.',
    uid: 'admin_ali_atif',
  },
  // 13. Admin 13
  {
    name: 'K.E',
    email: 'kanzulemansultana@gmail.com',
    password: 'Kanzul@admin13',
    role: 'normal_admin' as const,
    professionalTitle: 'Scholarships & Channel Coordinator',
    description: 'Supports students through scholarship updates, scholarship-related posts, educational channel management, and information about study opportunities abroad.',
    uid: 'admin_ke',
  },
  // 14. Admin 14
  {
    name: 'Aqsa Javed',
    email: 'aqsajaved860@gmail.com',
    password: 'Aqsa@admin14',
    role: 'normal_admin' as const,
    professionalTitle: 'Psychology & Career Guidance Mentor',
    description: 'BS Psychology student providing guidance related to psychology degrees, psychology career pathways, educational choices, and student wellbeing.',
    uid: 'admin_aqsa_javed',
  },
  // 15. Admin 15
  {
    name: 'Muhammad Abdullah Iftikhar',
    email: 'iftikharabdullah315@gmail.com',
    password: 'Abdullah@admin15',
    role: 'normal_admin' as const,
    professionalTitle: 'IT & Allied Health Sciences Mentor',
    description: 'Data Science student with an Intermediate Pre-Medical background. Provides guidance related to university selection, CS, SE, DS, Cyber Security, AI, DPT, MIT, MLT, BSN, and entry tests.',
    uid: 'admin_abdullah_iftikhar',
  },
  // 16. Admin 16
  {
    name: 'Anees Ahmad',
    email: 'aneesahmadsargodha@gmail.com',
    password: 'Anees@admin16',
    role: 'normal_admin' as const,
    professionalTitle: 'Medical Laboratory Sciences Mentor',
    description: 'BS Pathology student at Sargodha Medical College, University of Sargodha, and trainee lab technologist at Rai Medical Complex and Teaching Hospital. Provides guidance related to Pathology, Microbiology, MLT, DMLS, Biochemistry, Molecular Biology, and MLT internships.',
    uid: 'admin_anees_ahmad',
  },
  // 17. Admin 17
  {
    name: 'Suraiz Tahir Bhatti',
    email: 'suraizbhatti94@gmail.com',
    password: 'Suraiz@admin17',
    role: 'normal_admin' as const,
    professionalTitle: 'Law & Career Guidance Mentor',
    description: 'Intermediate student providing guidance related to LLB, career counselling, IT-related study options, and educational pathways after Intermediate.',
    uid: 'admin_suraiz_bhatti',
  },
  // 18. Admin 18
  {
    name: 'Bint-e-Iqbal',
    email: 'abuiqbal0926@gmail.com',
    password: 'BintIqbal@admin18',
    role: 'normal_admin' as const,
    professionalTitle: 'Pharm-D Mentor',
    description: 'Pharm-D 5th-year student providing guidance related to Pharm-D studies, pharmacy career opportunities, university admissions, and professional pathways in the pharmaceutical and healthcare sectors.',
    uid: 'admin_bint_e_iqbal',
  },
  // 19. Admin 19
  {
    name: 'Khurram Farooq',
    email: 'alphaboies2002@gmail.com',
    password: 'Khurram@admin19',
    role: 'normal_admin' as const,
    professionalTitle: 'Scholarships & Government Schemes Mentor',
    description: 'Scholarship and government schemes coordinator helping students discover government scholarship programs, merit-based and need-based financial aid, government laptop and electric bike schemes, eligibility criteria, application procedures, educational funding, and admission support opportunities.',
    uid: 'admin_khurram_farooq',
  },
  // 20. Admin 20
  {
    name: 'GrammLogic Ma\'am',
    email: 'grammlogic@gmail.com',
    password: 'GrammLogic@admin20',
    role: 'normal_admin' as const,
    professionalTitle: 'English & Communication Mentor',
    description: 'English language and communication mentor who transitioned from the field of MBBS to building a career through English teaching and communication skills. Helps students improve English proficiency, communication skills, and academic confidence. Provides guidance related to AFNS, CSS, BS English, communication skills, and educational and career choices.',
    uid: 'admin_grammlogic',
  },
  // 21. Admin 21
  {
    name: 'Laiba Yousaf',
    email: 'laibayousaff35@gmail.com',
    password: 'Laiba@admin21',
    role: 'normal_admin' as const,
    professionalTitle: 'ACCA & AFNS Mentor',
    description: 'ACCA student currently preparing four papers, with selection in the 2024–2025 AFNS session. Provides guidance related to ACCA studies, exam preparation, AFNS selection, eligibility requirements, application procedures, and relevant career pathways.',
    uid: 'admin_laiba_yousaf',
  },
];

const INITIAL_CATEGORIES = [
  {
    id: 'cat-fsc-boards',
    name: 'FSc & Board Policies',
    description: 'Guidance on BISE examinations, board migration, improvement rules, and intermediate academic tracks.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_hamza_saif', 'admin_suraiz_bhatti'],
  },
  {
    id: 'cat-ca-commerce',
    name: 'Chartered Accountancy & Commerce (ICAP / ACCA)',
    description: 'Guidance on CA entry requirements, CAF pathways, articleship, and finance certifications.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_hamza_saif', 'admin_huzaifa_khalil', 'admin_nacl'],
  },
  {
    id: 'cat-dvm',
    name: 'Veterinary Sciences (DVM)',
    description: 'Admissions, eligibility, clinical rotations, and careers in veterinary sciences and animal husbandry.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_muhammad_talha'],
  },
  {
    id: 'cat-cs-it',
    name: 'Computer Science, Software & IT Degrees',
    description: 'BS CS / SE admissions, software development, AI tools, certifications, and communication skills.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_muhammad_baksh', 'admin_muhammad_ali_munir', 'admin_abdullah_iftikhar'],
  },
  {
    id: 'cat-ai-tech',
    name: 'Artificial Intelligence & Emerging Technologies',
    description: 'AI degree programs, machine learning roadmaps, emerging tech certifications, and tech career opportunities.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_ali_atif', 'admin_muhammad_baksh', 'admin_abdullah_iftikhar'],
  },
  {
    id: 'cat-dpt-mdcat',
    name: 'DPT & MDCAT Health Sciences',
    description: 'Doctor of Physical Therapy pathways, MDCAT strategy, aggregate cutoffs, and hospital careers.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_haly_noor', 'admin_abdullah_iftikhar'],
  },
  {
    id: 'cat-pharm-d',
    name: 'Pharm-D & Pharmacy Careers',
    description: 'Punjab University & national Pharm-D admissions, clinical pharmacy, hospital rotations, and social media/communication skills.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_ayesha'],
  },
  {
    id: 'cat-law-debates',
    name: 'Law (LLB / LAT / GAT) & Public Speaking',
    description: 'LLB university admissions, LAT preparation, parliamentary debating, MUN, and legal careers.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_hamna_zainab', 'admin_suraiz_bhatti'],
  },
  {
    id: 'cat-engineering-gov',
    name: 'Engineering & Competitive Civil Exams (CSS / PMS / FPSC)',
    description: 'Chemical & General Engineering tracks, industrial internships, CSS/PMS syllabus, and competitive examinations.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_umair_gul'],
  },
  {
    id: 'cat-optometry-kemu',
    name: 'Optometry & Allied Health Sciences (KEMU)',
    description: 'COAVS / King Edward Medical University admissions, Allied Health Sciences, and hospital practice.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_aliya_athar'],
  },
  {
    id: 'cat-cardiac-perfusion',
    name: 'Cardiac Perfusion & Healthcare Pathways',
    description: 'Cardiac perfusion technology degrees, specialized surgical equipment training, and healthcare careers.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_nacl'],
  },
  {
    id: 'cat-pathology-mlt',
    name: 'Pathology & Medical Laboratory Sciences (MLT / DMLS)',
    description: 'BS Pathology, Microbiology, MLT internships, Biochemistry, and hospital laboratory technology.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_anees_ahmad'],
  },
  {
    id: 'cat-scholarships-abroad',
    name: 'Scholarships, ECAT & Study Abroad Opportunities',
    description: 'International scholarship portals, ECAT guidance, university selection, and application preparation.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_muhammad_ali_munir', 'admin_ke'],
  },
  {
    id: 'cat-psychology',
    name: 'Psychology, Counseling & Student Wellbeing',
    description: 'BS Psychology admissions, clinical vs organizational psychology tracks, and student mental health guidance.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_aqsa_javed'],
  },
  {
    id: 'cat-career-counselling',
    name: 'Post-Intermediate & General Career Counselling',
    description: 'Navigating study options after FSc/FA/ICS, degree selection strategies, and interdisciplinary career switches.',
    allowedRoles: ['super_admin', 'expert_admin', 'normal_admin'],
    assignedExpertIds: ['admin_suraiz_bhatti', 'admin_hamza_saif', 'admin_huzaifa_khalil'],
  },
];

async function clearCollection(name: string) {
  console.log(`Clearing collection: ${name}...`);
  try {
    const snap = await getDocs(collection(db, name));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, name, d.id));
    }
    console.log(`  Cleared ${snap.docs.length} docs from ${name}.`);
  } catch (err: any) {
    console.warn(`  Warning while clearing ${name}:`, err.message);
  }
}

async function main() {
  console.log('=== Career Code: Clearing existing data and seeding all 17 designated accounts ===');

  // Clear existing users, credentials, admins, queries, messages
  await clearCollection('credentials');
  await clearCollection('users');
  await clearCollection('admins');
  await clearCollection('queries');
  await clearCollection('messages');
  await clearCollection('notifications');

  // Seed Categories
  console.log('Seeding updated categories...');
  for (const cat of INITIAL_CATEGORIES) {
    await setDoc(doc(db, 'categories', cat.id), cat);
  }

  // Seed All 17 Designated Admins
  const now = Date.now();
  console.log('Seeding all 17 designated administrator accounts...');

  for (const admin of ALL_17_ADMINS) {
    const cleanEmail = admin.email.toLowerCase().trim();
    const cId = credDocId(cleanEmail);
    const { hash, salt } = hashPassword(admin.password);

    // 1. Credentials
    await setDoc(doc(db, 'credentials', cId), {
      uid: admin.uid,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role: admin.role,
      displayName: admin.name,
      createdAt: now,
      updatedAt: now,
    });

    // Determine assigned categories for this mentor
    const userCategories = INITIAL_CATEGORIES.filter((c) =>
      c.assignedExpertIds.includes(admin.uid)
    ).map((c) => c.id);

    // 2. Users profile
    await setDoc(doc(db, 'users', admin.uid), {
      uid: admin.uid,
      email: cleanEmail,
      displayName: admin.name,
      role: admin.role,
      professionalTitle: admin.professionalTitle,
      shortDescription: admin.description,
      phoneNumber: '+92 300 1234567',
      assignedCategories: userCategories.length > 0 ? userCategories : ['cat-fsc-boards'],
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
    });

    // 3. Admins collection for fast role lookup & security rules
    await setDoc(doc(db, 'admins', admin.uid), {
      role: admin.role,
      email: cleanEmail,
      displayName: admin.name,
    });

    console.log(`  ✓ Created [${admin.role.toUpperCase()}] ${admin.name} (${admin.email})`);
  }

  // Also seed a demo student account for quick testing if needed
  const demoStudentEmail = 'student@preptitans.com';
  const demoStudentPass = 'Student@123';
  const { hash: stuHash, salt: stuSalt } = hashPassword(demoStudentPass);
  const stuCredId = credDocId(demoStudentEmail);
  const stuUid = 'demo_student_ali';

  await setDoc(doc(db, 'credentials', stuCredId), {
    uid: stuUid,
    email: demoStudentEmail,
    passwordHash: stuHash,
    salt: stuSalt,
    role: 'student',
    displayName: 'Ali Raza',
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, 'users', stuUid), {
    uid: stuUid,
    email: demoStudentEmail,
    displayName: 'Ali Raza',
    role: 'student',
    qualification: 'Intermediate / FSc',
    qualificationDetail: 'Pre-Medical (1020 Marks)',
    board: 'Lahore Board',
    phoneNumber: '+92 321 9876543',
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  });

  console.log(`  ✓ Created Student: Ali Raza (${demoStudentEmail} / ${demoStudentPass})`);

  console.log('\n=== All 17 Designated Admins and Data Seeded Successfully! ===');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
