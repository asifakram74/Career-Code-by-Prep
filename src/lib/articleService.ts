import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { ArticleItem } from '../types';

const ARTICLES_COLLECTION = 'articles';

// Curated starter articles to populate if database has no articles yet
export const STARTER_ARTICLES: Omit<ArticleItem, 'id'>[] = [
  {
    title: '5 Proven Mindset Shifts for Competitive Exam Preparation (MDCAT & Engineering)',
    description: 'Beyond study hours, psychological stamina and emotional discipline dictate exam outcomes. Here is how top achievers train their mental endurance.',
    coverImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    category: 'Exam Strategy & Mindset',
    tags: ['Mindset', 'MDCAT', 'ECAT', 'Discipline'],
    content: `<h2>The Hidden Determinant of Competitive Success</h2><p>Most students believe competitive entrance exams are purely tests of syllabus memory. However, after mentoring hundreds of medical and engineering candidates, a clear pattern emerges: <b>mental resilience and stamina matter just as much as subject knowledge.</b></p><br/><h3>1. Ditch the "All-or-Nothing" Study Guilt</h3><p>A bad morning test score does not ruin your week. Top candidates treat diagnostic mock tests as <mark>neutral data streams</mark>, not personal judgments. If you miss 15 chemistry formulas today, write them down immediately and review before sleeping.</p><br/><h3>2. Active Recall over Passive Highlighting</h3><p>Rereading textbook chapters creates a false illusion of competence. Use the <u>Feynman Technique</u>: explain complex biological pathways or physics derivation in plain language to an imaginary peer.</p><br/><blockquote class="border-l-4 border-pink-500 pl-4 py-2 italic bg-pink-50/70 text-pink-900 rounded-r-xl my-3">"Success in high-stakes testing is 40% syllabus mastery, 40% mock test stamina, and 20% emotional composure under time constraints."</blockquote><br/><h3>3. Sleep Is Your Memory Consolidation Engine</h3><p>Late-night cramming without REM sleep causes neural memory decay. Target <b>at least 6.5 to 7 hours of uninterrupted rest</b> during peak mock exam phases.</p>`,
    authorId: 'prep_titans_mentor',
    authorName: 'Dr. Huzaifa Khan',
    authorRole: 'expert_admin',
    authorPhotoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    authorProfessionalTitle: 'Senior Academic Counselor & Medical Mentor',
    authorQualification: 'MBBS (King Edward Medical University)',
    authorBio: 'Passionate about student psychology, entrance test strategies, and mentoring students towards fulfilling careers.',
    readTimeMinutes: 4,
    likesCount: 24,
    likedBy: [],
    viewsCount: 142,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    updatedAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    title: 'How to Build a Future-Proof Skillset in University Beyond Academic Grades',
    description: 'A comprehensive roadmap on cultivating digital fluency, critical communication, and project portfolio development before graduating.',
    coverImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    category: 'Career & Professional Growth',
    tags: ['University', 'Career Readiness', 'Soft Skills', 'Tech'],
    content: `<h2>The University Paradigm Shift</h2><p>A 3.9 GPA is impressive, but in today's dynamic global job market, <mark>hands-on applied problem solving</mark> is the real differentiator. Whether you study humanities, computer science, or biochemistry, employers and scholarship committees look for proof of initiative.</p><br/><h3>The Three Core Pillars Every Student Needs:</h3><ul><li><b>Demonstrated Projects:</b> Do not wait for your final year capstone. Publish open-source work, write research summaries, or contribute to community initiatives.</li><li><b>Written Communication:</b> The ability to write concise proposals, clear documentation, and persuasive emails is rare and universally sought-after.</li><li><b>Curiosity for Emerging AI Tools:</b> Learn how to leverage modern AI tools responsibly to augment your research and productivity.</li></ul><br/><blockquote class="border-l-4 border-pink-500 pl-4 py-2 italic bg-pink-50/70 text-pink-900 rounded-r-xl my-3">"Don't build your degree solely for an exam hall. Build a body of work that speaks for you when you are not in the room."</blockquote>`,
    authorId: 'prep_titans_tech_mentor',
    authorName: 'Engr. Sarah Tariq',
    authorRole: 'normal_admin',
    authorPhotoURL: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=250&q=80',
    authorProfessionalTitle: 'Software Engineer & Tech Career Counselor',
    authorQualification: 'BS Computer Science (FAST-NUCES), MS Software Eng',
    authorBio: 'Guiding aspiring engineers and tech professionals to master real-world coding, career roadmaps, and internship success.',
    readTimeMinutes: 5,
    likesCount: 19,
    likedBy: [],
    viewsCount: 98,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

export const subscribeToArticles = (
  callback: (articles: ArticleItem[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, ARTICLES_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        // If empty, auto-seed starter articles
        try {
          for (const item of STARTER_ARTICLES) {
            await addDoc(collection(db, ARTICLES_COLLECTION), item);
          }
        } catch (e) {
          console.warn('Auto-seed starter articles note:', e);
          callback(
            STARTER_ARTICLES.map((a, i) => ({
              id: `starter-${i}`,
              ...a,
            }))
          );
          return;
        }
      }

      const articles: ArticleItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ArticleItem, 'id'>),
      }));

      callback(articles);
    },
    (err) => {
      console.error('Articles subscription error:', err);
      if (onError) onError(err);
    }
  );
};

export const createArticle = async (
  articleData: Omit<ArticleItem, 'id'>
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, ARTICLES_COLLECTION), {
      ...articleData,
      likesCount: articleData.likesCount || 0,
      likedBy: articleData.likedBy || [],
      viewsCount: articleData.viewsCount || 0,
      createdAt: articleData.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ARTICLES_COLLECTION);
    throw error;
  }
};

export const updateArticle = async (
  articleId: string,
  articleData: Partial<ArticleItem>
): Promise<void> => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, articleId);
    await updateDoc(docRef, {
      ...articleData,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ARTICLES_COLLECTION}/${articleId}`);
  }
};

export const deleteArticle = async (articleId: string): Promise<void> => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, articleId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ARTICLES_COLLECTION}/${articleId}`);
  }
};

export const toggleLikeArticle = async (
  articleId: string,
  userId: string,
  hasLiked: boolean
): Promise<void> => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, articleId);
    if (hasLiked) {
      await updateDoc(docRef, {
        likedBy: arrayRemove(userId),
        likesCount: increment(-1),
      });
    } else {
      await updateDoc(docRef, {
        likedBy: arrayUnion(userId),
        likesCount: increment(1),
      });
    }
  } catch (error) {
    console.warn('Like toggle failed:', error);
  }
};

export const incrementArticleViews = async (articleId: string): Promise<void> => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, articleId);
    await updateDoc(docRef, {
      viewsCount: increment(1),
    });
  } catch (error) {
    console.warn('Increment views failed:', error);
  }
};

export const SAVED_ARTICLES_COLLECTION = 'saved_articles';

export const toggleSaveArticle = async (
  articleId: string,
  userId: string,
  isCurrentlySaved: boolean,
  articleTitle?: string
): Promise<void> => {
  try {
    if (!userId) return;

    if (isCurrentlySaved) {
      const q = query(
        collection(db, SAVED_ARTICLES_COLLECTION),
        where('userId', '==', userId),
        where('articleId', '==', articleId)
      );
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } else {
      await addDoc(collection(db, SAVED_ARTICLES_COLLECTION), {
        userId,
        articleId,
        articleTitle: articleTitle || '',
        savedAt: Date.now(),
      });
    }
  } catch (error) {
    console.warn('Toggle save article error:', error);
  }
};

export const subscribeToSavedArticleIds = (
  userId: string,
  callback: (savedIds: string[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const cacheKey = `cc_saved_article_ids_${userId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) callback(parsed);
    }
  } catch {}

  const q = query(
    collection(db, SAVED_ARTICLES_COLLECTION),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const ids = snapshot.docs.map((d) => d.data().articleId as string);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(ids));
      } catch {}
      callback(ids);
    },
    (err) => {
      console.warn('Error subscribing to saved articles:', err);
    }
  );
};
