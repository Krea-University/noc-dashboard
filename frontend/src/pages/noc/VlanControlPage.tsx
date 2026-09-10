import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, ShieldAlert, CheckCircle2, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import { VlanConfirmModal } from '../../components/common/VlanConfirmModal';
import { VLAN, ActionJob } from '../../types';

export const VlanControlPage: React.FC = () => {
  const [selectedVlan, setSelectedVlan] = useState<VLAN | null>(null);
  const [modalAction, setModalAction] = useState<'DISABLE' | 'ENABLE'>('DISABLE');
  const [modalOpen, setModalOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  const { data: vlans, refetch: refetchVlans, isLoading: vlansLoading } = useQuery({
    queryKey: ['vlans'],
    queryFn: api.getVlans,
    refetchInterval: 10000,
  });

  const { data: actions, refetch: refetchActions } = useQuery({
    queryKey: ['actions'],
    queryFn: api.getActions,
    refetchInterval: 10000,
  });

  const handleOpenAction = (vlan: VLAN, action: 'DISABLE' | 'ENABLE') => {
    setSelectedVlan(vlan);
    setModalAction(action);
    setModalOpen(true);
  };

  const handleRollback = async (jobId: string) => {
    setRollbackLoading(jobId);
    try {
      await api.rollbackAction(jobId);
      refetchVlans();
      refetchActions();
    } catch (e) {
      console.error(e);
    } finally {
      setRollbackLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-blue-400" /> FortiGate VLAN Internet Access Control
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          12-Step Verified Firewall Modification Pipeline with Blast Radius Estimation, Mandatory Justification & Rollback
        </p>
      </div>

      {/* VLAN Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {vlans?.map((v) => {
          const isEnabled = v.internet_status === 'ENABLED';
          return (
            <div key={v.vlan_id} className="noc-card p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-400">VLAN {v.vlan_id}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    Internet {v.internet_status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100">{v.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{v.description}</p>

                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-850 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subnet:</span>
                    <span className="text-slate-300">{v.subnet}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gateway:</span>
                    <span className="text-slate-300">{v.gateway}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Endpoints:</span>
                    <span className="text-blue-400 font-bold">{v.expected_endpoints}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Internal LAN: <strong className="text-emerald-400">Active</strong>
                </span>

                {isEnabled ? (
                  <button
                    onClick={() => handleOpenAction(v, 'DISABLE')}
                    className="px-3.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold uppercase transition-colors"
                  >
                    Disable Internet
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenAction(v, 'ENABLE')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase transition-colors"
                  >
                    Enable Internet
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Network Action Jobs Execution Log */}
      <div className="noc-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-400" /> Execution Pipeline Audit & Job History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified state transitions, operator reasons, and reversible actions
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Job ID</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target VLAN</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3">Operational Reason</th>
                <th className="py-3 px-3 text-center">State</th>
                <th className="py-3 px-3">Requested At</th>
                <th className="py-3 px-3 text-right">Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {actions && actions.length > 0 ? (
                actions.map((job) => {
                  const isSuccess = job.state === 'SUCCESS';
                  return (
                    <tr key={job.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{job.job_number}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            job.action_type.includes('DISABLE') ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {job.action_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">VLAN {job.target_id}</td>
                      <td className="py-3 px-3 text-blue-400 font-mono">{job.username}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={job.reason}>
                        {job.reason}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isSuccess
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : job.state === 'FAILED'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {job.state}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(job.requested_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isSuccess ? (
                          <button
                            onClick={() => handleRollback(job.id)}
                            disabled={rollbackLoading === job.id}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold uppercase flex items-center gap-1 ml-auto transition-colors"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            {rollbackLoading === job.id ? 'Rolling back...' : 'Rollback'}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No network action jobs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VlanConfirmModal
        vlan={selectedVlan}
        action={modalAction}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          refetchVlans();
          refetchActions();
        }}
      />
    </div>
  );
};
