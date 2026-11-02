import React, { useState, useEffect } from 'react';
import { DriveConfig } from '../../types';
import { getDriveConfig, updateDriveConfig, extractDriveFolderId } from '../../lib/driveService';
import { errorMessage } from '../../lib/api';
import {
  FolderGit2,
  X,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  HardDrive,
  Info,
  AlertCircle,
} from 'lucide-react';

interface SuperAdminDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: DriveConfig) => void;
}

export const SuperAdminDriveModal: React.FC<SuperAdminDriveModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [folderUrl, setFolderUrl] = useState('');
  const [folderName, setFolderName] = useState('Career Code Knowledge Base');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    setLoading(true);
    getDriveConfig()
      .then((cfg) => {
        if (cfg) {
          setFolderUrl(cfg.rootFolderUrl || cfg.rootFolderId || '');
          setFolderName(cfg.rootFolderName || 'Career Code Knowledge Base');
        }
      })
      .catch((err) => {
        setStatusMsg({ type: 'error', text: errorMessage(err, 'Could not load the current Drive configuration.') });
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderUrl.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a Google Drive folder link or folder ID.' });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    const folderId = extractDriveFolderId(folderUrl);
    // The server verifies the folder is public and returns the saved config.
    const res = await updateDriveConfig({
      rootFolderId: folderId,
      rootFolderName: folderName.trim() || 'Career Code Knowledge Base',
    });
    setSaving(false);

    if (res.success && res.config) {
      setStatusMsg({ type: 'success', text: 'Google Drive root folder successfully connected and updated!' });
      if (onConfigSaved) {
        onConfigSaved(res.config);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to update Google Drive configuration.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-modal-pop">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-xs shadow-pink-200 shrink-0">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Google Drive Connection</h3>
              <p className="text-xs text-slate-500">
                Connect Career Code's central guidance Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading Drive settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Google Drive Root Folder Link or ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1aBcDeFgHi..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1 leading-normal">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Make sure the Google Drive folder permission is set to <strong>"Anyone with the link can view"</strong> so students can browse files freely.
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Drive Display Name
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Career Code Knowledge Base"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all"
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-pink-600" />
                <span>Real-Time Sync Status</span>
              </div>
              <span className="text-pink-700 font-semibold bg-pink-50 px-2 py-0.5 rounded-md border border-pink-200 text-[11px]">
                Active & Connected
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-pink-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save & Connect Drive'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
