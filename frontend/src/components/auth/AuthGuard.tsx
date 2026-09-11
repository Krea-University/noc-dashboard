import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/client';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const location = useLocation();

  const { data: meData, isLoading: isMeLoading, isError: isMeError } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 60000,
    retry: false,
  });

  if (isMeLoading) {
    return (
      <div className="min-h-screen bg-[#06090e] flex flex-col items-center justify-center text-slate-400 space-y-4 select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
          <Loader2 className="w-5 h-5 text-blue-400 absolute animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
            Verifying KREA NOC Authentication...
          </p>
          <p className="text-[10px] text-slate-600 font-mono mt-1">
            Access restricted to authorized university operators
          </p>
        </div>
      </div>
    );
  }

  if (isMeError || !meData?.user) {
    // Retain target destination including path and search parameters
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace />;
  }

  return <>{children}</>;
};
