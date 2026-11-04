import React from 'react';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { Search, Clock, ArrowRight, UserCheck, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { GrievanceCase } from '../types';

interface InvestigationViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();
  const { currentUser } = useAuth();

  const activeInvestigations = cases.filter(
    (c) => c.status === 'Investigation'
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Active Investigation Command</h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
              {activeInvestigations.length} Cases in Progress
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conduct formal witness depositions, credibility evaluations, and chronology reconstructions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeInvestigations.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            No active investigations currently in progress.
          </div>
        ) : (
          activeInvestigations.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {c.ticketId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.priority === 'Critical'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {c.priority} Priority
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-tight">
                  {c.complaintCategory}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Department: <strong className="text-slate-700">{c.department}</strong> • Complainant:{' '}
                  <strong>{c.isAnonymous ? c.anonymousAlias || 'Protected Reporter' : c.employeeName}</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 line-clamp-2">
                {c.description}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-1 text-slate-500 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>SLA Due: {c.dueDate}</span>
                </div>
                <button
                  onClick={() => onOpenCase(c, 'investigation')}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition"
                >
                  <span>Open Investigation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
