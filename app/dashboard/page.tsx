'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HackathonForm from '@/app/components/HackathonForm';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [assignedProblem, setAssignedProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [multipleTeams, setMultipleTeams] = useState<any[] | null>(null);

  const fetchData = React.useCallback(
    (track?: string) => {
      const url = track ? `/api/user/me?track=${track}` : '/api/user/me';
      // Only show loader for subsequent explicit track switches
      if (track) setLoading(true);

      fetch(url)
        .then((res) => res.json())
        .then((resData) => {
          if (!resData.success) {
            throw new Error(resData.error || 'Failed to fetch user data');
          }

          if (resData.multipleTeams) {
            setMultipleTeams(resData.teams);
          } else {
            setData({ ...resData.data, isLocked: resData.isLocked });
            if (resData.initialAssignedProblem) {
              setAssignedProblem(resData.initialAssignedProblem);
            }
            setMultipleTeams(null);
          }
        })
        .catch((err) => {
          setErrorMsg(err.message);
          router.push('/login');
        })
        .finally(() => setLoading(false));
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center font-mono">
        <div className="animate-pulse text-orange-500 uppercase tracking-widest text-xs">
          LOADING_DOSSIER...
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center font-mono p-4">
        <div className="text-red-500 uppercase tracking-widest text-xs text-center">
          <p className="mb-4 font-bold">ERROR OCCURRED</p>
          <p>{errorMsg}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-8 border border-white/20 px-6 py-2 hover:bg-white/5 transition-colors text-white"
          >
            RETURN_TO_BASE
          </button>
        </div>
      </div>
    );
  }

  if (multipleTeams) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center font-mono p-4">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">
              Select <span className="text-orange-500">Edition</span>
            </h1>
            <p className="text-gray-400 text-[10px] tracking-[0.3em] uppercase">
              Multiple Registrations Detected
            </p>
          </div>

          <div className="space-y-4">
            {multipleTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => fetchData(team.track)}
                className="w-full border border-white/10 bg-[#050505] p-6 text-left hover:border-orange-500/50 transition-all group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="text-[10px] text-orange-500 font-black tracking-widest uppercase mb-1">
                    {team.trackDisplay.split(':')[0]}
                  </div>
                  <div className="text-xl font-bold uppercase tracking-tight group-hover:text-orange-400 transition-colors uppercase">
                    {team.name}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-2 uppercase tracking-wide">
                    Click to update submission
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors"></div>
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/api/logout')}
              className="text-[10px] text-gray-600 hover:text-gray-400 uppercase tracking-widest transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <main>
      <HackathonForm
        key={data.teamId || data.track}
        initialData={data}
        isEditMode={true}
        isLocked={!!(data as any).isLocked}
        initialAssignedProblem={assignedProblem}
      />
    </main>
  );
}
