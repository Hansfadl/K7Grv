import React from 'react';
import { useCases } from '../context/CaseContext';
import { MessageSquare, Lock, ArrowRight } from 'lucide-react';
import { GrievanceCase } from '../types';

interface CommunicationViewProps {
  onOpenCase: (c: GrievanceCase, tab?: any) => void;
}

export const CommunicationView: React.FC<CommunicationViewProps> = ({ onOpenCase }) => {
  const { cases } = useCases();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">Communication &amp; Official HR Memo Registry</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Audited repository of formal directives, meeting minutes, and legal advisory memos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cases.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {c.ticketId}
              </span>
              <span className="text-xs font-semibold text-slate-600">{c.department}</span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900">{c.complaintCategory}</h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{c.description}</p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500">Intake: {c.channelReceived}</span>
              <button
                onClick={() => onOpenCase(c, 'communication')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Memos</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
