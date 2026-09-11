import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Loader2, X, KeyRound, Eye, EyeOff } from 'lucide-react';
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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<ActionJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vlan) {
      setReason('');
      setPassword('');
      setShowPassword(false);
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
    if (!password.trim()) {
      setErrorMsg('Please enter your account password to authorize this firewall modification.');
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
        job = await api.disableVlanInternet(vlan.vlan_id, reason, password);
      } else {
        job = await api.enableVlanInternet(vlan.vlan_id, reason, password);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-lg noc-card border border-slate-700 bg-slate-900 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className={`p-2 sm:p-2.5 rounded-lg border ${
                isDisable
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {isDisable ? 'Disable VLAN Internet Access' : 'Enable VLAN Internet Access'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                FortiGate Policy Controlled Execution Pipeline (12-Step Verified)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target VLAN & Impact Preview */}
        <div className="mt-4 p-3.5 sm:p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
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

        {/* Mandatory Password Re-Authentication */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Account Password Re-Authentication <span className="text-red-400">*</span>
            </label>
            <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Step-Up Security</span>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your current login password to push to firewall..."
              autoComplete="current-password"
              className="w-full p-2.5 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            FortiGate firewall policy modifications require step-up authorization with your account password.
          </p>
        </div>

        {/* Explicit Confirmation Checkbox */}
        <div className="mt-3.5 flex items-center gap-2.5">
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
