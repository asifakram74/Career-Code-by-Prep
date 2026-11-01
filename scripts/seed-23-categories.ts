import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { OFFICIAL_23_CATEGORIES } from '../src/constants/officialCategories';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

export async function seed23OfficialCategories() {
  console.log('=== Career Code: Clearing old categories and provisioning 23 official categories ===');

  // 1. Delete all existing categories
  const categoriesSnap = await getDocs(collection(db, 'categories'));
  console.log(`Found ${categoriesSnap.docs.length} existing categories to remove...`);
  for (const catDoc of categoriesSnap.docs) {
    await deleteDoc(doc(db, 'categories', catDoc.id));
  }
  console.log('Old categories removed successfully.');

  // 2. Provision the 23 official categories
  const now = Date.now();
  console.log(`Creating ${OFFICIAL_23_CATEGORIES.length} official categories...`);
  for (const cat of OFFICIAL_23_CATEGORIES) {
    await setDoc(doc(db, 'categories', cat.id), {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      assignedAdminIds: cat.assignedAdminIds,
      primaryAdminId: cat.primaryAdminId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ Created [${cat.name}] with ${cat.assignedAdminIds.length} assigned admins`);
  }

  // 3. Sync assigned categories to admin users
  console.log('\nSyncing assignedCategories into users collection...');
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const uDoc of usersSnap.docs) {
    const uData = uDoc.data();
    if (['normal_admin', 'expert_admin', 'super_admin'].includes(uData.role)) {
      const myCategoryIds = OFFICIAL_23_CATEGORIES
        .filter((c) => c.assignedAdminIds.includes(uDoc.id))
        .map((c) => c.id);

      await updateDoc(doc(db, 'users', uDoc.id), {
        assignedCategories: myCategoryIds,
        updatedAt: now,
      });
      console.log(`  ✓ Updated admin ${uData.displayName} (${uDoc.id}): ${myCategoryIds.length} categories`);
    }
  }

  console.log('\n=== All 23 Categories and Admin Assignments Successfully Provisioned in Firestore! ===');
}

// Execute if run directly
seed23OfficialCategories()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Category seeding error:', err);
    process.exit(1);
  });
