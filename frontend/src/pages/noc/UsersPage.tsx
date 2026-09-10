import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Shield, KeyRound, Check, X } from 'lucide-react';
import { api } from '../../api/client';
import { User } from '../../types';

export const UsersPage: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role_id: 'role_operator' });
  const [errorMsg, setErrorMsg] = useState('');

  const { data: users, refetch, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.createUser(form);
      setIsCreateOpen(false);
      setForm({ username: '', email: '', password: '', role_id: 'role_operator' });
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.patchUser(user.id, { status: newStatus });
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" /> Operator Accounts & RBAC
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Role-Based Access Control: VIEWER, OPERATOR, NETWORK_OPERATOR, ADMINISTRATOR
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Create User
        </button>
      </div>

      <div className="noc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                    Loading users...
                  </td>
                </tr>
              ) : (
                users?.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{u.username}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[10px]">
                        {u.role_name || u.role_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
                        >
                          {u.status === 'ACTIVE' ? 'Disable Account' : 'Activate Account'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Create NOC Operator Account
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Temporary Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Role Assignment</label>
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <option value="role_viewer">VIEWER (Read-only)</option>
                <option value="role_operator">OPERATOR (Acknowledge Alarms, Incidents)</option>
                <option value="role_net_op">NETWORK_OPERATOR (VLAN Control & Firewall)</option>
                <option value="role_admin">ADMINISTRATOR (Full Access)</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
