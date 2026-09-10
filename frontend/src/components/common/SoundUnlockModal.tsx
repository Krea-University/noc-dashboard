import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, AlertTriangle, Check, X, ShieldAlert } from 'lucide-react';
import { soundManager } from '../../sound/SoundManager';
import { api } from '../../api/client';
import { SoundProfile } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundUnlockModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isUnlocked, setIsUnlocked] = useState(soundManager.isAudioUnlocked());
  const [masterEnabled, setMasterEnabled] = useState(soundManager.isSoundEnabled());
  const [masterVolume, setMasterVolume] = useState(soundManager.getMasterVolume() * 100);
  const [profiles, setProfiles] = useState<SoundProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return soundManager.subscribe((unlocked, enabled) => {
      setIsUnlocked(unlocked);
      setMasterEnabled(enabled);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      api.getSoundProfiles().then(setProfiles).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = async () => {
    setIsLoading(true);
    await soundManager.unlockAudio();
    setIsLoading(false);
  };

  const handleToggleMaster = () => {
    const newVal = soundManager.toggleMasterSound();
    setMasterEnabled(newVal);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMasterVolume(val);
    soundManager.setMasterVolume(val / 100);
  };

  const handleTestSound = (channel: string, action: string) => {
    soundManager.playAlert(channel, action, 80);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl noc-card border border-slate-700 bg-slate-900 rounded-lg shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Alert Sounds & Audio Configuration</h2>
              <p className="text-xs text-slate-400">Four-channel sound alert engine & flood protection</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AudioContext Status Banner */}
        <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isUnlocked ? (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Check className="w-5 h-5" /> Web Audio Initialized & Ready
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <AlertTriangle className="w-5 h-5" /> Browser Audio Blocked / Uninitialized
                </div>
              )}
            </div>
            {!isUnlocked && (
              <button
                onClick={handleUnlock}
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-bold uppercase rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                {isLoading ? 'Enabling...' : 'ENABLE SOUND'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Modern browsers block unprompted audio playback. Clicking "ENABLE SOUND" establishes AudioContext permissions and permits real-time alert sounds.
          </p>
        </div>

        {/* Master Controls */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Master Sound Status</div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${masterEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                {masterEnabled ? 'SOUND ACTIVE' : 'MUTED'}
              </span>
              <button
                onClick={handleToggleMaster}
                className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                  masterEnabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                {masterEnabled ? 'Mute All' : 'Unmute All'}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
              <span>Master Volume</span>
              <span className="text-blue-400">{Math.round(masterVolume)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={handleVolumeChange}
              className="w-full accent-blue-500 bg-slate-800 cursor-pointer h-2 rounded-lg"
            />
          </div>
        </div>

        {/* Channel Overview */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400" /> Channel Profiles (Database Mapped)
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {profiles.map((p) => (
              <div key={p.category_code} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="font-bold text-slate-200">{p.category_code}</span>
                  <span className="ml-2 text-slate-400">Vol: {p.volume}%</span>
                  <span className="ml-2 text-slate-500">Cooldown: {p.cooldown_seconds}s</span>
                  {p.category_code === 'CLASSROOM' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold text-[10px]">
                      EXPLICITLY MUTED
                    </span>
                  )}
                </div>
                {p.category_code !== 'CLASSROOM' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTestSound(p.category_code, 'DOWN')}
                      className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[11px] font-semibold"
                    >
                      Test Down
                    </button>
                    <button
                      onClick={() => handleTestSound(p.category_code, 'RECOVERY')}
                      className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[11px] font-semibold"
                    >
                      Test Recovery
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
