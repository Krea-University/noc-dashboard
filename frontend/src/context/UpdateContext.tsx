import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppVersionInfo } from '../types';

interface UpdateContextType {
  currentBuildId: string;
  remoteBuildId: string | null;
  currentVersion: string;
  remoteVersion: string | null;
  isUpdateAvailable: boolean;
  detectedAt: number | null;
  remainingSeconds: number;
  isMinimized: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkMessage: string | null;
  checkForUpdate: (manual?: boolean) => Promise<boolean>;
  reloadApp: () => void;
  setIsMinimized: (val: boolean) => void;
  dismissCheckMessage: () => void;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

const STORAGE_KEY_DETECTED = 'krea_noc_update_detected_at';
const STORAGE_KEY_MINIMIZED = 'krea_noc_update_minimized';
const AUTO_RELOAD_SECONDS = 600; // 10 minutes

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-build';
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [detectedAt, setDetectedAt] = useState<number | null>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY_DETECTED);
    return saved ? Number(saved) : null;
  });
  const [remainingSeconds, setRemainingSeconds] = useState<number>(AUTO_RELOAD_SECONDS);
  const [isMinimized, setIsMinimizedState] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_KEY_MINIMIZED) === 'true';
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const isReloadingRef = useRef(false);

  const setIsMinimized = (val: boolean) => {
    setIsMinimizedState(val);
    sessionStorage.setItem(STORAGE_KEY_MINIMIZED, val ? 'true' : 'false');
  };

  const dismissCheckMessage = () => {
    setCheckMessage(null);
  };

  const reloadApp = useCallback(() => {
    if (isReloadingRef.current) return;
    isReloadingRef.current = true;
    sessionStorage.removeItem(STORAGE_KEY_DETECTED);
    sessionStorage.removeItem(STORAGE_KEY_MINIMIZED);
    window.location.reload();
  }, []);

  const checkForUpdate = useCallback(
    async (manual: boolean = false): Promise<boolean> => {
      setIsChecking(true);
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (!res.ok) {
          if (manual) {
            setCheckMessage('Unable to reach update service. Please try again.');
          }
          return false;
        }

        const data: AppVersionInfo = await res.json();
        setLastChecked(new Date());

        if (data && data.buildId && data.buildId !== currentBuildId) {
          setRemoteBuildId(data.buildId);
          setRemoteVersion(data.version || currentVersion);
          setIsUpdateAvailable(true);

          let detected = detectedAt;
          if (!detected) {
            detected = Date.now();
            setDetectedAt(detected);
            sessionStorage.setItem(STORAGE_KEY_DETECTED, String(detected));
          }

          if (manual) {
            setCheckMessage('A new software update is available!');
          }
          return true;
        } else {
          if (manual) {
            setCheckMessage(`You are running the latest version (v${currentVersion}).`);
          }
          return false;
        }
      } catch (err) {
        if (manual) {
          setCheckMessage('Update check failed. Check network connectivity.');
        }
        return false;
      } finally {
        setIsChecking(false);
      }
    },
    [currentBuildId, currentVersion, detectedAt]
  );

  // Initial check on app mount
  useEffect(() => {
    checkForUpdate(false);
  }, [checkForUpdate]);

  // Periodic check every 60 seconds
  useEffect(() => {
    const interval = window.setInterval(() => {
      checkForUpdate(false);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [checkForUpdate]);

  // Check on tab focus or visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [checkForUpdate]);

  // 10-minute countdown timer & auto-reload
  useEffect(() => {
    if (!isUpdateAvailable) return;

    let initialDetected = detectedAt;
    if (!initialDetected) {
      initialDetected = Date.now();
      setDetectedAt(initialDetected);
      sessionStorage.setItem(STORAGE_KEY_DETECTED, String(initialDetected));
    }

    const tick = () => {
      const targetTime = initialDetected! + AUTO_RELOAD_SECONDS * 1000;
      const secondsLeft = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        reloadApp();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isUpdateAvailable, detectedAt, reloadApp]);

  return (
    <UpdateContext.Provider
      value={{
        currentBuildId,
        remoteBuildId,
        currentVersion,
        remoteVersion,
        isUpdateAvailable,
        detectedAt,
        remainingSeconds,
        isMinimized,
        isChecking,
        lastChecked,
        checkMessage,
        checkForUpdate,
        reloadApp,
        setIsMinimized,
        dismissCheckMessage,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

export const useAppUpdate = (): UpdateContextType => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within an UpdateProvider');
  }
  return context;
};
