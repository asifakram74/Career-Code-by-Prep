import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function clearCollection(colName: string) {
  console.log(`Clearing collection: ${colName}...`);
  const colRef = collection(db, colName);
  const snap = await getDocs(colRef);
  console.log(`Found ${snap.size} documents in ${colName}`);
  
  // Delete in batches of 100
  let count = 0;
  let batch = writeBatch(db);
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count++;
    if (count % 100 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 100 !== 0) {
    await batch.commit();
  }
  console.log(`Deleted ${count} documents from ${colName}.`);
}

async function resetUsersRatings() {
  console.log('Resetting counselor rating fields on users...');
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  let updated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (
      data.ratingCount !== undefined ||
      data.ratingSum !== undefined ||
      data.averageRating !== undefined ||
      data.lastReplyAt !== undefined
    ) {
      await updateDoc(docSnap.ref, {
        ratingCount: 0,
        ratingSum: 0,
        averageRating: 0,
        lastReplyAt: null,
      });
      updated++;
    }
  }
  console.log(`Reset rating metrics on ${updated} user profiles.`);
}

async function main() {
  try {
    console.log('Starting full test data cleanup for Firestore DB:', firebaseConfig.firestoreDatabaseId);
    
    // Clear student queries/tickets
    await clearCollection('queries');
    
    // Clear chat messages
    await clearCollection('messages');
    
    // Clear saved answers / bookmarks
    await clearCollection('savedAnswers');
    
    // Clear in-app notifications
    await clearCollection('notifications');
    
    // Clear test audit logs
    await clearCollection('auditLogs');
    
    // Reset counselor ratings & stats
    await resetUsersRatings();
    
    console.log('=== ALL TEST DATA SUCCESSFULLY CLEARED FROM FIRESTORE ===');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

main();
