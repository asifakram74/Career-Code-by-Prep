import React, { useState, useMemo } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useApiResource, useLiveQueries } from '../../lib/liveData';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, QueryTicket } from '../../types';
import { ConversationView } from '../common/ConversationView';
import { CustomSelect } from '../common/CustomSelect';
import {
  GraduationCap,
  Search,
  Filter,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  ExternalLink,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

export const StudentManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const canManagePasswords =
    userProfile?.role === 'super_admin' || userProfile?.role === 'expert_admin';

  const { data: rawStudents, loading } = useApiResource<UserProfile[]>('/admin/students', ['users'], []);
  const students = useMemo(
    () => [...rawStudents].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [rawStudents]
  );
  // All tickets, to count and list each student's queries.
  const { queries } = useLiveQueries({ scope: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [inspectedTicket, setInspectedTicket] = useState<QueryTicket | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Student Password Change State
  const [passwordStudent, setPasswordStudent] = useState<UserProfile | null>(null);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Calculate "New Students This Month" based on actual timestamps
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const newStudentsThisMonth = students.filter((s) => s.createdAt >= startOfMonth.getTime()).length;

  // Filtering
  const filteredStudents = students.filter((s) => {
    const text = `${s.displayName} ${s.email} ${s.phoneNumber} ${s.qualification} ${s.board}`.toLowerCase();
    if (!text.includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleStudentStatus = async (student: UserProfile) => {
    const newStatus = (student.status || 'active') === 'active' ? 'deactivated' : 'active';
    setStatusError(null);
    setStatusUpdating(true);
    try {
      const { profile } = await api.patch<{ profile: UserProfile }>(
        `/admin/users/${encodeURIComponent(student.uid)}/status`,
        { status: newStatus }
      );
      setSelectedStudent((prev) => (prev && prev.uid === student.uid ? { ...prev, ...profile, status: newStatus } : prev));
    } catch (err) {
      setStatusError(errorMessage(err, 'Could not update the account status.'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleUpdateStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStudent || !userProfile) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newStudentPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.put(`/admin/users/${encodeURIComponent(passwordStudent.uid)}/password`, {
        newPassword: newStudentPassword,
      });

      setPasswordSuccess(
        `Password updated for ${passwordStudent.displayName}. They have been signed out and must change it at their next sign-in.`
      );
      setTimeout(() => {
        setPasswordStudent(null);
        setNewStudentPassword('');
        setPasswordSuccess(null);
      }, 2500);
    } catch (err) {
      setPasswordError(errorMessage(err, 'Error updating student password.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Metric Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Student Management Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View student profiles, qualifications, submitted ticket history, and account standing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-pink-50 border border-pink-100 px-3.5 py-2 rounded-xl text-xs">
            <span className="text-[10px] text-pink-700 font-bold uppercase tracking-wider block">
              Total Students
            </span>
            <span className="text-base font-bold text-pink-950 tabular-nums">
              {students.length} Registered
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-xl text-xs">
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
              New This Month
            </span>
            <span className="text-base font-bold text-emerald-950 tabular-nums">
              +{newStudentsThisMonth} Students
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search student by name, email, phone, qualification..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div className="min-w-[140px]">
          <CustomSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Accounts' },
              { value: 'active', label: 'Active Only' },
              { value: 'deactivated', label: 'Deactivated Only' },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* Student Table (Desktop / Tablet) & Card List (Mobile) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* DESKTOP & TABLET TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Qualification</th>
                <th className="py-3 px-4">Board</th>
                <th className="py-3 px-4 text-center">Total Queries</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No students found.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((st) => {
                  const studentQueries = queries.filter((q) => q.studentId === st.uid);
                  const lastQuery = studentQueries.sort((a, b) => b.createdAt - a.createdAt)[0];

                  return (
                    <tr
                      key={st.uid}
                      onClick={() => setSelectedStudent(st)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs shadow-pink-200">
                            {st.displayName ? st.displayName.charAt(0) : 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{st.displayName}</p>
                            {lastQuery && (
                              <p className="text-[10px] text-slate-400">
                                Last: {new Date(lastQuery.createdAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-slate-800 font-medium">{st.email}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{st.phoneNumber || '—'}</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-slate-900 font-medium">{st.qualification}</p>
                        {st.qualificationDetail && (
                          <p className="text-[10px] text-slate-500">{st.qualificationDetail}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {st.board || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center tabular-nums font-bold text-pink-700">
                        {studentQueries.length}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 tabular-nums">
                        {new Date(st.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            st.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {(st.status || 'active').toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canManagePasswords && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPasswordStudent(st);
                                setNewStudentPassword('');
                                setPasswordError(null);
                                setPasswordSuccess(null);
                              }}
                              className="text-xs text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors"
                              title="Change Student Password"
                            >
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>Password</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(st);
                            }}
                            className="text-xs text-pink-600 hover:text-pink-800 font-semibold cursor-pointer"
                          >
                            View History →
                          </button>
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
          {paginatedStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No students found.
            </div>
          ) : (
            paginatedStudents.map((st) => {
              const studentQueries = queries.filter((q) => q.studentId === st.uid);
              const lastQuery = studentQueries.sort((a, b) => b.createdAt - a.createdAt)[0];

              return (
                <div
                  key={st.uid}
                  onClick={() => setSelectedStudent(st)}
                  className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  {/* Top: Avatar, Name, Email */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs shadow-pink-200">
                        {st.displayName ? st.displayName.charAt(0) : 'S'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{st.displayName}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{st.email}</p>
                        {st.phoneNumber && (
                          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{st.phoneNumber}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        st.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {(st.status || 'active').toUpperCase()}
                    </span>
                  </div>

                  {/* Qualification & Board chips */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {st.qualification} {st.qualificationDetail ? `(${st.qualificationDetail})` : ''}
                    </span>
                    {st.board && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        Board: {st.board}
                      </span>
                    )}
                  </div>

                  {/* Stats & Registered Date */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                      Queries: <strong className="text-pink-700 font-bold">{studentQueries.length}</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Joined: {new Date(st.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {canManagePasswords && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPasswordStudent(st);
                          setNewStudentPassword('');
                          setPasswordError(null);
                          setPasswordSuccess(null);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Password</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(st);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition-colors"
                    >
                      <span>View History →</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages} ({filteredStudents.length} students)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STUDENT DETAILS & TICKET HISTORY MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedStudent.displayName}
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Student Profile & Complete Career Guidance Archive
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setInspectedTicket(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 my-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Email Address</span>
                <span className="font-semibold text-slate-900 truncate block">{selectedStudent.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Phone Number</span>
                <span className="font-semibold text-slate-900">{selectedStudent.phoneNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Qualification</span>
                <span className="font-semibold text-slate-900">{selectedStudent.qualification}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Board</span>
                <span className="font-semibold text-slate-900">{selectedStudent.board || 'None'}</span>
              </div>
            </div>

            {/* Account Status & Password Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <span className="text-slate-600 font-medium">Account Status: </span>
                <span className={`font-bold ${selectedStudent.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {(selectedStudent.status || 'active').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canManagePasswords && (
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordStudent(selectedStudent);
                      setNewStudentPassword('');
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Change Student Password</span>
                  </button>
                )}
                <button
                  onClick={() => toggleStudentStatus(selectedStudent)}
                  disabled={statusUpdating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
                    selectedStudent.status === 'active'
                      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {selectedStudent.status === 'active' ? 'Deactivate Student Account' : 'Reactivate Account'}
                </button>
              </div>
            </div>

            {statusError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Query History for this student */}
            <div className="mt-4">
              <h4 className="font-bold text-slate-900 mb-2">Submitted Queries & Conversations</h4>
              {(() => {
                const sQueries = queries.filter((q) => q.studentId === selectedStudent.uid);
                if (sQueries.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl">
                      This student has not submitted any queries yet.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2.5">
                    {sQueries.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setInspectedTicket(t)}
                        className="p-3.5 border border-slate-200 rounded-xl hover:border-pink-300 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-mono font-bold text-pink-700">{t.ticketNumber}</span>
                          <span className="text-slate-500">{t.categoryName} · Expert: {t.expertName}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            t.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {(t.status || 'open').toUpperCase()}
                          </span>
                        </div>
                        <h5 className="font-semibold text-slate-900">{t.title}</h5>
                        <p className="text-slate-600 line-clamp-1 mt-0.5 text-[11px]">{t.detail}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Conversation Inspector Modal */}
            {inspectedTicket && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900">Conversation Details: {inspectedTicket.ticketNumber}</h4>
                  <button
                    onClick={() => setInspectedTicket(null)}
                    className="text-xs text-pink-600 hover:text-pink-800 font-medium cursor-pointer"
                  >
                    Hide Conversation
                  </button>
                </div>
                <div className="h-[480px] rounded-xl overflow-hidden border border-slate-200 flex flex-col">
                  <ConversationView
                    ticket={inspectedTicket}
                    onClose={() => setInspectedTicket(null)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHANGE STUDENT PASSWORD MODAL */}
      {passwordStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Change Student Password
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Updating password for <strong className="text-slate-800">{passwordStudent.displayName}</strong> ({passwordStudent.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordStudent(null);
                  setNewStudentPassword('');
                  setPasswordError(null);
                  setPasswordSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStudentPassword} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newStudentPassword}
                    onChange={(e) => setNewStudentPassword(e.target.value)}
                    placeholder="Enter new student password (min. 8 chars)"
                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  The student is signed out everywhere and must choose a new password the next time they sign in with this one.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordStudent(null);
                    setNewStudentPassword('');
                    setPasswordError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading || !newStudentPassword}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {passwordLoading ? 'Updating Password...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
