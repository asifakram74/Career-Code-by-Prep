import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { useAuth } from '../../context/AuthContext';
import { SavedAnswerItem } from '../../types';
import {
  Bookmark,
  Trash2,
  Calendar,
  User,
  Folder,
  Search,
  Sparkles,
} from 'lucide-react';
import { LinkifiedText } from '../common/LinkifiedText';

interface SavedAnswersSectionProps {
  onOpenQueryDetail?: (queryId: string) => void;
}

export const SavedAnswersSection: React.FC<SavedAnswersSectionProps> = ({
  onOpenQueryDetail,
}) => {
  const { userProfile } = useAuth();
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'savedAnswers'),
      where('studentId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedAnswerItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as SavedAnswerItem);
        });
        items.sort((a, b) => b.savedAt - a.savedAt);
        setSavedAnswers(items);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'savedAnswers');
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  const handleRemove = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savedAnswers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `savedAnswers/${id}`);
    }
  };

  const filteredAnswers = savedAnswers.filter((item) => {
    const text = `${item.queryTitle} ${item.categoryName} ${item.expertName} ${item.answerText}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {/* Informative Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-pink-600" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Permanently Saved Answers
            </h1>
            <span className="text-[10px] font-bold bg-pink-50 text-pink-700 px-2 py-0.5 rounded border border-pink-100">
              Permanent Retention
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Answers bookmarked here are saved for quick reference in your knowledge library.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved answers..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Answers Grid */}
      <div className="space-y-4">
        {filteredAnswers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-xs text-slate-400 flex flex-col items-center">
            <Bookmark className="w-8 h-8 text-slate-300 mb-2" />
            <p>You haven't saved any answers yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Click the bookmark button in any query conversation to save helpful responses here.
            </p>
          </div>
        ) : (
          filteredAnswers.map((ans) => (
            <div
              key={ans.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-pink-800 bg-pink-100/70 px-2 py-0.5 rounded">
                      {ans.categoryName}
                    </span>
                    <span>·</span>
                    <span>
                      Advisor: <strong className="text-slate-800">{ans.expertName}</strong>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{ans.queryTitle}</h3>
                </div>

                <button
                  onClick={() => handleRemove(ans.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove from saved answers"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Question summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 block text-[11px] mb-1">
                  Original Student Question:
                </span>
                <p className="line-clamp-2 italic">
                  <LinkifiedText text={ans.questionText || ''} />
                </p>
              </div>

              {/* Saved Expert Answer */}
              <div className="p-4 rounded-xl bg-pink-50/60 border border-pink-100 text-xs text-slate-800 leading-relaxed">
                <span className="font-bold text-pink-900 block text-[11px] mb-1">
                  Verified Guidance:
                </span>
                <p className="whitespace-pre-wrap">
                  <LinkifiedText text={ans.answerText || ''} />
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span className="tabular-nums">
                  Saved on {new Date(ans.savedAt).toLocaleDateString()} at{' '}
                  {new Date(ans.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>

                {onOpenQueryDetail && ans.queryId && (
                  <button
                    onClick={() => onOpenQueryDetail(ans.queryId)}
                    className="text-xs text-pink-600 hover:text-pink-800 font-medium cursor-pointer"
                  >
                    View Original Conversation →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
