import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DriveItem, DriveConfig } from '../../types';
import {
  fetchDriveFolderContents,
  getDriveConfig,
  formatFileSize,
} from '../../lib/driveService';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { DriveFilePreviewModal } from './DriveFilePreviewModal';
import { SuperAdminDriveModal } from './SuperAdminDriveModal';
import {
  Folder,
  FileText,
  Mic,
  Image as ImageIcon,
  ExternalLink,
  Search,
  RefreshCw,
  ChevronRight,
  HardDrive,
  Eye,
  Settings,
  ArrowLeft,
  Share2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export const DriveExplorer: React.FC = () => {
  const { userProfile } = useAuth();
  const [driveConfig, setDriveConfig] = useState<DriveConfig | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 'missing' = no Drive root has been configured yet.
  const [configState, setConfigState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [configError, setConfigError] = useState<string>('');
  const [folderError, setFolderError] = useState<string>('');
  // Incremented per folder request so a slow, older response can't overwrite a newer folder.
  const folderRequestSeq = useRef(0);

  const isSuperAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'expert_admin';

  // Load the configured Drive root on mount
  const loadConfig = () => {
    let isMounted = true;
    setLoading(true);
    setConfigError('');
    setConfigState('loading');

    getDriveConfig()
      .then((cfg) => {
        if (!isMounted) return;
        setDriveConfig(cfg);
        if (!cfg || !cfg.rootFolderId) {
          setConfigState('missing');
          setLoading(false);
          return;
        }
        setConfigState('ready');
        const rootId = cfg.rootFolderId;
        const rootName = cfg.rootFolderName || 'Career Code Data';

        // Check if history already has a folder state (e.g. from popstate or restore)
        const curState = (typeof window !== 'undefined' ? window.history?.state : null) as any;
        if (
          curState?.type === 'drive_folder' &&
          curState?.tab === 'drive' &&
          curState?.driveFolderId &&
          curState?.driveBreadcrumbs
        ) {
          setCurrentFolderId(curState.driveFolderId);
          setBreadcrumbs(curState.driveBreadcrumbs);
        } else {
          setCurrentFolderId(rootId);
          setBreadcrumbs([{ id: rootId, name: rootName }]);
        }
      })
      .catch((err) => {
        console.error('Error fetching drive configuration:', err);
        if (isMounted) {
          setConfigState('error');
          setConfigError(errorMessage(err, 'Could not load the Drive configuration.'));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => loadConfig(), []);

  // Sync with browser / mobile back button (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. If preview modal is open, close it without changing folder
      if (previewItem) {
        setPreviewItem(null);
        return;
      }

      // 2. If config modal is open, close it
      if (showConfigModal) {
        setShowConfigModal(false);
        return;
      }

      const state = e.state as any;

      // 3. Handle drive folder transitions inside drive tab
      if (state && state.tab === 'drive') {
        if (state.type === 'drive_folder' && state.driveFolderId && state.driveBreadcrumbs) {
          setCurrentFolderId(state.driveFolderId);
          setBreadcrumbs(state.driveBreadcrumbs);
          setSearchQuery('');
        } else if ((state.level === 1 || !state.driveFolderId) && driveConfig?.rootFolderId) {
          // Popped back to root Drive folder
          const rootId = driveConfig.rootFolderId;
          const rootName = driveConfig.rootFolderName || 'Career Code Data';
          setCurrentFolderId(rootId);
          setBreadcrumbs([{ id: rootId, name: rootName }]);
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [previewItem, showConfigModal, driveConfig]);

  // Fetch contents whenever current folder changes
  const loadFolderContents = async (folderId: string, isManualRefresh = false) => {
    const requestId = ++folderRequestSeq.current;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFolderError('');

    try {
      const res = await fetchDriveFolderContents(folderId, isManualRefresh);
      if (requestId !== folderRequestSeq.current) return; // a newer folder was requested
      setItems(res.items);
      // Update root folder name in breadcrumbs if at root
      if (res.folderName) {
        setBreadcrumbs((prev) => {
          if (prev.length === 1 && prev[0].name !== res.folderName) {
            return [{ id: prev[0].id, name: res.folderName }];
          }
          return prev;
        });
      }
    } catch (err) {
      if (requestId !== folderRequestSeq.current) return;
      console.error('Failed to load drive contents:', err);
      setItems([]);
      setFolderError(errorMessage(err, 'Could not load this Drive folder.'));
    } finally {
      if (requestId === folderRequestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!currentFolderId) return;
    loadFolderContents(currentFolderId);
  }, [currentFolderId]);

  // Handle folder drill-down with history pushState
  const handleOpenFolder = (folder: DriveItem) => {
    const nextBreadcrumbs = [...breadcrumbs, { id: folder.id, name: folder.name }];
    setCurrentFolderId(folder.id);
    setBreadcrumbs(nextBreadcrumbs);
    setSearchQuery('');

    // Push new history state for this subfolder level
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(
        {
          level: 2,
          type: 'drive_folder',
          tab: 'drive',
          driveFolderId: folder.id,
          driveFolderName: folder.name,
          driveBreadcrumbs: nextBreadcrumbs,
          driveDepth: nextBreadcrumbs.length,
        },
        ''
      );
    }
  };

  // Handle breadcrumb click
  const handleNavigateBreadcrumb = (index: number) => {
    if (index >= breadcrumbs.length - 1) return; // Already at this crumb
    const delta = (breadcrumbs.length - 1) - index;

    // If currently on a drive_folder history state, step back in history
    if (typeof window !== 'undefined' && window.history?.state?.type === 'drive_folder' && delta > 0) {
      window.history.go(-delta);
    } else {
      const target = breadcrumbs[index];
      if (!target) return;
      const nextCrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(nextCrumbs);
      setCurrentFolderId(target.id);
      setSearchQuery('');

      if (typeof window !== 'undefined' && window.history) {
        if (index === 0) {
          window.history.replaceState({ level: 1, type: 'tab', tab: 'drive' }, '');
        } else {
          window.history.replaceState(
            {
              level: 2,
              type: 'drive_folder',
              tab: 'drive',
              driveFolderId: target.id,
              driveFolderName: target.name,
              driveBreadcrumbs: nextCrumbs,
              driveDepth: nextCrumbs.length,
            },
            ''
          );
        }
      }
    }
  };

  // Back one folder level
  const handleBackOneLevel = () => {
    if (breadcrumbs.length <= 1) return;

    if (typeof window !== 'undefined' && window.history?.state?.type === 'drive_folder') {
      window.history.back();
    } else {
      handleNavigateBreadcrumb(breadcrumbs.length - 2);
    }
  };

  // Open Preview Modal with history state so device back button closes modal cleanly
  const handleOpenPreview = (item: DriveItem) => {
    setPreviewItem(item);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(
        {
          level: 2,
          type: 'modal',
          modalId: 'drive_preview',
          tab: 'drive',
          driveFolderId: currentFolderId,
          driveBreadcrumbs: breadcrumbs,
        },
        ''
      );
    }
  };

  // Close Preview Modal
  const handleClosePreview = () => {
    setPreviewItem(null);
    if (typeof window !== 'undefined' && window.history?.state?.modalId === 'drive_preview') {
      window.history.back();
    }
  };

  // Super Admin Config Modal helpers
  const handleOpenConfig = () => {
    setShowConfigModal(true);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(
        {
          level: 2,
          type: 'modal',
          modalId: 'drive_config',
          tab: 'drive',
        },
        ''
      );
    }
  };

  const handleCloseConfig = () => {
    setShowConfigModal(false);
    if (typeof window !== 'undefined' && window.history?.state?.modalId === 'drive_config') {
      window.history.back();
    }
  };

  // Copy share link
  const handleCopyLink = (item: DriveItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(item.webViewLink);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter items based on user search query only (no static category chips)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const filteredFolders = useMemo(() => {
    return filteredItems.filter((i) => i.type === 'folder');
  }, [filteredItems]);

  const filteredFiles = useMemo(() => {
    return filteredItems.filter((i) => i.type !== 'folder');
  }, [filteredItems]);

  return (
    <div className="max-w-6xl mx-auto space-y-3.5 sm:space-y-4 pb-12 px-1 sm:px-0">
      {/* Top Header Card - Career Code Pink Theme */}
      <div className="bg-white border border-pink-100/80 rounded-2xl p-3.5 sm:p-5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-700 text-white flex items-center justify-center shadow-xs shadow-pink-200 shrink-0">
            <HardDrive className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight break-words">
                Career Code Drive
              </h1>
              <span className="text-[9px] sm:text-[10px] font-bold text-pink-700 bg-pink-50 border border-pink-200 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                Live Drive
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 break-words">
              Google Drive guidance files, roadmaps, syllabi & audio notes.
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Refresh / Sync Button */}
          <button
            type="button"
            onClick={() => {
              if (currentFolderId) loadFolderContents(currentFolderId, true);
            }}
            disabled={refreshing || loading || !currentFolderId}
            className="p-2 text-slate-500 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors cursor-pointer border border-slate-200"
            title="Sync latest files from Google Drive"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-pink-600' : ''}`} />
          </button>

          {/* Super Admin Drive Folder Config */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenConfig}
              className="px-2.5 sm:px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configure Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Breadcrumb & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-xs flex-nowrap">
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={handleBackOneLevel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200/80 rounded-xl transition-all cursor-pointer mr-1.5 shrink-0 shadow-2xs active:scale-95"
                title="Go back to previous folder"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Back</span>
              </button>
            )}

            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => handleNavigateBreadcrumb(idx)}
                    className={`font-semibold shrink-0 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs ${
                      isLast
                        ? 'text-pink-900 bg-pink-50 font-bold border border-pink-200/60'
                        : 'text-slate-500 hover:text-pink-700 hover:bg-pink-50'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files in this folder..."
              className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      {configState === 'missing' ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
          <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800 text-sm">Google Drive isn't set up yet</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto text-xs">
            {isSuperAdmin
              ? 'Connect a public Google Drive folder to share guidance files, roadmaps and audio notes here.'
              : 'Guidance files will appear here once an administrator connects the Career Code Drive folder.'}
          </p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenConfig}
              className="mt-4 px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure Drive</span>
            </button>
          )}
        </div>
      ) : configState === 'error' ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-2xl border border-rose-200 p-6 sm:p-8">
          <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800 text-sm">Couldn't connect to Career Code Drive</p>
          <p className="text-rose-600 mt-1 max-w-sm mx-auto text-xs">{configError}</p>
          <button
            type="button"
            onClick={() => loadConfig()}
            className="mt-4 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      ) : loading || !currentFolderId ? (
        <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-pink-600 mb-2" />
          <span>Connecting to Career Code Drive...</span>
        </div>
      ) : folderError ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-2xl border border-rose-200 p-6 sm:p-8">
          <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800 text-sm">Couldn't load this folder</p>
          <p className="text-rose-600 mt-1 max-w-sm mx-auto text-xs">{folderError}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={handleBackOneLevel}
                className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => currentFolderId && loadFolderContents(currentFolderId, true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
          <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800 text-sm">No files or subfolders found</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto text-xs">
            {searchQuery
              ? `No resources matched "${searchQuery}". Try a different keyword.`
              : 'This folder is currently empty. Add resources to this folder in Google Drive and click Refresh to view them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {/* Quick Back to Parent Folder Banner (Visible on all devices when inside a subfolder) */}
          {breadcrumbs.length > 1 && (
            <button
              type="button"
              onClick={handleBackOneLevel}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-pink-50/70 hover:bg-pink-100/80 border border-pink-200/80 rounded-2xl text-xs text-pink-900 transition-all cursor-pointer active:scale-[0.99] group shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-pink-200/80 text-pink-800 flex items-center justify-center shrink-0 group-hover:bg-pink-300 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-[10px] text-pink-600 block font-semibold leading-tight">Previous Folder</span>
                  <span className="font-bold text-xs truncate block text-slate-800">
                    {breadcrumbs[breadcrumbs.length - 2]?.name || 'Go back to parent folder'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full shrink-0">
                Tap to return
              </span>
            </button>
          )}

          {/* Subfolders Section */}
          {filteredFolders.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-pink-600" />
                  Folders ({filteredFolders.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredFolders.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleOpenFolder(f)}
                    className="group bg-white border border-slate-200 hover:border-pink-300 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all hover:shadow-md cursor-pointer flex items-start justify-between gap-3 active:scale-[0.99] min-h-[76px]"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors mt-0.5">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm break-words whitespace-normal leading-snug group-hover:text-pink-700 transition-colors">
                          {f.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <span>Open folder</span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-pink-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {filteredFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Files & Guidance Documents ({filteredFiles.length})
                </h2>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
                {filteredFiles.map((item) => {
                  const isPdf = item.type === 'pdf';
                  const isAudio = item.type === 'audio';
                  const isImage = item.type === 'image';

                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-4 hover:bg-pink-50/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div
                        onClick={() => handleOpenPreview(item)}
                        className="flex items-start gap-3 min-w-0 cursor-pointer flex-1"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isPdf
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : isAudio
                              ? 'bg-pink-50 text-pink-600 border border-pink-100'
                              : isImage
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-pink-50 text-pink-600 border border-pink-100'
                          }`}
                        >
                          {isPdf ? (
                            <FileText className="w-4 h-4" />
                          ) : isAudio ? (
                            <Mic className="w-4 h-4" />
                          ) : isImage ? (
                            <ImageIcon className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-xs sm:text-sm hover:text-pink-700 transition-colors break-words whitespace-normal leading-snug">
                              {item.name}
                            </h3>
                            {item.categoryTag && (
                              <span className="text-[10px] font-semibold text-pink-700 bg-pink-50 border border-pink-100 px-2 py-0.2 rounded-md">
                                {item.categoryTag}
                              </span>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            {item.size && item.size > 0 && <span>{formatFileSize(item.size)}</span>}
                            <span>• {isAudio ? 'Voice Message' : 'Drive Document'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Fully Mobile Friendly */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-stretch sm:self-center justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(item)}
                          className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Preview in app"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 sm:px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs shadow-pink-100 transition-colors cursor-pointer"
                          title="Open directly in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Drive</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          className="p-1.5 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                          title="Copy share link"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-4 h-4 text-pink-600" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* In-App File Preview Modal */}
      <DriveFilePreviewModal item={previewItem} onClose={handleClosePreview} />

      {/* Super Admin Drive Config Modal */}
      <SuperAdminDriveModal
        isOpen={showConfigModal}
        onClose={handleCloseConfig}
        onConfigSaved={(cfg) => {
          setDriveConfig(cfg);
          if (cfg.rootFolderId) {
            setConfigState('ready');
            setConfigError('');
            setCurrentFolderId(cfg.rootFolderId);
            setBreadcrumbs([{ id: cfg.rootFolderId, name: cfg.rootFolderName || 'Drive' }]);
            loadFolderContents(cfg.rootFolderId, true);
          }
        }}
      />
    </div>
  );
};
