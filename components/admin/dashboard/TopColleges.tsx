'use client';

import { Building2 } from 'lucide-react';

interface CollegeData {
  college: string | null;
  _count: number;
}

interface TopCollegesProps {
  data: CollegeData[];
}

export function TopColleges({ data }: TopCollegesProps) {
  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d._count)) : 0;

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-4 w-4 text-gray-500" />
        <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase">
          TOP_COLLEGES
        </h3>
      </div>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
          NO DATA AVAILABLE
        </div>
      ) : (
        <div className="space-y-3">
          {data.slice(0, 8).map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-600 w-5 text-right font-bold">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-300 truncate">
                    {item.college || 'Unknown'}
                  </span>
                  <span className="text-xs font-mono font-bold text-orange-400 ml-2">
                    {item._count}
                  </span>
                </div>
                <div className="w-full bg-white/[0.03] rounded-sm h-1">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-sm h-1 transition-all"
                    style={{
                      width: `${maxCount > 0 ? (item._count / maxCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
