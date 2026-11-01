import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { subscribeToQuotaExceeded, FIRESTORE_UPGRADE_URL, isQuotaExceeded } from '../../lib/firestoreErrors';

export const QuotaNoticeBanner: React.FC = () => {
  const [exceeded, setExceeded] = useState(isQuotaExceeded());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return subscribeToQuotaExceeded((status) => {
      setExceeded(status);
    });
  }, []);

  if (!exceeded || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-4 py-2.5 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="p-1 bg-white/20 rounded-md shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-100" />
          </div>
          <p className="font-medium text-amber-50 leading-snug">
            <strong className="text-white font-bold">Cloud Quota Limit Reached:</strong> Firestore free-tier daily read units are exhausted. The app is serving cached local data. Quota resets daily at midnight PT.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <a
            href={FIRESTORE_UPGRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-900 font-semibold rounded-lg text-xs hover:bg-amber-50 transition-colors shadow-xs"
          >
            Upgrade in Firebase Console
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss quota notice"
            className="p-1 hover:bg-white/20 rounded-md text-amber-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
