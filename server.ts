import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase config
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Initialize Firebase App & Firestore
const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Cryptographic password hashing
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return computedHash === hash;
}

// Sanitized credential doc ID
function credDocId(email: string): string {
  return 'cred_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Helper to fetch document from Firestore
async function getFirestoreDoc(collectionPath: string, docId: string): Promise<any> {
  try {
    const snap = await getDoc(doc(db, collectionPath, docId));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error(`Error reading ${collectionPath}/${docId}:`, e);
    return null;
  }
}

// Helper to write to Firestore
async function setFirestoreDoc(collectionPath: string, docId: string, fields: Record<string, any>) {
  try {
    await setDoc(doc(db, collectionPath, docId), fields, { merge: true });
  } catch (e) {
    console.error(`Error writing ${collectionPath}/${docId}:`, e);
  }
}

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'Career Code by Prep Titans',
    projectId: firebaseConfig.projectId,
    superAdminEmail: 'mentoflux@gmail.com',
  });
});

// Public Mentors Endpoint (Sanitized - Never exposes passwords, emails, phones, or internal data)
app.get('/api/public/mentors', async (_req: Request, res: Response) => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const categoriesSnap = await getDocs(collection(db, 'categories'));

    const categoryMap: Record<string, any> = {};
    categoriesSnap.docs.forEach((d) => {
      const data = d.data();
      categoryMap[d.id] = {
        id: d.id,
        name: data.name,
        color: data.color || 'emerald',
      };
    });

    const mentors: any[] = [];
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const role = data.role;
      const isMentor = ['normal_admin', 'expert_admin', 'super_admin'].includes(role);
      const isDeactivated = data.status === 'deactivated' || data.isDeactivated === true;

      if (isMentor && !isDeactivated) {
        const catIds = Array.isArray(data.assignedCategories) ? data.assignedCategories : [];
        const catDetails = catIds
          .filter((cId: string) => cId !== 'cat-admissions' && cId !== 'cat-general-guidance' && Boolean(categoryMap[cId]))
          .map((cId: string) => categoryMap[cId]);

        const isFounder =
          (data.displayName || '').toLowerCase().includes('huzaifa') || d.id === 'admin_huzaifa_khalil';

        mentors.push({
          uid: d.id,
          displayName: data.displayName || 'Career Mentor',
          professionalTitle: isFounder
            ? 'Founder, Career Code'
            : data.professionalTitle || 'Academic & Career Mentor',
          shortDescription:
            data.shortDescription ||
            data.bio ||
            'Experienced mentor helping Pakistani students explore degree options and admissions.',
          photoURL: data.photoURL || '',
          role: data.role,
          categories: catDetails,
          isFounder,
          averageRating: typeof data.averageRating === 'number' ? data.averageRating : null,
          ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 0,
        });
      }
    });

    // Deduplicate mentors by name, keeping founder or most complete profile
    const seenNames = new Set<string>();
    const deduplicatedMentors: any[] = [];

    // Sort to prioritize founder and profiles with photoURL
    mentors.sort((a, b) => {
      if (a.isFounder && !b.isFounder) return -1;
      if (!a.isFounder && b.isFounder) return 1;
      if (a.photoURL && !b.photoURL) return -1;
      if (!a.photoURL && b.photoURL) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    for (const m of mentors) {
      const key = (m.displayName || '').trim().toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        deduplicatedMentors.push(m);
      }
    }

    res.json({ success: true, mentors: deduplicatedMentors });
  } catch (err: any) {
    console.error('Error fetching public mentors:', err);
    res.status(500).json({ error: 'Failed to fetch public mentors' });
  }
});

// 2. Resilient Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);

    const credDoc = await getFirestoreDoc('credentials', cId);

    if (credDoc && credDoc.passwordHash && credDoc.salt) {
      const isValid = verifyPassword(password, credDoc.passwordHash, credDoc.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      // Fetch user profile
      let profile = await getFirestoreDoc('users', credDoc.uid);
      if (!profile) {
        profile = {
          uid: credDoc.uid,
          email: cleanEmail,
          displayName: credDoc.displayName || 'User',
          role: credDoc.role || 'student',
          status: 'active',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        };
        await setFirestoreDoc('users', credDoc.uid, profile);
      }

      if (profile.status === 'deactivated') {
        return res.status(403).json({ error: 'This account has been deactivated. Contact administration.' });
      }

      const now = Date.now();
      await setFirestoreDoc('users', profile.uid, { ...profile, lastActiveAt: now });
      return res.json({ success: true, profile, uid: profile.uid });
    }

    return res.status(401).json({ error: 'Invalid credentials. Please verify your email and password.' });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server login error.' });
  }
});

// 3. Student Registration Endpoint
app.post('/api/auth/register-student', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      qualification,
      qualificationDetail,
      board,
    } = req.body;

    if (!fullName || !email || !password || !phone || !qualification) {
      return res.status(400).json({ error: 'All required registration fields must be provided.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);

    // Check if account already exists
    const existingCred = await getFirestoreDoc('credentials', cId);
    if (existingCred) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const uid = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // Hash password
    const { hash, salt } = hashPassword(password);
    await setFirestoreDoc('credentials', cId, {
      uid,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role: 'student',
      displayName: fullName.trim(),
      createdAt: now,
      updatedAt: now,
    });

    const studentProfile = {
      uid,
      email: cleanEmail,
      displayName: fullName.trim(),
      role: 'student',
      qualification,
      qualificationDetail: qualificationDetail?.trim() || '',
      board: board?.trim() || '',
      phoneNumber: phone.trim(),
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
    };

    await setFirestoreDoc('users', uid, studentProfile);

    res.json({
      success: true,
      profile: studentProfile,
      uid,
    });
  } catch (err: any) {
    console.error('Student registration error:', err);
    res.status(500).json({ error: err.message || 'Error creating student account.' });
  }
});

// 4. Admin creation endpoint
app.post('/api/admin/create-admin-account', async (req: Request, res: Response) => {
  try {
    const {
      creatorRole,
      email,
      password,
      displayName,
      role,
      professionalTitle,
      shortDescription,
      phoneNumber,
      assignedCategories,
    } = req.body;

    if (creatorRole !== 'super_admin' && creatorRole !== 'expert_admin') {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges to create admins.' });
    }

    if (creatorRole === 'expert_admin' && (role === 'expert_admin' || role === 'super_admin')) {
      return res.status(403).json({
        error: 'Forbidden: Expert Admins can only create Admin accounts.',
      });
    }

    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ error: 'Required fields missing.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);

    const uid = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const { hash, salt } = hashPassword(password);
    await setFirestoreDoc('credentials', cId, {
      uid,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role,
      displayName,
      updatedAt: now,
    });

    await setFirestoreDoc('users', uid, {
      uid,
      email: cleanEmail,
      displayName,
      role,
      professionalTitle: professionalTitle || 'Admissions & Career Counselor',
      shortDescription: shortDescription || 'Guiding students toward their chosen academic paths.',
      phoneNumber: phoneNumber || '',
      assignedCategories: assignedCategories || [],
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
    });

    await setFirestoreDoc('admins', uid, {
      role,
      email: cleanEmail,
      displayName,
    });

    res.json({
      success: true,
      message: `${role === 'expert_admin' ? 'Expert Admin' : 'Admin'} created successfully.`,
      uid,
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: err.message || 'Error creating administrator account.' });
  }
});

// Helper to resolve admin user by UID or Email
async function resolveAdminUser(identifier?: string): Promise<{ uid: string; data: any } | null> {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();

  // Check mentoflux super admin bootstrap
  if (clean === 'mentoflux@gmail.com' || clean === 'admin_hamza_saif') {
    const snap = await getDoc(doc(db, 'users', 'admin_hamza_saif'));
    if (snap.exists()) {
      return { uid: 'admin_hamza_saif', data: snap.data() };
    }
  }

  // 1. Try by direct UID in users
  const snap = await getDoc(doc(db, 'users', identifier));
  if (snap.exists()) {
    return { uid: identifier, data: snap.data() };
  }

  // 2. Try by email query
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const d of usersSnap.docs) {
    const data = d.data();
    if (data.email && data.email.trim().toLowerCase() === clean) {
      return { uid: d.id, data };
    }
  }

  // 3. Try credentials collection
  const cId = credDocId(clean);
  const credDoc = await getFirestoreDoc('credentials', cId);
  if (credDoc && credDoc.uid) {
    const uSnap = await getDoc(doc(db, 'users', credDoc.uid));
    if (uSnap.exists()) {
      return { uid: credDoc.uid, data: uSnap.data() };
    }
    return { uid: credDoc.uid, data: credDoc };
  }

  return null;
}

// 5. Update User Password (Super Admin can change ANY admin, Expert Admin can change Normal Admin, Admin can change self)
app.post('/api/admin/update-user-password', async (req: Request, res: Response) => {
  try {
    const { callerUid, callerEmail, targetUid, targetEmail, newPassword } = req.body;

    if ((!callerUid && !callerEmail) || (!targetUid && !targetEmail) || !newPassword) {
      return res.status(400).json({ error: 'Caller identifier, Target identifier, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const caller = await resolveAdminUser(callerUid || callerEmail);
    if (!caller) {
      return res.status(403).json({ error: 'Caller administrator profile not found.' });
    }

    const callerRole = caller.data?.role;
    const target = await resolveAdminUser(targetUid || targetEmail);
    if (!target) {
      return res.status(404).json({ error: 'Target administrator not found.' });
    }

    const targetUser = target.data;
    const isSelf = caller.uid === target.uid;

    if (!isSelf) {
      if (callerRole !== 'super_admin' && callerRole !== 'expert_admin') {
        return res.status(403).json({ error: 'Unauthorized: insufficient privileges to change user passwords.' });
      }

      if (callerRole === 'expert_admin' && (targetUser.role === 'super_admin' || targetUser.role === 'expert_admin')) {
        return res.status(403).json({ error: 'Expert Admins cannot change passwords of Super Admins or Expert Admins.' });
      }
      // Note: Super Admin CAN change password of ANY admin, including other Super Admins!
    }

    const cleanEmail = targetUser.email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);
    const { hash, salt } = hashPassword(newPassword);

    await setDoc(
      doc(db, 'credentials', cId),
      {
        uid: target.uid,
        email: cleanEmail,
        passwordHash: hash,
        salt,
        role: targetUser.role,
        displayName: targetUser.displayName,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: `Password updated successfully for ${targetUser.displayName}.`,
    });
  } catch (err: any) {
    console.error('Password update error:', err);
    res.status(500).json({ error: err.message || 'Error updating password.' });
  }
});

// 5b. Update Administrator Profile (Super Admin, Expert Admin, or Self)
app.post('/api/admin/update-admin-profile', async (req: Request, res: Response) => {
  try {
    const { callerUid, callerEmail, targetUid, targetEmail, updates } = req.body;
    if ((!callerUid && !callerEmail) || (!targetUid && !targetEmail) || !updates) {
      return res.status(400).json({ error: 'Missing required profile update parameters.' });
    }

    const caller = await resolveAdminUser(callerUid || callerEmail);
    if (!caller) {
      return res.status(403).json({ error: 'Caller not authorized.' });
    }

    const target = await resolveAdminUser(targetUid || targetEmail);
    if (!target) {
      return res.status(404).json({ error: 'Target administrator not found.' });
    }

    const callerRole = caller.data?.role;
    const isSelf = caller.uid === target.uid;

    if (!isSelf && callerRole !== 'super_admin' && callerRole !== 'expert_admin') {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges to edit administrator profiles.' });
    }

    const now = Date.now();
    const cleanUpdates: any = {
      displayName: updates.displayName?.trim() || target.data.displayName,
      phoneNumber: updates.phoneNumber?.trim() ?? target.data.phoneNumber ?? '',
      professionalTitle: updates.professionalTitle?.trim() ?? target.data.professionalTitle ?? '',
      shortDescription: updates.shortDescription?.trim() ?? target.data.shortDescription ?? '',
      assignedCategories: Array.isArray(updates.assignedCategories) ? updates.assignedCategories : (target.data.assignedCategories || []),
      updatedAt: now,
    };

    // Role modification is exclusive to Super Admin
    if (callerRole === 'super_admin' && updates.role) {
      cleanUpdates.role = updates.role;
    }

    // Save to users collection
    await setDoc(doc(db, 'users', target.uid), cleanUpdates, { merge: true });

    // Save to admins collection
    await setDoc(doc(db, 'admins', target.uid), {
      displayName: cleanUpdates.displayName,
      role: cleanUpdates.role || target.data.role,
      email: target.data.email,
    }, { merge: true }).catch(() => {});

    // Save to credentials collection
    const cleanEmail = target.data.email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);
    await setDoc(doc(db, 'credentials', cId), {
      displayName: cleanUpdates.displayName,
      ...(cleanUpdates.role ? { role: cleanUpdates.role } : {}),
      updatedAt: now,
    }, { merge: true }).catch(() => {});

    // Sync categories assignedAdminIds
    const catsSnap = await getDocs(collection(db, 'categories'));
    for (const catDoc of catsSnap.docs) {
      const catData = catDoc.data();
      const currentAdmins: string[] = Array.isArray(catData.assignedAdminIds) ? catData.assignedAdminIds : [];
      const shouldHave = cleanUpdates.assignedCategories.includes(catDoc.id);
      const has = currentAdmins.includes(target.uid);

      if (shouldHave && !has) {
        await updateDoc(doc(db, 'categories', catDoc.id), {
          assignedAdminIds: [...currentAdmins, target.uid],
          updatedAt: now,
        }).catch(() => {});
      } else if (!shouldHave && has) {
        await updateDoc(doc(db, 'categories', catDoc.id), {
          assignedAdminIds: currentAdmins.filter((id) => id !== target.uid),
          updatedAt: now,
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: `Profile updated successfully for ${cleanUpdates.displayName}.`,
      profile: { ...target.data, ...cleanUpdates },
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message || 'Error updating administrator profile.' });
  }
});

// 6. Permanently Delete Admin Account
// Super Admin can delete ANY admin, INCLUDING another Super Admin!
// Expert Admin can only delete normal admins.
app.post('/api/admin/delete-admin-account', async (req: Request, res: Response) => {
  try {
    const { callerUid, callerEmail, targetUid, targetEmail, reassignToUid } = req.body;

    if ((!callerUid && !callerEmail) || (!targetUid && !targetEmail)) {
      return res.status(400).json({ error: 'Caller and Target identifiers are required.' });
    }

    const caller = await resolveAdminUser(callerUid || callerEmail);
    if (!caller) {
      return res.status(403).json({ error: 'Caller administrator profile not found.' });
    }

    const callerRole = caller.data?.role;
    if (callerRole !== 'super_admin' && callerRole !== 'expert_admin') {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges to delete administrator accounts.' });
    }

    const target = await resolveAdminUser(targetUid || targetEmail);
    if (!target) {
      return res.status(404).json({ error: 'Target administrator not found.' });
    }

    const targetUser = target.data;

    // Self-deletion check
    if (caller.uid === target.uid) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // Role privilege check:
    // Expert Admins can only delete normal_admin
    if (callerRole === 'expert_admin' && targetUser.role !== 'normal_admin') {
      return res.status(403).json({ error: 'Expert Admins can only permanently delete normal Admin accounts.' });
    }

    // A Super Admin can delete ANY admin, INCLUDING another Super Admin!

    // Reassign open queries if reassignToUid is provided
    if (reassignToUid) {
      const reassignTargetSnap = await getDoc(doc(db, 'users', reassignToUid));
      if (reassignTargetSnap.exists()) {
        const reassignTarget = reassignTargetSnap.data();
        const queriesSnap = await getDocs(collection(db, 'queries'));
        for (const qDoc of queriesSnap.docs) {
          const qData = qDoc.data();
          if (qData.expertId === target.uid && qData.status !== 'resolved') {
            await updateDoc(doc(db, 'queries', qDoc.id), {
              expertId: reassignToUid,
              expertName: reassignTarget.displayName,
              expertRole: reassignTarget.role,
              expertTitle: reassignTarget.professionalTitle || '',
              assignmentStatus: 'reassigned',
              updatedAt: Date.now(),
            }).catch(() => {});
          }
        }
      }
    }

    // Remove admin from all category assignments
    const catsSnap = await getDocs(collection(db, 'categories'));
    for (const catDoc of catsSnap.docs) {
      const catData = catDoc.data();
      const currentAdmins: string[] = Array.isArray(catData.assignedAdminIds) ? catData.assignedAdminIds : [];
      if (currentAdmins.includes(target.uid)) {
        await updateDoc(doc(db, 'categories', catDoc.id), {
          assignedAdminIds: currentAdmins.filter((id) => id !== target.uid),
          ...(catData.primaryAdminId === target.uid ? { primaryAdminId: '' } : {}),
          updatedAt: Date.now(),
        }).catch(() => {});
      }
    }

    // Permanently delete from collections
    const cleanEmail = targetUser.email.trim().toLowerCase();
    const cId = credDocId(cleanEmail);

    await deleteDoc(doc(db, 'users', target.uid)).catch(() => {});
    await deleteDoc(doc(db, 'credentials', cId)).catch(() => {});
    await deleteDoc(doc(db, 'admins', target.uid)).catch(() => {});

    res.json({
      success: true,
      message: `Administrator ${targetUser.displayName} permanently deleted.`,
    });
  } catch (err: any) {
    console.error('Delete admin error:', err);
    res.status(500).json({ error: err.message || 'Error deleting administrator account.' });
  }
});

// 7. Save / Update Category (Super Admin & Expert Admin only)
app.post('/api/admin/categories/save', async (req: Request, res: Response) => {
  try {
    const { callerUid, category } = req.body;
    if (!callerUid || !category || !category.name) {
      return res.status(400).json({ error: 'Caller UID and category data with name are required.' });
    }

    const callerSnap = await getDoc(doc(db, 'users', callerUid));
    if (!callerSnap.exists()) {
      return res.status(403).json({ error: 'Caller profile not found.' });
    }
    const callerRole = callerSnap.data()?.role;
    if (callerRole !== 'super_admin' && callerRole !== 'expert_admin') {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges to manage categories.' });
    }

    const now = Date.now();
    const catId = category.id || `cat-${Date.now()}`;
    const payload = {
      id: catId,
      name: category.name.trim(),
      description: category.description?.trim() || '',
      assignedAdminIds: Array.isArray(category.assignedAdminIds) ? category.assignedAdminIds : [],
      primaryAdminId: category.primaryAdminId || '',
      status: category.status === 'inactive' ? 'inactive' : 'active',
      updatedAt: now,
      createdAt: category.createdAt || now,
    };

    await setDoc(doc(db, 'categories', catId), payload, { merge: true });

    // Sync admin users
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      if (['normal_admin', 'expert_admin', 'super_admin'].includes(uData.role)) {
        const shouldHave = payload.assignedAdminIds.includes(uDoc.id);
        const currentCats: string[] = Array.isArray(uData.assignedCategories) ? uData.assignedCategories : [];
        const has = currentCats.includes(catId);

        if (shouldHave && !has) {
          await updateDoc(doc(db, 'users', uDoc.id), {
            assignedCategories: [...currentCats, catId],
            updatedAt: now,
          });
        } else if (!shouldHave && has) {
          await updateDoc(doc(db, 'users', uDoc.id), {
            assignedCategories: currentCats.filter((c) => c !== catId),
            updatedAt: now,
          });
        }
      }
    }

    res.json({ success: true, category: payload });
  } catch (err: any) {
    console.error('Save category error:', err);
    res.status(500).json({ error: err.message || 'Error saving category.' });
  }
});

// 8. Delete Category (Super Admin & Expert Admin only)
app.post('/api/admin/categories/delete', async (req: Request, res: Response) => {
  try {
    const { callerUid, categoryId } = req.body;
    if (!callerUid || !categoryId) {
      return res.status(400).json({ error: 'Caller UID and category ID are required.' });
    }

    const callerSnap = await getDoc(doc(db, 'users', callerUid));
    if (!callerSnap.exists()) {
      return res.status(403).json({ error: 'Caller profile not found.' });
    }
    const callerRole = callerSnap.data()?.role;
    if (callerRole !== 'super_admin' && callerRole !== 'expert_admin') {
      return res.status(403).json({ error: 'Unauthorized: insufficient privileges to delete categories.' });
    }

    // Check queries count
    const queriesSnap = await getDocs(collection(db, 'queries'));
    const activeCount = queriesSnap.docs.filter((q) => q.data().categoryId === categoryId).length;
    if (activeCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category because it contains ${activeCount} active queries. Set status to inactive instead.`,
      });
    }

    await deleteDoc(doc(db, 'categories', categoryId));
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: any) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: err.message || 'Error deleting category.' });
  }
});

// ==========================================
// 9. GOOGLE DRIVE RESOURCE EXPLORER ENDPOINTS
// ==========================================

// Get current Google Drive configuration
app.get('/api/drive/config', async (_req: Request, res: Response) => {
  try {
    const configDoc = await getFirestoreDoc('settings', 'drive_config');
    if (configDoc) {
      return res.json({ success: true, config: configDoc });
    }

    const defaultConfig = {
      rootFolderId: 'root_career_code_vault',
      rootFolderName: 'Career Code Knowledge Base',
      rootFolderUrl: 'https://drive.google.com/drive/folders/career_code_resources',
      lastSyncedAt: Date.now(),
      syncStatus: 'synced',
    };
    await setFirestoreDoc('settings', 'drive_config', defaultConfig);
    res.json({ success: true, config: defaultConfig });
  } catch (err: any) {
    console.error('Error fetching drive config:', err);
    res.status(500).json({ error: 'Failed to fetch drive configuration.' });
  }
});

// Update Google Drive configuration (Admin only)
app.post('/api/drive/config', async (req: Request, res: Response) => {
  try {
    const { rootFolderId, rootFolderName, rootFolderUrl } = req.body;
    if (!rootFolderId && !rootFolderUrl) {
      return res.status(400).json({ error: 'Root folder ID or Google Drive URL is required.' });
    }

    // Extract ID if URL is passed
    let cleanId = rootFolderId?.trim() || '';
    if (rootFolderUrl) {
      const match = rootFolderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) cleanId = match[1];
    }

    const updatedConfig = {
      rootFolderId: cleanId || 'root_career_code_vault',
      rootFolderName: rootFolderName?.trim() || 'Career Code Knowledge Base',
      rootFolderUrl: rootFolderUrl?.trim() || `https://drive.google.com/drive/folders/${cleanId}`,
      lastSyncedAt: Date.now(),
      syncStatus: 'synced',
    };

    await setFirestoreDoc('settings', 'drive_config', updatedConfig);
    res.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    console.error('Error updating drive config:', err);
    res.status(500).json({ error: 'Failed to update drive configuration.' });
  }
});

// In-memory cache for public Google Drive folder responses (5 minutes TTL)
const driveFolderCache = new Map<string, { items: any[]; folderName: string; timestamp: number }>();

async function scrapePublicGoogleDriveFolder(folderId: string): Promise<{ items: any[]; folderName: string }> {
  const cached = driveFolderCache.get(folderId);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return { items: cached.items, folderName: cached.folderName };
  }

  const url = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    return { items: [], folderName: 'Career Code Drive' };
  }

  const html = await res.text();
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  let folderName = titleMatch
    ? titleMatch[1].replace(/ – Google Drive.*$/, '').replace(/ - Google Drive.*$/, '').trim()
    : 'Career Code Drive';

  const items: any[] = [];
  const seenIds = new Set<string>();

  const ds3Match = html.match(/AF_initDataCallback\s*\(\s*\{key:\s*[\x27"]ds:3[\x27"],\s*hash:[^,]+,\s*data:\s*([\s\S]*?),\s*sideChannel:/);
  if (ds3Match) {
    try {
      const data = JSON.parse(ds3Match[1]);
      function findItems(arr: any, depth = 0) {
        if (!Array.isArray(arr) || depth > 12) return;
        for (const el of arr) {
          if (Array.isArray(el) && el.length > 5 && typeof el[4] === 'string') {
            const id = el[0] && Array.isArray(el[0]) ? el[0][1] : null;
            const mime = el[4];
            const str = JSON.stringify(el);
            const nameMatch = str.match(/\[\[\["([^"\\]+)/);
            if (id && nameMatch && !seenIds.has(id)) {
              seenIds.add(id);
              const name = nameMatch[1];
              const isFolder = mime === 'application/vnd.google-apps.folder';
              let type = 'other';
              const lower = name.toLowerCase();
              if (isFolder) type = 'folder';
              else if (mime.includes('pdf') || lower.endsWith('.pdf')) type = 'pdf';
              else if (mime.includes('audio') || lower.endsWith('.mp3') || lower.endsWith('.m4a') || lower.endsWith('.wav')) type = 'audio';
              else if (mime.includes('image') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) type = 'image';
              else if (mime.includes('word') || mime.includes('document') || lower.endsWith('.docx') || lower.endsWith('.doc')) type = 'doc';

              items.push({
                id,
                name,
                mimeType: mime,
                type,
                parentId: folderId,
                webViewLink: isFolder
                  ? `https://drive.google.com/drive/folders/${id}`
                  : `https://drive.google.com/file/d/${id}/view?usp=drivesdk`,
              });
            }
          }
          findItems(el, depth + 1);
        }
      }
      findItems(data);
    } catch (err) {
      console.warn('Error parsing Google Drive ds:3 payload:', err);
    }
  }

  driveFolderCache.set(folderId, { items, folderName, timestamp: Date.now() });
  return { items, folderName };
}

// Fetch Google Drive folder contents (subfolders and files)
app.get('/api/drive/folder-contents', async (req: Request, res: Response) => {
  const folderId = (req.query.folderId as string) || 'root_career_code_vault';
  const forceRefresh = req.query.refresh === 'true';

  if (forceRefresh) {
    driveFolderCache.delete(folderId);
  }

  // If a real Google Drive folder ID is configured
  if (folderId && folderId !== 'root_career_code_vault' && !folderId.startsWith('folder-')) {
    try {
      const scraped = await scrapePublicGoogleDriveFolder(folderId);
      return res.json({
        success: true,
        items: scraped.items,
        folderName: scraped.folderName,
        source: 'google_drive',
      });
    } catch (scrapeErr) {
      console.warn('Failed to scrape public Google Drive folder:', scrapeErr);
    }
  }

  // Fallback to seeded demo vault if folderId is mock placeholder
  res.json({
    success: true,
    items: [],
    folderName: 'Career Code Knowledge Base',
    source: 'cached_vault',
  });
});

// Stream audio files from Google Drive with proper Audio Content-Types
app.get('/api/drive/audio-stream', async (req: Request, res: Response) => {
  const fileId = req.query.fileId as string;
  if (!fileId) return res.status(400).send('File ID required');

  try {
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const driveRes = await fetch(driveUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!driveRes.ok) {
      return res.status(driveRes.status).send('Failed to fetch audio stream');
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());
    let contentType = 'audio/ogg';
    const filename = (req.query.filename as string || '').toLowerCase();
    if (filename.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (filename.endsWith('.m4a') || filename.endsWith('.mp4')) contentType = 'audio/mp4';
    else if (filename.endsWith('.wav')) contentType = 'audio/wav';
    else if (filename.endsWith('.oga') || filename.endsWith('.ogg')) contentType = 'audio/ogg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(buffer);
  } catch (err: any) {
    console.error('Audio streaming proxy error:', err);
    res.status(500).send('Audio streaming error');
  }
});


// Start Express server and mount Vite middleware
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Career Code by Prep Titans server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
