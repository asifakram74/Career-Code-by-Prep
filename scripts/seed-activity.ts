import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

async function setDoc(collectionPath: string, docId: string, fields: Record<string, any>) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionPath}/${docId}`;

  const formattedFields: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val === null || val === undefined) {
      formattedFields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      formattedFields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      formattedFields[key] = Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
    } else if (typeof val === 'boolean') {
      formattedFields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      formattedFields[key] = {
        arrayValue: {
          values: val.map((item) => {
            if (typeof item === 'object') {
              const mapFields: Record<string, any> = {};
              for (const [k, v] of Object.entries(item)) {
                mapFields[k] = { stringValue: String(v) };
              }
              return { mapValue: { fields: mapFields } };
            }
            return { stringValue: String(item) };
          }),
        },
      };
    }
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: formattedFields }),
  });

  if (!res.ok) {
    console.error(`Failed to set ${collectionPath}/${docId}:`, await res.text());
  }
}

async function seedInitialActivity() {
  const now = Date.now();
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;

  console.log('Seeding initial activity records...');

  // 1. Seed demo student
  await setDoc('users', 'demo_student_hamza', {
    uid: 'demo_student_hamza',
    email: 'hamza.student@example.com',
    displayName: 'Hamza Ahmed',
    role: 'student',
    qualification: 'Intermediate / FSc',
    qualificationDetail: 'Pre-Medical',
    board: 'Lahore Board',
    phoneNumber: '+92 300 7788990',
    status: 'active',
    createdAt: twoDaysAgo,
    lastActiveAt: now,
  });

  // 2. Query 1: MBBS / Medical admissions query (Replied)
  const query1Id = 'query_mdcat_guidance_101';
  await setDoc('queries', query1Id, {
    id: query1Id,
    ticketNumber: 'PT-981240',
    studentId: 'demo_student_hamza',
    studentName: 'Hamza Ahmed',
    studentEmail: 'hamza.student@example.com',
    studentPhone: '+92 300 7788990',
    studentQualification: 'Intermediate / FSc (Pre-Medical)',
    studentBoard: 'Lahore Board',
    categoryId: 'cat-mbbs',
    categoryName: 'MBBS',
    expertId: 'expert_med_ayesha',
    expertName: 'Prof. Dr. Ayesha Siddiqua',
    expertRole: 'expert_admin',
    expertTitle: 'Senior Clinical Professor & Medical Admissions Strategist',
    title: 'MDCAT Aggregate Planning for Public vs Private Medical Colleges',
    detail: 'I scored 985 marks in FSc Pre-Medical from Lahore Board and 168 in MDCAT. Can you advise if my aggregate is competitive for King Edward or AIMC, and what are the best alternatives if private medical admission is considered?',
    status: 'replied',
    assignmentStatus: 'assigned',
    hasUnreadStudentReply: true,
    hasUnreadAdminReply: false,
    lastReplyPreview: 'Your aggregate comes out to approximately 91.2%. While KEMU cutoff is typically higher, you have strong prospects in Services and AIMC...',
    lastReplyAt: threeHoursAgo,
    lastSenderRole: 'expert_admin',
    createdAt: twoDaysAgo,
    updatedAt: threeHoursAgo,
  });

  // Message for query 1
  await setDoc('messages', 'msg_reply_101', {
    queryId: query1Id,
    senderId: 'expert_med_ayesha',
    senderName: 'Prof. Dr. Ayesha Siddiqua',
    senderRole: 'expert_admin',
    content: 'Dear Hamza, based on your Lahore Board score of 985 and MDCAT score of 168, your calculated provincial aggregate is approximately 91.2%. While KEMU usually closes near 93.5%, you stand a viable chance in AIMC and SIMS depending on this year\'s provincial merit list. I recommend keeping Fatima Jinnah (for females) or Rawalpindi Medical College as high priority backups. For private colleges, FMH and Shalamar Medical College offer premier clinical hospital rotations.',
    isRead: false,
    createdAt: threeHoursAgo,
  });

  // 3. Query 2: CA vs BS Computer Science query (Open)
  const query2Id = 'query_ca_switch_102';
  await setDoc('queries', query2Id, {
    id: query2Id,
    ticketNumber: 'PT-981241',
    studentId: 'demo_student_hamza',
    studentName: 'Hamza Ahmed',
    studentEmail: 'hamza.student@example.com',
    studentPhone: '+92 300 7788990',
    studentQualification: 'Intermediate / FSc (Pre-Medical)',
    studentBoard: 'Lahore Board',
    categoryId: 'cat-ca',
    categoryName: 'CA (Chartered Accountancy)',
    expertId: 'expert_ca_tariq',
    expertName: 'Dr. Tariq Mahmood (FCA)',
    expertRole: 'expert_admin',
    expertTitle: 'Lead Chartered Accountant & ICAP Counselor',
    title: 'Eligibility of Pre-Medical students for ICAP CA registration and PRC',
    detail: 'Can a Pre-Medical background student start CA without prior accounting background? How challenging is PRC Quantitative Methods?',
    status: 'open',
    assignmentStatus: 'assigned',
    hasUnreadStudentReply: false,
    hasUnreadAdminReply: true,
    createdAt: now - 5 * 60 * 60 * 1000,
    updatedAt: now - 5 * 60 * 60 * 1000,
  });

  // 4. Saved Answer bookmark (verifying permanent retention beyond 15 days)
  await setDoc('savedAnswers', 'saved_guidance_1', {
    studentId: 'demo_student_hamza',
    queryId: query1Id,
    queryTitle: 'MDCAT Aggregate Planning for Public vs Private Medical Colleges',
    categoryName: 'MBBS',
    expertName: 'Prof. Dr. Ayesha Siddiqua',
    questionText: 'I scored 985 marks in FSc Pre-Medical from Lahore Board and 168 in MDCAT. Can you advise if my aggregate is competitive for King Edward or AIMC?',
    answerText: 'Dear Hamza, based on your Lahore Board score of 985 and MDCAT score of 168, your calculated provincial aggregate is approximately 91.2%. Keep AIMC and SIMS as high priority choices.',
    savedAt: now - 24 * 60 * 60 * 1000,
  });

  // 5. Initial Notifications
  await setDoc('notifications', 'notif_demo_1', {
    userId: 'demo_student_hamza',
    title: 'New Expert Reply: PT-981240',
    message: 'Prof. Dr. Ayesha Siddiqua sent a detailed analysis regarding your MDCAT aggregate.',
    type: 'new_reply',
    queryId: query1Id,
    isRead: false,
    createdAt: threeHoursAgo,
  });

  await setDoc('notifications', 'notif_expert_1', {
    userId: 'expert_ca_tariq',
    title: 'New Query Assigned: PT-981241',
    message: 'Hamza Ahmed submitted a query regarding ICAP CA eligibility.',
    type: 'new_query',
    queryId: query2Id,
    isRead: false,
    createdAt: now - 5 * 60 * 60 * 1000,
  });

  // 6. Security Audit Log
  await setDoc('auditLogs', 'log_init_setup', {
    actorId: 'admin_hamza_saif',
    actorName: 'Hamza Saif',
    actorRole: 'super_admin',
    action: 'PLATFORM_INITIALIZATION',
    details: 'Provisioned default categories, assigned initial counseling leads, and deployed ABAC security rules.',
    timestamp: now,
  });

  console.log('Initial activity seeded successfully.');
}

seedInitialActivity().catch(console.error);
