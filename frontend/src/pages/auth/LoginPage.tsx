import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../../api/client';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          action?: string;
          theme?: 'auto' | 'light' | 'dark';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              type?: string;
              shape?: string;
              text?: string;
              logo_alignment?: string;
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (error: string) => void;
  isLoading: boolean;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  clientId,
  onCredential,
  onError,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    // Dynamically inject Google Identity Services script if not already present
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    let active = true;

    const render = () => {
      if (!active || !containerRef.current || !window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            if (response.credential) {
              onCredential(response.credential);
            } else {
              onError('Google authentication failed. No valid credential received.');
            }
          },
          auto_select: false,
        });

        // Compute available container width up to 400px (Google GIS max width)
        const parentWidth = containerRef.current.parentElement?.clientWidth;
        const selfWidth = containerRef.current.clientWidth;
        const measuredWidth = parentWidth || selfWidth || 384;
        const targetWidth = Math.min(400, Math.max(200, Math.floor(measuredWidth)));

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: targetWidth,
        });
        setIsRendered(true);
      } catch (err) {
        console.error('Failed to render Google Sign-In button:', err);
      }
    };

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.google?.accounts?.id && containerRef.current) {
        clearInterval(interval);
        render();
      }
      if (attempts > 40) {
        clearInterval(interval);
      }
    }, 100);

    const handleResize = () => {
      if (window.google?.accounts?.id && containerRef.current) {
        render();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [clientId, onCredential, onError]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Explicit colorScheme: light wrapper suppresses browser's dark-mode iframe canvas artifact */}
      <div
        className={`w-full flex justify-center items-center rounded-lg transition-all duration-200 ${
          isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
        style={{ colorScheme: 'light' }}
      >
        <div
          ref={containerRef}
          className="w-full flex justify-center items-center min-h-[44px]"
        />
      </div>

      {(!isRendered || isLoading) && (
        <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-400 text-xs w-full mt-1.5 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>{isLoading ? 'Signing in with Google...' : 'Connecting to Google Single Sign-On...'}</span>
        </div>
      )}
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // Safely parse redirect query parameter (disallowing protocol-relative URLs)
  const rawRedirect = searchParams.get('redirect');
  const redirectTarget =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/noc';

  // If already authenticated, redirect immediately
  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 30000,
    retry: false,
  });

  // Fetch dynamic public auth configuration (Turnstile site key & Google client ID)
  const { data: authConfig } = useQuery({
    queryKey: ['auth-config'],
    queryFn: api.getAuthConfig,
    staleTime: 30000,
    retry: 2,
  });

  const isPasswordLoginDisabled =
    authConfig !== undefined &&
    (authConfig.password_login_enabled === false || authConfig.google_only === true);

  useEffect(() => {
    if (meData?.user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [meData, navigate, redirectTarget]);

  // Initialize Cloudflare Turnstile explicit widget
  useEffect(() => {
    const siteKey = authConfig?.turnstile_site_key;
    if (!siteKey || turnstileWidgetIdRef.current) return;

    const interval = setInterval(() => {
      if (window.turnstile && turnstileContainerRef.current) {
        clearInterval(interval);
        try {
          const widgetId = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: siteKey,
            action: 'login',
            theme: 'dark',
            callback: (token: string) => {
              setTurnstileToken(token);
              setErrorMsg('');
            },
            'error-callback': () => {
              setTurnstileToken('');
            },
            'expired-callback': () => {
              setTurnstileToken('');
            },
          });
          turnstileWidgetIdRef.current = widgetId;
        } catch {
          // Ignore if already rendered
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [authConfig?.turnstile_site_key]);

  // Handle Google OAuth Credential
  const handleGoogleCredentialResponse = async (credential: string) => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    try {
      await api.loginWithGoogle(credential);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Google authentication failed. Only @krea.edu.in accounts are permitted.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Check Turnstile token if site key configured
    if (authConfig?.turnstile_site_key && !turnstileToken) {
      setErrorMsg('Please verify the Cloudflare Turnstile security check.');
      return;
    }

    setIsLoading(true);

    try {
      await api.login(username, password, turnstileToken);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
      // Single-use token lifecycle: reset Turnstile on failed attempt to allow fresh retry
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileToken('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col justify-center items-center p-3 sm:p-6 select-none relative overflow-hidden">
      {/* Dynamic Background Mesh Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-80 h-80 bg-emerald-600/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Grid Overlay Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0a0f18]/90 border border-slate-800/90 rounded-2xl shadow-2xl p-5 sm:p-8 backdrop-blur-xl z-10 space-y-5 sm:space-y-6 relative border-t-2 border-t-blue-500">
        {/* Brand Header with Official Krea Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner flex items-center justify-center">
              <img
                src="https://cdn.krea.edu.in/logo.png"
                alt="Krea University"
                className="h-10 sm:h-12 w-auto object-contain max-w-[150px] sm:max-w-[180px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/krea-logo.png';
                }}
              />
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-blue-400 uppercase">
              Mission-Critical Infrastructure
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 mt-0.5">
              IT Operations Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Unified NOC Monitoring & Network Access Control
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isPasswordLoginDisabled ? (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-300">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Institutional Google SSO Enforced</span>
              </div>
              <p className="text-xs text-slate-300/90 leading-relaxed">
                Password-based sign-in is disabled. Please authenticate using your verified{' '}
                <span className="font-mono text-blue-300 font-semibold">@krea.edu.in</span> institutional Google account.
              </p>
            </div>

            {/* Google Single Sign-On Button */}
            {authConfig?.google_client_id && (
              <div className="pt-2">
                <GoogleSignInButton
                  clientId={authConfig.google_client_id}
                  onCredential={handleGoogleCredentialResponse}
                  onError={(err) => setErrorMsg(err)}
                  isLoading={isGoogleLoading}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Google Single Sign-On Section */}
            {authConfig?.google_client_id ? (
              <div className="space-y-3">
                <GoogleSignInButton
                  clientId={authConfig.google_client_id}
                  onCredential={handleGoogleCredentialResponse}
                  onError={(err) => setErrorMsg(err)}
                  isLoading={isGoogleLoading}
                />

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800/80" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-[#0a0f18] px-3 text-slate-500 font-mono tracking-widest">
                      OR OPERATOR CREDENTIALS
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Operator Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Secure Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Cloudflare Turnstile Bot Protection Widget */}
              <div className="flex flex-col items-center justify-center min-h-[66px] my-2">
                <div ref={turnstileContainerRef} className="cf-turnstile" />
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In To Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="pt-4 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Cloudflare Bot Protected
          </span>
          <span className="font-mono text-[10px]">RBAC Enforced</span>
        </div>
      </div>
    </div>
  );
};
