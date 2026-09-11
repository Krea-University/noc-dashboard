import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Check,
  X,
  Search,
  Filter,
  Copy,
  Edit2,
  Trash2,
  Lock,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Sparkles,
  AlertTriangle,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { User, Role } from '../../types';

export const UsersPage: React.FC = () => {
  // Queries
  const { data: users, refetch: refetchUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  });

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: api.getRoles,
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
  });

  const currentUserId = meData?.user?.id;

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRoleGuideOpen, setIsRoleGuideOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Notifications & Feedback
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Create Form State
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role_id: 'role_operator',
    status: 'ACTIVE',
    must_change_password: true,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    email: '',
    role_id: 'role_operator',
    status: 'ACTIVE',
    must_change_password: false,
  });
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Reset Password State
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetResultTempPass, setResetResultTempPass] = useState<string | null>(null);
  const [resetError, setResetError] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Delete State
  const [deleteError, setDeleteError] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Secure Password Generator Helper
  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    const array = new Uint32Array(14);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 14; i++) {
      pass += chars[array[i] % chars.length];
    }
    return pass;
  };

  // KPIs
  const stats = useMemo(() => {
    if (!users) return { total: 0, active: 0, admins: 0, operators: 0, disabled: 0 };
    const total = users.length;
    const active = users.filter((u) => u.status === 'ACTIVE').length;
    const disabled = users.filter((u) => u.status === 'DISABLED').length;
    const admins = users.filter((u) => u.role_id === 'role_admin').length;
    const operators = users.filter((u) => u.role_id === 'role_operator' || u.role_id === 'role_net_op').length;
    return { total, active, disabled, admins, operators };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role_name && u.role_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole = roleFilter === 'ALL' || u.role_id === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Handle User Creation
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsSubmittingCreate(true);
    try {
      await api.createUser(createForm);
      setIsCreateOpen(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        role_id: 'role_operator',
        status: 'ACTIVE',
        must_change_password: true,
      });
      refetchUsers();
      showToast(`User ${createForm.username} created successfully.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('Failed creating user');
      }
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      role_id: user.role_id,
      status: user.status,
      must_change_password: user.must_change_password,
    });
    setEditError('');
    setIsEditOpen(true);
  };

  // Handle User Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError('');
    setIsSubmittingEdit(true);
    try {
      await api.patchUser(selectedUser.id, editForm);
      setIsEditOpen(false);
      refetchUsers();
      showToast(`Account ${selectedUser.username} updated successfully.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError('Failed updating user');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Quick Toggle Status
  const handleQuickToggleStatus = async (user: User) => {
    if (user.id === currentUserId) {
      showToast('You cannot disable your own active account.', 'error');
      return;
    }
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.patchUser(user.id, { status: newStatus });
      refetchUsers();
      showToast(`User ${user.username} is now ${newStatus}.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        showToast(err.message, 'error');
      }
    }
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setResetPasswordValue('');
    setResetMustChange(true);
    setResetResultTempPass(null);
    setResetError('');
    setIsResetOpen(true);
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetError('');
    setIsSubmittingReset(true);
    try {
      const res = await api.resetUserPassword(selectedUser.id, {
        new_password: resetPasswordValue.trim() || undefined,
        must_change_password: resetMustChange,
      });
      setResetResultTempPass(res.temporary_password);
      refetchUsers();
      showToast(`Password reset for ${selectedUser.username}.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetError(err.message);
      } else {
        setResetError('Failed resetting password');
      }
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setDeleteError('');
    setIsDeleteOpen(true);
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setDeleteError('');
    setIsSubmittingDelete(true);
    try {
      await api.deleteUser(selectedUser.id);
      setIsDeleteOpen(false);
      refetchUsers();
      showToast(`Account ${selectedUser.username} deleted.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed deleting user');
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Role Badge Styling Helper
  const renderRoleBadge = (roleId: string, roleName?: string) => {
    switch (roleId) {
      case 'role_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-bold tracking-wide">
            <Shield className="w-3 h-3 text-purple-400" />
            <span>{roleName || 'ADMINISTRATOR'}</span>
          </span>
        );
      case 'role_net_op':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold tracking-wide">
            <Network className="w-3 h-3 text-cyan-400" />
            <span>{roleName || 'NETWORK_OPERATOR'}</span>
          </span>
        );
      case 'role_operator':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold tracking-wide">
            <UserCheck className="w-3 h-3 text-emerald-400" />
            <span>{roleName || 'OPERATOR'}</span>
          </span>
        );
      case 'role_viewer':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-500/10 text-slate-300 border border-slate-700 text-[11px] font-bold tracking-wide">
            <Eye className="w-3 h-3 text-slate-400" />
            <span>{roleName || 'VIEWER'}</span>
          </span>
        );
    }
  };

  // Avatar Initials & Color Helper
  const getAvatarStyle = (roleId: string) => {
    switch (roleId) {
      case 'role_admin':
        return 'bg-purple-950/80 border-purple-500/50 text-purple-300';
      case 'role_net_op':
        return 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300';
      case 'role_operator':
        return 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
      case 'role_viewer':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom duration-200 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          }`}
        >
          {toastMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" /> Operator Accounts & RBAC Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage NOC operator credentials, Role-Based Access Control, session revocation, and security policies
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsRoleGuideOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Role Capabilities Guide
          </button>
          <button
            type="button"
            onClick={() => refetchUsers()}
            title="Refresh Users"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateError('');
              setIsCreateOpen(true);
            }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-md shadow-blue-600/30"
          >
            <UserPlus className="w-4 h-4" /> Create User Account
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="noc-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-100 font-mono">{stats.total}</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Total Accounts</div>
          </div>
        </div>

        <div className="noc-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-400 font-mono">{stats.active}</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Active Operators</div>
          </div>
        </div>

        <div className="noc-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-purple-400 font-mono">{stats.admins}</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Administrators</div>
          </div>
        </div>

        <div className="noc-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-rose-400 font-mono">{stats.disabled}</div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Disabled Accounts</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="noc-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search username, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['ALL', 'ACTIVE', 'DISABLED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Role Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 font-medium"
            >
              <option value="ALL">All Roles</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="noc-card overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Security Flags</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                    Loading operator accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No operator accounts match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUserId;
                  const initials = u.username.substring(0, 2).toUpperCase();

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                      {/* Operator Avatar + Username + ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${getAvatarStyle(
                              u.role_id
                            )}`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-2">
                              <span>{u.username}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tracking-tight">{u.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email + Copy button */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-mono text-slate-300">{u.email}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email, `email_${u.id}`)}
                            title="Copy email"
                            className="text-slate-600 hover:text-slate-300 transition-colors"
                          >
                            {copiedKey === `email_${u.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">{renderRoleBadge(u.role_id, u.role_name)}</td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                            }`}
                          />
                          {u.status}
                        </span>
                      </td>

                      {/* Security Flags */}
                      <td className="py-3 px-4">
                        {u.must_change_password ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3 text-amber-400" /> Change Required
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-mono">Standard</span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            title="Edit Role & Details"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => openResetPasswordModal(u)}
                            title="Reset Temporary Password"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950/60 hover:text-amber-300 border border-transparent hover:border-amber-500/30 text-slate-300 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Toggle Status */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleQuickToggleStatus(u)}
                            title={isCurrent ? 'Cannot disable own account' : u.status === 'ACTIVE' ? 'Disable Account' : 'Activate Account'}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.status === 'ACTIVE'
                                ? 'bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300'
                                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Disable' : 'Activate'}
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => openDeleteModal(u)}
                            title={isCurrent ? 'Cannot delete own account' : 'Delete Account'}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Create NOC Operator Account
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{createError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. jdoe"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="jdoe@krea.edu.in"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300 uppercase">Initial Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const generated = generateSecurePassword();
                    setCreateForm({ ...createForm, password: generated });
                    setShowCreatePassword(true);
                  }}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" /> Generate Strong Password
                </button>
              </div>
              <div className="relative">
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full p-2.5 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Assigned Role</label>
              <select
                value={createForm.role_id}
                onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="role_viewer">VIEWER — Read-Only Monitoring & Telemetry</option>
                <option value="role_operator">OPERATOR — Alarms Acknowledgment & Incident Management</option>
                <option value="role_net_op">NETWORK_OPERATOR — FortiGate VLAN Internet Control & Network Actions</option>
                <option value="role_admin">ADMINISTRATOR — Full System Administration & User Management</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createForm.must_change_password}
                  onChange={(e) => setCreateForm({ ...createForm, must_change_password: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Require password change upon first login
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isSubmittingCreate ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Operator: {selectedUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Email Address</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Assigned Role</label>
              <select
                value={editForm.role_id}
                onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="role_viewer">VIEWER — Read-Only Monitoring & Telemetry</option>
                <option value="role_operator">OPERATOR — Alarms Acknowledgment & Incident Management</option>
                <option value="role_net_op">NETWORK_OPERATOR — FortiGate VLAN Internet Control & Network Actions</option>
                <option value="role_admin">ADMINISTRATOR — Full System Administration & User Management</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Account Status</label>
              <select
                value={editForm.status}
                disabled={selectedUser.id === currentUserId}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
              {selectedUser.id === currentUserId && (
                <p className="text-[10px] text-amber-400 mt-1">You cannot disable your own active account.</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editForm.must_change_password}
                  onChange={(e) => setEditForm({ ...editForm, must_change_password: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Require password change upon next login
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleResetPasswordSubmit}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" /> Reset Password: {selectedUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{resetError}</span>
              </div>
            )}

            {resetResultTempPass ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-2">
                  <div className="text-xs font-bold flex items-center gap-2 text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-400" /> Password Reset Successful!
                  </div>
                  <p className="text-xs text-slate-300">
                    The temporary password below has been applied. All prior active sessions for this operator have been terminated.
                  </p>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-emerald-400 select-all">
                      {resetResultTempPass}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resetResultTempPass, 'temp_pass')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'temp_pass' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Resetting the password will immediately revoke all active browser sessions for{' '}
                  <strong className="text-slate-100 font-bold">{selectedUser.username}</strong>, requiring them to sign in with the new credentials.
                </p>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300 uppercase">
                      New Password (or Leave Empty to Auto-Generate)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generateSecurePassword();
                        setResetPasswordValue(generated);
                        setShowResetPassword(true);
                      }}
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" /> Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      placeholder="Leave blank for random 12-character password"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      className="w-full p-2.5 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resetMustChange}
                      onChange={(e) => setResetMustChange(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 w-4 h-4"
                    />
                    <span className="text-xs text-slate-300 font-medium">
                      Require password change upon next login
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReset}
                    className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {isSubmittingReset ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* DELETE USER MODAL */}
      {isDeleteOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-rose-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Delete Operator Account
              </h3>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete the account for{' '}
              <strong className="text-slate-100 font-bold">{selectedUser.username}</strong> ({selectedUser.email})?
            </p>

            <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs text-red-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-4 h-4" /> Immediate Consequences:
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                <li>All active sessions will be terminated immediately.</li>
                <li>The user will no longer be able to log in to the NOC console.</li>
                <li>Audit records will reflect this deletion event permanently.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleDeleteSubmit}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isSubmittingDelete ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE CAPABILITIES GUIDE MODAL */}
      {isRoleGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" /> KREA NOC Role-Based Access Control (RBAC)
              </h3>
              <button
                type="button"
                onClick={() => setIsRoleGuideOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Every operator account is bound to an immutable role governing their telemetry access, incident management, and network control authorization.
            </p>

            <div className="space-y-3 pt-1">
              {/* VIEWER */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-200 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                      VIEWER
                    </span>
                    <span>Read-Only Infrastructure Monitoring</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Level 1</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Permits viewing NOC dashboards, wall displays, device status, active alarms, outages, reports, and WAN statuses. Cannot acknowledge alarms or execute network changes.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-500">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">dashboard.view</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">devices.view</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">alarms.view</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">reports.view</span>
                </div>
              </div>

              {/* OPERATOR */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-emerald-300 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
                      OPERATOR
                    </span>
                    <span>IT Operations & Alarm Acknowledgment</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Level 2</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Includes all Viewer capabilities plus: acknowledging and clearing active alarms, incident management (creating, assigning, and resolving incidents), and updating device metadata.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-emerald-400/80">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">alarms.acknowledge</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">incidents.manage</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">devices.edit_metadata</span>
                </div>
              </div>

              {/* NETWORK_OPERATOR */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-cyan-300 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[10px] font-bold">
                      NETWORK_OPERATOR
                    </span>
                    <span>FortiGate Firewall & VLAN Network Control</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Level 3</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Includes Operator capabilities plus: authorization to execute high-risk network modifications, including the 12-step FortiGate VLAN Internet killswitch and policy modifications.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-cyan-400/80">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">vlan.internet.disable</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">vlan.internet.enable</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">fortigate.manage</span>
                </div>
              </div>

              {/* ADMINISTRATOR */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-purple-300 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono text-[10px] font-bold">
                      ADMINISTRATOR
                    </span>
                    <span>Full System Control & User Administration</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Level 4</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Unrestricted access across all operational, network, and administrative domains: User creation/editing/deletion, password resets, system configuration, integration credentials, and drills.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-purple-400/80">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">users.manage</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">settings.manage</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">displays.manage</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">* (all permissions)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRoleGuideOpen(false)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

