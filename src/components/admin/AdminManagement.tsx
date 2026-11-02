import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { useApiResource, useLiveQueries } from '../../lib/liveData';
import { onDataChanged } from '../../lib/socket';
import { UserProfile, CategoryItem, formatRoleName } from '../../types';
import { sortCategoriesGeneralFirst } from '../../constants/officialCategories';
import { CustomSelect } from '../common/CustomSelect';
import {
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  X,
  Edit2,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  GraduationCap,
} from 'lucide-react';

const ADMIN_ROLES = ['normal_admin', 'expert_admin', 'super_admin'];
const MIN_PASSWORD_LENGTH = 8;
const REPLIES_REFRESH_MS = 60_000;

/** Account status with a safe default for records missing the field. */
const statusOf = (u: Pick<UserProfile, 'status'>) => u.status || 'active';

export const AdminManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isExpertAdmin = userProfile?.role === 'expert_admin';
  const isManager = isSuperAdmin || isExpertAdmin;

  /** Whether the viewer may manage another account (mirrors the server's canManageUser; never self). */
  const canManageUser = (target: UserProfile) =>
    target.uid !== userProfile?.uid &&
    (isSuperAdmin || (isExpertAdmin && (target.role === 'normal_admin' || target.role === 'student')));

  const { data: adminDirectory, setData: setAdminDirectory } = useApiResource<UserProfile[]>(
    '/admins',
    ['users'],
    []
  );
  const admins = useMemo(() => adminDirectory.filter((u) => ADMIN_ROLES.includes(u.role)), [adminDirectory]);
  const { data: rawCategories } = useApiResource<CategoryItem[]>('/categories', ['categories'], []);
  const categories = useMemo(() => sortCategoriesGeneralFirst(rawCategories), [rawCategories]);
  // All tickets, for accurate workload counts (managers only).
  const { queries } = useLiveQueries({ scope: 'all', enabled: isManager });
  const [replies24h, setReplies24h] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState<'normal_admin' | 'expert_admin'>('normal_admin');
  const [modalName, setModalName] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalPass, setModalPass] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalCategories, setModalCategories] = useState<string[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Deactivation / Reassignment state
  const [deactivatingAdmin, setDeactivatingAdmin] = useState<UserProfile | null>(null);
  const [reassignTargetExpertId, setReassignTargetExpertId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // View & Edit Profile state
  const [viewingProfileAdmin, setViewingProfileAdmin] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileRole, setProfileRole] = useState<'normal_admin' | 'expert_admin' | 'super_admin'>('normal_admin');
  const [profileCategories, setProfileCategories] = useState<string[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Change Password state
  const [passwordAdmin, setPasswordAdmin] = useState<UserProfile | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Permanent Delete state
  const [deletingAdmin, setDeletingAdmin] = useState<UserProfile | null>(null);
  const [deleteReassignTarget, setDeleteReassignTarget] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Replies per admin in the last rolling 24 hours (server-side aggregate).
  const loadReplies24h = useCallback(async () => {
    if (!isManager) return;
    try {
      setReplies24h(await api.get<Record<string, number>>('/admin/stats/replies-24h'));
    } catch {
      // Non-critical column; keep the last known counts.
    }
  }, [isManager]);

  useEffect(() => {
    loadReplies24h();
    const timer = window.setInterval(loadReplies24h, REPLIES_REFRESH_MS);
    const off = onDataChanged(['users'], loadReplies24h);
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, [loadReplies24h]);

  const showNotice = (message: string) => {
    setActionNotice(message);
    setTimeout(() => setActionNotice(null), 5000);
  };

  /** Replaces an admin in the local directory with the server's copy. */
  const applyProfile = (profile: UserProfile) => {
    setAdminDirectory((prev) => prev.map((a) => (a.uid === profile.uid ? { ...a, ...profile } : a)));
  };

  // Activity calculation helper
  const getActivityIndicator = (lastActiveAt?: number) => {
    if (!lastActiveAt) return { label: 'Inactive for > 24 hours', isStale: true };
    const diffMs = Date.now() - lastActiveAt;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 5 * 60 * 1000) {
      return { label: 'Active now', isStale: false };
    } else if (diffHours < 1) {
      return { label: `Active ${Math.floor(diffMs / 60000)} min ago`, isStale: false };
    } else if (diffHours < 24) {
      return { label: `Active ${Math.floor(diffHours)} hours ago`, isStale: false };
    } else if (diffHours < 48) {
      return { label: 'Inactive for 24 hours', isStale: true };
    } else {
      const days = Math.floor(diffHours / 24);
      return { label: `Inactive for ${days} days`, isStale: true };
    }
  };

  // Creation of Admin through backend API
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!modalName.trim() || !modalEmail.trim() || !modalPass) {
      setModalError('Please fill in all required fields.');
      return;
    }

    if (modalPass.length < MIN_PASSWORD_LENGTH) {
      setModalError(`Initial password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (createRole === 'expert_admin' && !isSuperAdmin) {
      setModalError('Only a Super Admin can create Expert Admin accounts.');
      return;
    }

    setModalLoading(true);
    try {
      const name = modalName.trim();
      await api.post<{ success: boolean; profile: UserProfile }>('/admin/admins', {
        email: modalEmail.trim(),
        password: modalPass,
        displayName: name,
        role: createRole,
        professionalTitle: modalTitle.trim() || undefined,
        shortDescription: modalDesc.trim() || undefined,
        phoneNumber: modalPhone.trim() || undefined,
        assignedCategories: modalCategories,
      });

      setShowCreateModal(false);
      setModalName('');
      setModalEmail('');
      setModalPass('');
      setModalPhone('');
      setModalTitle('');
      setModalDesc('');
      setModalCategories([]);
      showNotice(`Account created for ${name}. They must choose a new password the first time they sign in.`);
    } catch (err) {
      setModalError(errorMessage(err, 'Failed to create admin.'));
    } finally {
      setModalLoading(false);
    }
  };

  // Deactivation: the server hands open queries to the chosen admin, or moves
  // them to the unassigned queue when no admin is chosen.
  const handleConfirmDeactivation = async () => {
    if (!deactivatingAdmin) return;
    setReassignLoading(true);
    setDeactivateError(null);
    try {
      const { profile, reassignedCount } = await api.patch<{ profile: UserProfile; reassignedCount: number }>(
        `/admin/users/${encodeURIComponent(deactivatingAdmin.uid)}/status`,
        { status: 'deactivated', reassignToUid: reassignTargetExpertId || undefined }
      );
      applyProfile(profile);
      showNotice(
        `${deactivatingAdmin.displayName} has been deactivated.${
          reassignedCount
            ? ` ${reassignedCount} open ${reassignedCount === 1 ? 'query was' : 'queries were'} handed over.`
            : ''
        }`
      );
      setDeactivatingAdmin(null);
      setReassignTargetExpertId('');
    } catch (err) {
      setDeactivateError(errorMessage(err, 'Could not deactivate this administrator.'));
    } finally {
      setReassignLoading(false);
    }
  };

  const handleReactivate = async (adm: UserProfile) => {
    setActionError(null);
    try {
      const { profile } = await api.patch<{ profile: UserProfile }>(
        `/admin/users/${encodeURIComponent(adm.uid)}/status`,
        { status: 'active' }
      );
      applyProfile(profile);
      showNotice(`${adm.displayName} has been reactivated.`);
    } catch (err) {
      setActionError(errorMessage(err, 'Could not reactivate this administrator.'));
    }
  };

  /** Deactivate opens the hand-over dialog; Reactivate applies immediately. */
  const handleStatusButton = (adm: UserProfile) => {
    if (statusOf(adm) === 'active') {
      setDeactivateError(null);
      setReassignTargetExpertId('');
      setDeactivatingAdmin(adm);
    } else {
      handleReactivate(adm);
    }
  };

  // Open Admin Profile Modal
  const handleOpenProfileModal = (adm: UserProfile) => {
    setViewingProfileAdmin(adm);
    setIsEditingProfile(false);
    setProfileName(adm.displayName || '');
    setProfileTitle(adm.professionalTitle || '');
    setProfileDesc(adm.shortDescription || '');
    setProfilePhone(adm.phoneNumber || '');
    setProfileRole(
      adm.role === 'super_admin'
        ? 'super_admin'
        : adm.role === 'expert_admin'
        ? 'expert_admin'
        : 'normal_admin'
    );
    setProfileCategories(adm.assignedCategories || []);
    setProfileError(null);
    setProfileSuccess(null);
  };

  // Save Admin Profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingProfileAdmin) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updatesPayload: Record<string, unknown> = {
        displayName: profileName.trim(),
        professionalTitle: profileTitle.trim(),
        shortDescription: profileDesc.trim(),
        phoneNumber: profilePhone.trim(),
      };

      // Category assignments are granted by managers only, never by a normal admin to themselves.
      if (isManager) {
        updatesPayload.assignedCategories = profileCategories;
      }

      if (isSuperAdmin && viewingProfileAdmin.role !== 'super_admin') {
        updatesPayload.role = profileRole;
      }

      const { profile } = await api.patch<{ success: boolean; profile: UserProfile }>(
        `/admin/admins/${encodeURIComponent(viewingProfileAdmin.uid)}`,
        updatesPayload
      );

      applyProfile(profile);
      setProfileSuccess('Administrator profile updated successfully.');
      setIsEditingProfile(false);
      setViewingProfileAdmin((prev) => (prev ? { ...prev, ...profile } : null));
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err) {
      setProfileError(errorMessage(err, 'Failed to update profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  // Reset another administrator's password (they must change it at next sign-in)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordAdmin) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newAdminPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPasswordLoading(true);
    try {
      await api.put(`/admin/users/${encodeURIComponent(passwordAdmin.uid)}/password`, {
        newPassword: newAdminPassword,
      });

      setPasswordSuccess(
        `Password updated for ${passwordAdmin.displayName}. They have been signed out and must change it at their next sign-in.`
      );
      setTimeout(() => {
        setPasswordAdmin(null);
        setNewAdminPassword('');
        setPasswordSuccess(null);
      }, 2500);
    } catch (err) {
      setPasswordError(errorMessage(err, 'Error updating administrator password.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Permanently Delete Administrator (server hands open queries over or to the unassigned queue)
  const handleConfirmDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const qs = deleteReassignTarget ? `?reassignToUid=${encodeURIComponent(deleteReassignTarget)}` : '';
      const { message } = await api.del<{ success: boolean; message: string }>(
        `/admin/admins/${encodeURIComponent(deletingAdmin.uid)}${qs}`
      );

      // Update local state immediately
      setAdminDirectory((prev) => prev.filter((a) => a.uid !== deletingAdmin.uid));
      setDeletingAdmin(null);
      setDeleteReassignTarget('');
      showNotice(message || `Administrator ${deletingAdmin.displayName} permanently deleted.`);
    } catch (err) {
      setDeleteError(errorMessage(err, 'Error deleting administrator account.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredAdmins = admins.filter((a) => {
    const text = `${a.displayName} ${a.email} ${a.professionalTitle} ${a.phoneNumber}`.toLowerCase();
    if (!text.includes(searchQuery.toLowerCase())) return false;
    if (filterRole !== 'all' && a.role !== filterRole) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Administrator Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor admin workloads, 24-hour activity signals, response counts, and role assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Admin */}
          <button
            onClick={() => {
              setCreateRole('normal_admin');
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs shadow-pink-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Create Admin
          </button>

          {/* Create Expert Admin */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                setCreateRole('expert_admin');
                setShowCreateModal(true);
              }}
              className="px-3.5 py-2 bg-pink-700 hover:bg-pink-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs shadow-pink-200 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Create Expert Admin
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div className="min-w-[150px]">
          <CustomSelect
            value={filterRole}
            onChange={(val) => setFilterRole(val)}
            options={[
              { value: 'all', label: 'All Admin Roles' },
              { value: 'super_admin', label: 'Expert Admins (Super)' },
              { value: 'expert_admin', label: 'Expert Admins' },
              { value: 'normal_admin', label: 'Admins' },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* Admin Table (Desktop / Tablet) & Card List (Mobile) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* DESKTOP & TABLET TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Admin Profile</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Categories</th>
                <th className="py-3 px-4 text-center">Replies (Last 24h)</th>
                <th className="py-3 px-4 text-center">Pending Queries</th>
                <th className="py-3 px-4 text-center">Resolved</th>
                <th className="py-3 px-4">Activity Status</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    No administrators found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((adm) => {
                  const activity = getActivityIndicator(adm.lastActiveAt);
                  const repliesLast24h = replies24h[adm.uid] || 0;
                  const adminQueries = queries.filter((q) => q.expertId === adm.uid);
                  const pendingCount = adminQueries.filter((q) => q.status === 'open' || q.status === 'in_progress').length;
                  const resolvedCount = adminQueries.filter((q) => q.status === 'resolved').length;

                  // Permission flags: Super Admin manages all others, Expert Admin manages Normal Admins
                  const canManageThisAdmin = canManageUser(adm);

                  return (
                    <tr key={adm.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {adm.displayName ? adm.displayName.charAt(0) : 'A'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{adm.displayName}</p>
                            <p className="text-[11px] text-slate-500">{adm.email}</p>
                            {adm.phoneNumber && (
                              <p className="text-[10px] text-slate-400 tabular-nums">{adm.phoneNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            adm.role === 'super_admin'
                              ? 'bg-purple-50 text-purple-700'
                              : adm.role === 'expert_admin'
                              ? 'bg-pink-50 text-pink-700 border border-pink-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {formatRoleName(adm.role).toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        {adm.assignedCategories && adm.assignedCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {adm.assignedCategories.map((cId) => {
                              const c = categories.find((cat) => cat.id === cId);
                              return (
                                <span
                                  key={cId}
                                  className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[120px]"
                                >
                                  {c ? c.name.split('(')[0] : cId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">All / Unrestricted</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center tabular-nums font-semibold text-slate-800">
                        {repliesLast24h}
                      </td>

                      <td className="py-3 px-4 text-center tabular-nums font-semibold text-amber-600">
                        {pendingCount}
                      </td>

                      <td className="py-3 px-4 text-center tabular-nums font-semibold text-emerald-600">
                        {resolvedCount}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {activity.isStale ? (
                          <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-1 rounded-md text-[11px] font-medium border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{activity.label}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{activity.label}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            statusOf(adm) === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {statusOf(adm).toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Profile */}
                          <button
                            type="button"
                            onClick={() => handleOpenProfileModal(adm)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-pink-600 bg-slate-100 hover:bg-pink-50 px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
                            title="View administrator profile"
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>Profile</span>
                          </button>

                          {/* Change Password */}
                          {canManageThisAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordAdmin(adm);
                                setNewAdminPassword('');
                                setPasswordError(null);
                                setPasswordSuccess(null);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-pink-600 bg-slate-100 hover:bg-pink-50 px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
                              title="Update Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Password</span>
                            </button>
                          )}

                          {/* Deactivate / Reactivate */}
                          {canManageThisAdmin && adm.role !== 'super_admin' && adm.uid !== userProfile?.uid && (
                            <button
                              type="button"
                              onClick={() => handleStatusButton(adm)}
                              className={`text-[11px] px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                                statusOf(adm) === 'active'
                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {statusOf(adm) === 'active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}

                          {/* Permanently Delete (Super Admin can delete ANY other admin; Expert Admin can delete normal admins) */}
                          {canManageThisAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingAdmin(adm);
                                  setDeleteReassignTarget('');
                                  setDeleteError(null);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
                                title="Permanently delete administrator account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE RESPONSIVE CARD VIEW (Visible only on < md screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredAdmins.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No administrators found matching criteria.
            </div>
          ) : (
            filteredAdmins.map((adm) => {
              const activity = getActivityIndicator(adm.lastActiveAt);
              const repliesLast24h = replies24h[adm.uid] || 0;
              const adminQueries = queries.filter((q) => q.expertId === adm.uid);
              const pendingCount = adminQueries.filter((q) => q.status === 'open' || q.status === 'in_progress').length;
              const resolvedCount = adminQueries.filter((q) => q.status === 'resolved').length;

              const canManageThisAdmin = canManageUser(adm);

              return (
                <div key={adm.uid} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                  {/* Top: Avatar, Name, Email, Role */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {adm.displayName ? adm.displayName.charAt(0) : 'A'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{adm.displayName}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{adm.email}</p>
                        {adm.phoneNumber && (
                          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{adm.phoneNumber}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        adm.role === 'super_admin'
                          ? 'bg-purple-50 text-purple-700'
                          : adm.role === 'expert_admin'
                          ? 'bg-pink-50 text-pink-700 border border-pink-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formatRoleName(adm.role).toUpperCase()}
                    </span>
                  </div>

                  {/* Categories chips */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Categories
                    </span>
                    {adm.assignedCategories && adm.assignedCategories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {adm.assignedCategories.map((cId) => {
                          const c = categories.find((cat) => cat.id === cId);
                          return (
                            <span
                              key={cId}
                              className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                            >
                              {c ? c.name.split('(')[0] : cId}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">All Categories</span>
                    )}
                  </div>

                  {/* Micro KPI row */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Replies (24h)</span>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">{repliesLast24h}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-600 uppercase font-bold block">Pending</span>
                      <span className="text-xs font-bold text-amber-700 tabular-nums">{pendingCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-600 uppercase font-bold block">Resolved</span>
                      <span className="text-xs font-bold text-emerald-700 tabular-nums">{resolvedCount}</span>
                    </div>
                  </div>

                  {/* Status & Activity */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        statusOf(adm) === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {statusOf(adm).toUpperCase()}
                    </span>

                    {activity.isStale ? (
                      <div className="inline-flex items-center gap-1 text-rose-700 text-[10px] font-medium">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        <span>{activity.label}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{activity.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons (Touch-friendly on mobile) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenProfileModal(adm)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-slate-700 hover:text-pink-600 bg-slate-100 hover:bg-pink-50 py-2 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Profile</span>
                    </button>

                    {canManageThisAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordAdmin(adm);
                          setNewAdminPassword('');
                          setPasswordError(null);
                          setPasswordSuccess(null);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-slate-700 hover:text-pink-600 bg-slate-100 hover:bg-pink-50 py-2 rounded-xl font-semibold transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Password</span>
                      </button>
                    )}

                    {canManageThisAdmin && adm.role !== 'super_admin' && adm.uid !== userProfile?.uid && (
                      <button
                        type="button"
                        onClick={() => handleStatusButton(adm)}
                        className={`px-3 py-2 text-xs rounded-xl font-semibold transition-colors cursor-pointer ${
                          statusOf(adm) === 'active'
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {statusOf(adm) === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}

                    {canManageThisAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingAdmin(adm);
                          setDeleteReassignTarget('');
                          setDeleteError(null);
                        }}
                        className="inline-flex items-center justify-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE ADMIN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-pop-in max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Create {createRole === 'expert_admin' ? 'Expert Admin' : 'Admin'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Dr. Haris Khan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="advisor@preptitans.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={modalPass}
                  onChange={(e) => setModalPass(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Professional Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Senior Medical Admissions Counselor"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Brief credentials shown to students during expert selection..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Categories</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-pink-50/50 rounded">
                      <input
                        type="checkbox"
                        checked={modalCategories.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalCategories((prev) => [...prev, c.id]);
                          } else {
                            setModalCategories((prev) => prev.filter((id) => id !== c.id));
                          }
                        }}
                        className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                      />
                      <span className="text-slate-800">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 font-semibold shadow-xs shadow-pink-200 disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATION & QUERY REASSIGNMENT MODAL */}
      {deactivatingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs animate-pop-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Deactivate Administrator
            </h3>
            <p className="text-slate-600 mb-4">
              You are about to deactivate{' '}
              <strong className="text-slate-900">{deactivatingAdmin.displayName}</strong>.
            </p>

            {/* Check outstanding queries */}
            {(() => {
              const pendingCount = queries.filter(
                (q) => q.expertId === deactivatingAdmin.uid && q.status !== 'resolved'
              ).length;

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <span className="font-bold block">
                      {pendingCount} Outstanding / Open Queries
                    </span>
                    This administrator currently has {pendingCount} queries awaiting handling.
                  </div>

                  {deactivateError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{deactivateError}</span>
                    </div>
                  )}

                  {pendingCount > 0 && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Reassign Open Queries To:
                      </label>
                      <CustomSelect
                        value={reassignTargetExpertId}
                        onChange={(val) => setReassignTargetExpertId(val)}
                        options={[
                          { value: '', label: 'Do not reassign (Leave in unassigned queue)' },
                          ...admins
                            .filter((a) => a.uid !== deactivatingAdmin.uid && statusOf(a) === 'active')
                            .map((a) => ({
                              value: a.uid,
                              label: a.displayName || 'Advisor',
                              sublabel: formatRoleName(a.role),
                            })),
                        ]}
                        size="sm"
                        searchable
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeactivatingAdmin(null)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={reassignLoading}
                      onClick={handleConfirmDeactivation}
                      className="px-4 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-semibold disabled:opacity-50"
                    >
                      {reassignLoading ? 'Processing...' : 'Confirm Deactivation'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CHANGE ADMIN PASSWORD MODAL */}
      {passwordAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Update Administrator Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {passwordAdmin.displayName} ({passwordAdmin.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordAdmin(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="mt-4 space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Password <span className="text-pink-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  The administrator is signed out everywhere and must choose a new password the next time they sign in with this one.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordAdmin(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {passwordLoading ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE ADMIN MODAL */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs animate-pop-in max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">
              Permanently Delete Administrator?
            </h3>
            <p className="text-slate-600 text-center mt-1">
              Are you sure you want to delete <strong className="text-slate-900">{deletingAdmin.displayName}</strong> ({deletingAdmin.email})?
            </p>
            {deletingAdmin.role === 'super_admin' && (
              <div className="bg-purple-50 text-purple-800 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-purple-200 mt-2 text-center">
                Super Admin Account: You have the executive authority to permanently delete this Super Admin.
              </div>
            )}
            <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-center mt-3">
              This action is permanent and completely removes the administrator account from the platform.
            </p>

            {deleteError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Check outstanding queries */}
            {(() => {
              const pendingCount = queries.filter(
                (q) => q.expertId === deletingAdmin.uid && q.status !== 'resolved'
              ).length;

              return (
                <div className="space-y-4 mt-4">
                  {pendingCount > 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <span className="font-bold block">
                        {pendingCount} Active Queries Assigned
                      </span>
                      Choose an active administrator to receive these queries, or leave them in the unassigned queue.
                      <div className="mt-2.5">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Reassign Queries To:
                        </label>
                        <CustomSelect
                          value={deleteReassignTarget}
                          onChange={(val) => setDeleteReassignTarget(val)}
                          options={[
                            { value: '', label: '-- Leave in unassigned queue --' },
                            ...admins
                              .filter((a) => a.uid !== deletingAdmin.uid && statusOf(a) === 'active')
                              .map((a) => ({
                                value: a.uid,
                                label: a.displayName || 'Advisor',
                                sublabel: formatRoleName(a.role),
                              })),
                          ]}
                          size="sm"
                          searchable
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center">
                      This administrator currently has 0 open queries.
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeletingAdmin(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLoading}
                      onClick={handleConfirmDeleteAdmin}
                      className="px-5 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {deleteLoading ? 'Deleting...' : 'Yes, Permanently Delete'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* VIEW & EDIT ADMIN PROFILE MODAL */}
      {viewingProfileAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 text-xs animate-pop-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {viewingProfileAdmin.displayName?.charAt(0) || 'A'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingProfileAdmin.displayName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-100 text-pink-700">
                      {formatRoleName(viewingProfileAdmin.role).toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        statusOf(viewingProfileAdmin) === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {statusOf(viewingProfileAdmin).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingProfileAdmin(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            {(canManageUser(viewingProfileAdmin) || viewingProfileAdmin.uid === userProfile?.uid) && (
              <div className="flex items-center gap-2 mt-3 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    !isEditingProfile
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Overview & Stats
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    isEditingProfile
                      ? 'bg-white text-pink-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isManager ? 'Edit Profile & Categories' : 'Edit Profile'}
                </button>
              </div>
            )}

            {profileError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {!isEditingProfile ? (
              <div className="mt-4 space-y-4">
                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Email Address</span>
                    <span className="font-semibold text-slate-900 truncate block">{viewingProfileAdmin.email}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Phone Number</span>
                    <span className="font-semibold text-slate-900">{viewingProfileAdmin.phoneNumber || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Professional Title</span>
                    <span className="font-semibold text-slate-900">{viewingProfileAdmin.professionalTitle || 'Academic Counselor'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Account Status</span>
                    <span className="font-semibold text-slate-900 capitalize">{statusOf(viewingProfileAdmin)}</span>
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Mentor Bio / Description</h4>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                    {viewingProfileAdmin.shortDescription || 'No description provided.'}
                  </p>
                </div>

                {/* Assigned Categories */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Assigned Counseling Categories</span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {viewingProfileAdmin.assignedCategories?.length || 0} categories
                    </span>
                  </h4>
                  {viewingProfileAdmin.assignedCategories && viewingProfileAdmin.assignedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                      {viewingProfileAdmin.assignedCategories.map((cId) => {
                        const c = categories.find((cat) => cat.id === cId);
                        return (
                          <span
                            key={cId}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-pink-200 text-pink-800 px-2.5 py-1 rounded-lg font-medium shadow-xs"
                          >
                            <ShieldCheck className="w-3 h-3 text-pink-600 shrink-0" />
                            {c ? c.name : cId}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px] p-2 bg-slate-50 rounded-lg">
                      No specific categories assigned.
                    </p>
                  )}
                </div>

                {/* Workload Stats */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1.5">Query Workload Statistics</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total</span>
                      <span className="text-base font-bold text-slate-900">
                        {queries.filter((q) => q.expertId === viewingProfileAdmin.uid).length}
                      </span>
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[10px] text-amber-700 uppercase font-semibold block">Pending</span>
                      <span className="text-base font-bold text-amber-700">
                        {queries.filter((q) => q.expertId === viewingProfileAdmin.uid && q.status !== 'resolved').length}
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] text-emerald-700 uppercase font-semibold block">Resolved</span>
                      <span className="text-base font-bold text-emerald-700">
                        {queries.filter((q) => q.expertId === viewingProfileAdmin.uid && q.status === 'resolved').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {/* Quick change password button (only for accounts the viewer manages; self uses profile settings) */}
                    {canManageUser(viewingProfileAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingProfileAdmin;
                        setViewingProfileAdmin(null);
                        setPasswordAdmin(target);
                        setNewAdminPassword('');
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-pink-50 text-slate-700 hover:text-pink-600 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Change Password</span>
                    </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageUser(viewingProfileAdmin) && (
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 font-semibold shadow-xs cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Profile</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewingProfileAdmin(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT PROFILE FORM */
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  {isSuperAdmin && viewingProfileAdmin.role !== 'super_admin' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Admin Role</label>
                      <CustomSelect
                        value={profileRole}
                        onChange={(val) => setProfileRole(val as any)}
                        options={[
                          { value: 'normal_admin', label: 'Admin' },
                          { value: 'expert_admin', label: 'Expert Admin' },
                        ]}
                        size="sm"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={profileTitle}
                    onChange={(e) => setProfileTitle(e.target.value)}
                    placeholder="e.g. IT, ECAT & Scholarships Mentor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Short Description / Bio</label>
                  <textarea
                    rows={3}
                    value={profileDesc}
                    onChange={(e) => setProfileDesc(e.target.value)}
                    placeholder="Provides guidance related to..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none leading-relaxed"
                  />
                </div>

                {isManager && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Assigned Categories</label>
                    <span className="text-[11px] text-pink-600 font-semibold">{profileCategories.length} selected</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {categories.map((c) => {
                      const isChecked = profileCategories.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 cursor-pointer p-1.5 rounded transition-colors ${
                            isChecked ? 'bg-pink-50/80 text-pink-900 font-medium' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProfileCategories((prev) => [...prev, c.id]);
                              } else {
                                setProfileCategories((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded border-slate-300 text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
