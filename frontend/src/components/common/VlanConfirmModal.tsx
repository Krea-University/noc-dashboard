import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Loader2, X, RefreshCw } from 'lucide-react';
import { VLAN, ImpactEstimate, ActionJob } from '../../types';
import { api } from '../../api/client';

interface Props {
  vlan: VLAN | null;
  action: 'DISABLE' | 'ENABLE';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (job: ActionJob) => void;
}

export const VlanConfirmModal: React.FC<Props> = ({ vlan, action, isOpen, onClose, onSuccess }) => {
  const [impact, setImpact] = useState<ImpactEstimate | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<ActionJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vlan) {
      setReason('');
      setConfirmed(false);
      setErrorMsg(null);
      setCurrentJob(null);
      api.getVlanImpact(vlan.vlan_id, action).then(setImpact).catch(console.error);
    }
  }, [isOpen, vlan, action]);

  if (!isOpen || !vlan) return null;

  const isDisable = action === 'DISABLE';

  const handleExecute = async () => {
    if (!reason.trim()) {
      setErrorMsg('A valid justification reason is required.');
      return;
    }
    if (!confirmed) {
      setErrorMsg('Please explicitly check the confirmation box.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let job: ActionJob;
      if (isDisable) {
        job = await api.disableVlanInternet(vlan.vlan_id, reason);
      } else {
        job = await api.enableVlanInternet(vlan.vlan_id, reason);
      }
      setCurrentJob(job);
      setIsLoading(false);
      onSuccess(job);
    } catch (err: unknown) {
      setIsLoading(false);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Network action failed');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isDisable
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {isDisable ? 'Disable VLAN Internet Access' : 'Enable VLAN Internet Access'}
              </h2>
              <p className="text-xs text-slate-400">
                FortiGate Policy Controlled Execution Pipeline (12-Step Verified)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target VLAN & Impact Preview */}
        <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase">Target VLAN</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              VLAN {vlan.vlan_id} — {vlan.name} ({vlan.subnet})
            </span>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Expected Operational Impact
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Endpoints</span>
                <span className="font-bold text-slate-200 text-sm">
                  {impact?.expected_endpoints || vlan.expected_endpoints}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Wireless APs</span>
                <span className="font-bold text-slate-200 text-sm">
                  {impact?.expected_aps || vlan.expected_aps}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Classrooms</span>
                <span className="font-bold text-slate-200 text-sm">
                  {impact?.expected_classrooms || vlan.expected_classrooms}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Campus Internal LAN:</span>
              <span className="text-emerald-400 font-bold">AVAILABLE</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Public Internet Traffic:</span>
              <span className={isDisable ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                {isDisable ? 'WILL BE BLOCKED' : 'WILL BE RESTORED'}
              </span>
            </div>
          </div>
        </div>

        {/* Mandatory Reason Input */}
        <div className="mt-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Operational Justification Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Academic Examination Lockdown in Lab Complex / Emergency Quarantine..."
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Explicit Confirmation Checkbox */}
        <div className="mt-3 flex items-center gap-2.5">
          <input
            type="checkbox"
            id="confirm-vlan"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600 bg-slate-950 border-slate-800 cursor-pointer"
          />
          <label htmlFor="confirm-vlan" className="text-xs text-slate-300 select-none cursor-pointer">
            I confirm authorization to modify FortiGate policy for VLAN {vlan.vlan_id} and accept impact.
          </label>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Execution Result Banner */}
        {currentJob && currentJob.state === 'SUCCESS' && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Action verified on FortiGate firewall! Job: <strong>{currentJob.job_number}</strong>
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isLoading || (currentJob !== null && currentJob.state === 'SUCCESS')}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white transition-colors ${
              isDisable
                ? 'bg-red-600 hover:bg-red-500 disabled:bg-red-900/50'
                : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying Firewall...
              </>
            ) : isDisable ? (
              'Disable Internet'
            ) : (
              'Enable Internet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
