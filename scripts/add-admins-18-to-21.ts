import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
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

export const NEW_ADMINS = [
  {
    name: 'Bint-e-Iqbal',
    email: 'abuiqbal0926@gmail.com',
    password: 'BintIqbal@admin18',
    role: 'normal_admin' as const,
    professionalTitle: 'Pharm-D Mentor',
    description: 'Pharm-D 5th-year student providing guidance related to Pharm-D studies, pharmacy career opportunities, university admissions, and professional pathways in the pharmaceutical and healthcare sectors.',
    uid: 'admin_bint_e_iqbal',
    categories: ['cat-pharm-d'],
  },
  {
    name: 'Khurram Farooq',
    email: 'alphaboies2002@gmail.com',
    password: 'Khurram@admin19',
    role: 'normal_admin' as const,
    professionalTitle: 'Scholarships & Government Schemes Mentor',
    description: 'Scholarship and government schemes coordinator helping students discover government scholarship programs, merit-based and need-based financial aid, government laptop and electric bike schemes, eligibility criteria, application procedures, educational funding, and admission support opportunities.',
    uid: 'admin_khurram_farooq',
    categories: ['cat-scholarships'],
  },
  {
    name: 'GrammLogic Ma\'am',
    email: 'grammlogic@gmail.com',
    password: 'GrammLogic@admin20',
    role: 'normal_admin' as const,
    professionalTitle: 'English & Communication Mentor',
    description: 'English language and communication mentor who transitioned from the field of MBBS to building a career through English teaching and communication skills. Helps students improve English proficiency, communication skills, and academic confidence. Provides guidance related to AFNS, CSS, BS English, communication skills, and educational and career choices.',
    uid: 'admin_grammlogic',
    categories: ['cat-english-communication', 'cat-css-pms'],
  },
  {
    name: 'Laiba Yousaf',
    email: 'laibayousaff35@gmail.com',
    password: 'Laiba@admin21',
    role: 'normal_admin' as const,
    professionalTitle: 'ACCA & AFNS Mentor',
    description: 'ACCA student currently preparing four papers, with selection in the 2024–2025 AFNS session. Provides guidance related to ACCA studies, exam preparation, AFNS selection, eligibility requirements, application procedures, and relevant career pathways.',
    uid: 'admin_laiba_yousaf',
    categories: ['cat-ca-acca'],
  },
];

async function main() {
  console.log('=== Adding Admins 18 to 21 to Firestore ===');
  const now = Date.now();

  // 1. Ensure cat-scholarships exists in categories collection
  const scholarshipsCatRef = doc(db, 'categories', 'cat-scholarships');
  const catSnap = await getDoc(scholarshipsCatRef);
  if (!catSnap.exists()) {
    await setDoc(scholarshipsCatRef, {
      id: 'cat-scholarships',
      name: 'Scholarships & Government Schemes',
      description: 'Government scholarship programs, merit & need-based financial aid, laptop & e-bike schemes, application procedures, and educational funding.',
      assignedAdminIds: ['admin_khurram_farooq'],
      primaryAdminId: 'admin_khurram_farooq',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    console.log('  ✓ Created category: cat-scholarships (Scholarships & Government Schemes)');
  } else {
    await updateDoc(scholarshipsCatRef, {
      assignedAdminIds: arrayUnion('admin_khurram_farooq'),
      updatedAt: now,
    });
    console.log('  ✓ Updated cat-scholarships with admin_khurram_farooq');
  }

  // 2. Add admin_bint_e_iqbal to cat-pharm-d
  const pharmCatRef = doc(db, 'categories', 'cat-pharm-d');
  const pharmSnap = await getDoc(pharmCatRef);
  if (pharmSnap.exists()) {
    await updateDoc(pharmCatRef, {
      assignedAdminIds: arrayUnion('admin_bint_e_iqbal'),
      updatedAt: now,
    });
    console.log('  ✓ Assigned admin_bint_e_iqbal to cat-pharm-d');
  }

  // 3. Add admin_grammlogic to cat-english-communication
  const englishCatRef = doc(db, 'categories', 'cat-english-communication');
  const englishSnap = await getDoc(englishCatRef);
  if (englishSnap.exists()) {
    await updateDoc(englishCatRef, {
      assignedAdminIds: arrayUnion('admin_grammlogic'),
      updatedAt: now,
    });
    console.log('  ✓ Assigned admin_grammlogic to cat-english-communication');
  }

  // 4. Add admin_laiba_yousaf to cat-ca-acca
  const caCatRef = doc(db, 'categories', 'cat-ca-acca');
  const caSnap = await getDoc(caCatRef);
  if (caSnap.exists()) {
    await updateDoc(caCatRef, {
      assignedAdminIds: arrayUnion('admin_laiba_yousaf'),
      updatedAt: now,
    });
    console.log('  ✓ Assigned admin_laiba_yousaf to cat-ca-acca');
  }

  // 5. Create Credentials, Users, and Admins for each of the 4
  for (const admin of NEW_ADMINS) {
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

    // 2. Users profile
    await setDoc(doc(db, 'users', admin.uid), {
      uid: admin.uid,
      email: cleanEmail,
      displayName: admin.name,
      role: admin.role,
      professionalTitle: admin.professionalTitle,
      shortDescription: admin.description,
      phoneNumber: '+92 300 1234567',
      assignedCategories: admin.categories,
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
    });

    // 3. Admins collection
    await setDoc(doc(db, 'admins', admin.uid), {
      role: admin.role,
      email: cleanEmail,
      displayName: admin.name,
    });

    console.log(`  ✓ Successfully added [${admin.role.toUpperCase()}] ${admin.name} (${admin.email})`);
  }

  console.log('\n=== All 4 New Admins (18, 19, 20, 21) Added Successfully! ===');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error adding admins:', err);
    process.exit(1);
  });
