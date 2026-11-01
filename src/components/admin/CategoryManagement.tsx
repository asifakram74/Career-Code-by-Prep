import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { useAuth } from '../../context/AuthContext';
import { CategoryItem, UserProfile, QueryTicket, formatRoleName } from '../../types';
import { sortCategoriesGeneralFirst } from '../../constants/officialCategories';
import { CustomSelect } from '../common/CustomSelect';
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  X,
  Check,
} from 'lucide-react';

export const CategoryManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin =
    userProfile?.role === 'super_admin' ||
    userProfile?.email?.toLowerCase() === 'mentoflux@gmail.com';
  const isExpertAdmin =
    userProfile?.role === 'expert_admin' ||
    (!isSuperAdmin && userProfile?.email?.toLowerCase() === 'huzaifa678ops@gmail.com');
  const canManageCategories = isSuperAdmin || isExpertAdmin;

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [queries, setQueries] = useState<QueryTicket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignedAdminIds, setAssignedAdminIds] = useState<string[]>([]);
  const [primaryAdminId, setPrimaryAdminId] = useState('');
  const [categoryStatus, setCategoryStatus] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-app Delete Confirmation & Alerts
  const [deleteModalCategory, setDeleteModalCategory] = useState<CategoryItem | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Listen to categories with null-safe mapping
  useEffect(() => {
    const q = query(collection(db, 'categories'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CategoryItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const adminIds = Array.isArray(data.assignedAdminIds)
            ? data.assignedAdminIds
            : Array.isArray(data.assignedExpertIds)
            ? data.assignedExpertIds
            : [];

          list.push({
            id: d.id,
            name: String(data.name || 'Untitled Category'),
            description: String(data.description || ''),
            subcategories: Array.isArray(data.subcategories) ? data.subcategories : [],
            assignedAdminIds: adminIds,
            primaryAdminId: data.primaryAdminId ? String(data.primaryAdminId) : undefined,
            backupAdminId: data.backupAdminId ? String(data.backupAdminId) : undefined,
            status: data.status === 'inactive' ? 'inactive' : 'active',
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          });
        });
        setCategories(sortCategoriesGeneralFirst(list));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'categories');
      }
    );

    // Listen to admins
    const qAdmins = query(collection(db, 'users'));
    const unsubAdmins = onSnapshot(
      qAdmins,
      (snapshot) => {
        const list: UserProfile[] = [];
        const seen = new Set<string>();
        snapshot.forEach((d) => {
          const u = d.data() as UserProfile;
          if (['normal_admin', 'expert_admin', 'super_admin'].includes(u.role)) {
            const key = (u.email || u.displayName || d.id).trim().toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              list.push({ ...u, uid: d.id });
            }
          }
        });
        list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setAdmins(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );

    // Listen to queries to guard deletion
    const qQueries = query(collection(db, 'queries'));
    const unsubQueries = onSnapshot(
      qQueries,
      (snapshot) => {
        const list: QueryTicket[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as QueryTicket);
        });
        setQueries(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'queries');
      }
    );

    return () => {
      unsub();
      unsubAdmins();
      unsubQueries();
    };
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setAssignedAdminIds([]);
    setPrimaryAdminId('');
    setCategoryStatus('active');
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setName(cat.name || '');
    setDescription(cat.description || '');
    setAssignedAdminIds(Array.isArray(cat.assignedAdminIds) ? [...cat.assignedAdminIds] : []);
    setPrimaryAdminId(cat.primaryAdminId || '');
    setCategoryStatus(cat.status || 'active');
    setError(null);
    setShowModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const catId = editingCategory ? editingCategory.id : `cat-${Date.now()}`;

      const payload: Record<string, any> = {
        id: catId,
        name: name.trim(),
        description: description?.trim() || '',
        subcategories: editingCategory?.subcategories || [],
        assignedAdminIds: assignedAdminIds || [],
        status: categoryStatus,
        createdAt: editingCategory ? editingCategory.createdAt : now,
        updatedAt: now,
      };

      if (primaryAdminId) {
        payload.primaryAdminId = primaryAdminId;
      } else {
        payload.primaryAdminId = assignedAdminIds.length > 0 ? assignedAdminIds[0] : '';
      }

      await setDoc(doc(db, 'categories', catId), payload);

      // Sync assigned categories back into user profiles
      for (const admin of admins) {
        try {
          const shouldHave = assignedAdminIds.includes(admin.uid);
          const currentAssigned = Array.isArray(admin.assignedCategories)
            ? admin.assignedCategories
            : [];
          const has = currentAssigned.includes(catId);

          if (shouldHave && !has) {
            const userRef = doc(db, 'users', admin.uid);
            await updateDoc(userRef, {
              assignedCategories: [...currentAssigned, catId],
              updatedAt: now,
            });
          } else if (!shouldHave && has) {
            const userRef = doc(db, 'users', admin.uid);
            await updateDoc(userRef, {
              assignedCategories: currentAssigned.filter((c) => c !== catId),
              updatedAt: now,
            });
          }
        } catch (adminErr) {
          console.warn('Could not sync admin categories:', adminErr);
        }
      }

      setShowModal(false);
      setSuccessMessage(`Category "${name.trim()}" saved successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'categories');
      setError(err.message || 'Error saving category.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = (cat: CategoryItem) => {
    const activeQueryCount = queries.filter((q) => q.categoryId === cat.id).length;
    if (activeQueryCount > 0) {
      setDeleteWarning(
        `Cannot delete "${cat.name}" because it contains ${activeQueryCount} active student queries. Please set it to inactive instead.`
      );
      return;
    }
    setDeleteModalCategory(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!deleteModalCategory) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'categories', deleteModalCategory.id));
      setDeleteModalCategory(null);
      setSuccessMessage(`Category "${deleteModalCategory.name}" removed successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${deleteModalCategory.id}`);
      setDeleteWarning(err.message || 'Error deleting category.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredCategories = categories.filter((c) => {
    const text = (c.name || '').toLowerCase();
    if (!text.includes(searchQuery.toLowerCase())) return false;
    const catStatus = c.status || 'active';
    if (statusFilter !== 'all' && catStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Academic & Query Categories ({categories.length})
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure counselling categories, assign multiple specialized admins, and set primary advisors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageCategories && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
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
            placeholder="Search categories (e.g. CA/ACCA, CS/IT, Law/LLB)..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div className="min-w-[140px]">
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderTree className="w-6 h-6" />
            </div>
            {categories.length === 0 ? (
              <>
                <h3 className="text-sm font-bold text-slate-800">No Categories Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add and configure counselling disciplines and query categories.
                </p>
                {canManageCategories && (
                  <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-semibold hover:bg-pink-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Category
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">No categories found matching your search criteria.</p>
            )}
          </div>
        ) : (
          filteredCategories.map((cat, idx) => {
            const queryCount = queries.filter((q) => q.categoryId === cat.id).length;
            const catAdminIds = Array.isArray(cat.assignedAdminIds)
              ? cat.assignedAdminIds
              : Array.isArray((cat as any).assignedExpertIds)
              ? (cat as any).assignedExpertIds
              : [];
            const assignedCount = catAdminIds.length;
            const assignedAdminsList = admins.filter((a) => catAdminIds.includes(a.uid));
            const catStatus = cat.status || 'active';

            return (
              <div
                key={cat.id}
                className="bg-white border border-pink-100/90 hover:border-pink-300 transition-all rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 w-5">
                        #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          catStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {catStatus.toUpperCase()}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {queryCount} {queryCount === 1 ? 'query' : 'queries'}
                    </span>
                  </div>

                  {/* Category Name & Short Description */}
                  <h3 className="text-base font-bold text-slate-900 mt-1">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  )}

                  {/* Assigned Admins Portion */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-pink-600" />
                        Assigned Admins ({assignedCount})
                      </span>
                    </div>

                    {assignedAdminsList.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No admins assigned yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assignedAdminsList.map((adm) => {
                          const isPrimary = cat.primaryAdminId === adm.uid;
                          return (
                            <span
                              key={adm.uid}
                              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                                isPrimary
                                  ? 'bg-pink-100/90 border-pink-300 text-pink-900 font-semibold'
                                  : 'bg-pink-50/60 border-pink-200/80 text-pink-800'
                              }`}
                            >
                              {isPrimary && (
                                <ShieldCheck className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                              )}
                              <span>{adm.displayName}</span>
                              {isPrimary && (
                                <span className="text-[9px] uppercase tracking-wider font-bold text-pink-600 ml-0.5">
                                  Primary
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canManageCategories && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="p-1.5 text-slate-600 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category & Assignments"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 text-xs animate-pop-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Category & Assignments' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Category Name <span className="text-pink-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CA/ACCA, CS/IT, Law/LLB"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short explanation of mentoring topics covered under this category..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-slate-700">
                    Assign Admins to this Category
                  </label>
                  <span className="text-[11px] text-pink-600 font-semibold">
                    {assignedAdminIds.length} selected
                  </span>
                </div>
                {admins.length === 0 ? (
                  <div className="p-3 bg-pink-50/50 border border-pink-100 rounded-lg text-slate-500 text-xs">
                    No admins found in system.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {admins.map((adm) => {
                      const isChecked = assignedAdminIds.includes(adm.uid);
                      return (
                        <label
                          key={adm.uid}
                          className={`flex items-center gap-2.5 cursor-pointer p-1.5 rounded-md transition-colors ${
                            isChecked
                              ? 'bg-pink-50/80 text-pink-900 font-medium'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedAdminIds((prev) => [...prev, adm.uid]);
                              } else {
                                setAssignedAdminIds((prev) => prev.filter((id) => id !== adm.uid));
                                if (primaryAdminId === adm.uid) {
                                  setPrimaryAdminId('');
                                }
                              }
                            }}
                            className="rounded border-slate-300 text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1 text-xs">
                            <span className="font-semibold">{adm.displayName}</span>
                            <span className="text-slate-400 ml-1.5 text-[11px]">
                              ({formatRoleName(adm.role)})
                            </span>
                            {adm.professionalTitle && (
                              <span className="text-slate-500 block text-[10px]">
                                {adm.professionalTitle}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primary Advisor (Optional)
                  </label>
                  <CustomSelect
                    value={primaryAdminId}
                    onChange={(val) => setPrimaryAdminId(val)}
                    options={[
                      { value: '', label: 'Auto (First Assigned)' },
                      ...admins
                        .filter((a) => assignedAdminIds.includes(a.uid))
                        .map((a) => ({
                          value: a.uid,
                          label: a.displayName || 'Advisor',
                        })),
                    ]}
                    placeholder="Auto (First Assigned)"
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Status</label>
                  <CustomSelect
                    value={categoryStatus}
                    onChange={(val) => setCategoryStatus(val as any)}
                    options={[
                      { value: 'active', label: 'Active (Visible to Students)' },
                      { value: 'inactive', label: 'Inactive / Hidden' },
                    ]}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 text-center">Delete Category?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-800">
                "{deleteModalCategory.name}"
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteModalCategory(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteCategory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Notice */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 text-center">Cannot Delete</h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              {deleteWarning}
            </p>
            <div className="flex justify-center mt-5">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
