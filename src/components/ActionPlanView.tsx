import React from 'react';
import { useCases } from '../context/CaseContext';
import { CheckSquare, CheckCircle2, Clock, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { GrievanceCase } from '../types';

interface ActionPlanViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const ActionPlanView: React.FC<ActionPlanViewProps> = ({ onOpenCase }) => {
  const { cases, handleUpdateCase } = useCases();

  const handleToggleCaseProgress = async (c: GrievanceCase) => {
    const isCompleted = c.progress === 100 || c.status === 'Closed';
    const newProgress = isCompleted ? 50 : 100;
    const newStatus = isCompleted ? 'Action Taken' : 'Closed';
    await handleUpdateCase(
      c.id,
      {
        progress: newProgress,
        status: newStatus,
        closingDate: newStatus === 'Closed' ? new Date().toISOString().substring(0, 10) : undefined,
      },
      `CAPA progress updated to ${newProgress}% (${newStatus})`
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Corrective &amp; Preventive Action (CAPA) Central</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Siklus: Action Taken / Closed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor implementation deadlines, department PIC accountability, and toggle progress status (Completed / Progress)
          </p>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          Belum ada keluhan yang terdaftar. Daftarkan keluhan di menu Case Management.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => {
            const isCompleted = c.progress === 100 || c.status === 'Closed';

            return (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {c.ticketId}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {c.department}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{c.complaintCategory}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Assigned PIC: <strong>{c.assignedPic || 'Unassigned'}</strong></p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600">
                      <span>Status Remediasi</span>
                      <span className={`font-bold ${isCompleted ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {isCompleted ? 'Completed (100%)' : `In Progress (${c.progress}%)`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  {/* Toggle Completed / Progress button */}
                  <button
                    onClick={() => handleToggleCaseProgress(c)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 ${
                      isCompleted
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    {isCompleted ? (
                      <span>Ubah ke Progress</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tandai Completed</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenCase(c, 'action_plan')}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center space-x-1"
                  >
                    <span>Detail CAPA</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
