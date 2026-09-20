import React, { useEffect } from 'react';
import { RefreshCw, Sparkles, X, ChevronUp, ChevronDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useAppUpdate } from '../../context/UpdateContext';

export const UpdateNotificationBanner: React.FC = () => {
  const {
    isUpdateAvailable,
    remainingSeconds,
    isMinimized,
    setIsMinimized,
    reloadApp,
    remoteVersion,
    checkMessage,
    dismissCheckMessage,
  } = useAppUpdate();

  // Auto-dismiss checkMessage after 6 seconds
  useEffect(() => {
    if (!checkMessage) return;
    const timer = setTimeout(() => {
      dismissCheckMessage();
    }, 6000);
    return () => clearTimeout(timer);
  }, [checkMessage, dismissCheckMessage]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress percentage (from 600s down to 0)
  const progressPct = Math.max(0, Math.min(100, ((600 - remainingSeconds) / 600) * 100));

  return (
    <>
      {/* Toast for manual check feedback */}
      {checkMessage && !isUpdateAvailable && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/95 border border-slate-700 text-slate-200 rounded-xl shadow-2xl backdrop-blur-md text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{checkMessage}</span>
            <button
              onClick={dismissCheckMessage}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Update Available Banner */}
      {isUpdateAvailable && (
        <>
          {!isMinimized ? (
            <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-full duration-300">
              <div className="bg-slate-950/95 border-b border-amber-500/30 text-slate-100 shadow-2xl backdrop-blur-md px-4 py-2.5 sm:py-3">
                <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-amber-300 tracking-wide uppercase">
                          Software Update Available
                        </span>
                        {remoteVersion && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                            v{remoteVersion}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                        A new version of KREA IT NOC has been deployed. Please reload the page to load the latest changes.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                    {/* Countdown indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span className="text-slate-400 text-[11px] hidden md:inline">Auto-reload in:</span>
                      <strong className="text-amber-400 font-bold">{formattedTime}</strong>
                    </div>

                    {/* Reload Button */}
                    <button
                      onClick={reloadApp}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reload Now</span>
                    </button>

                    {/* Minimize Button */}
                    <button
                      onClick={() => setIsMinimized(true)}
                      title="Minimize update banner"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar line showing time elapsed toward 10m auto-reload */}
                <div className="w-full bg-slate-900 h-0.5 mt-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-1000"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Minimized Floating Pill at Bottom-Right */
            <div className="fixed bottom-4 right-4 z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <span className="text-slate-300 text-[11px] hidden sm:inline">Update Ready:</span>
                <span className="text-amber-400 font-bold">{formattedTime}</span>

                <button
                  onClick={reloadApp}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reload</span>
                </button>

                <button
                  onClick={() => setIsMinimized(false)}
                  title="Expand update details"
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
