import React, { useState } from 'react';
import { GAS_BACKEND_MODULES, GasModuleFile } from '../lib/gasBackendModules';
import { invokeGasApi, isGasEnvironmentAvailable } from '../lib/gasBridge';
import { Code2, Copy, Check, Play, Terminal } from 'lucide-react';

export const GasArchitectureView: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<GasModuleFile>(GAS_BACKEND_MODULES[5]); // Default to Authorization.gs
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [rpcOutput, setRpcOutput] = useState<string>(
    JSON.stringify(
      {
        status: 'READY',
        transport: isGasEnvironmentAvailable()
          ? 'GOOGLE_APPS_SCRIPT (HtmlService)'
          : 'LOCAL_PREVIEW_FALLBACK (google.script.run Safe Mock Service)',
        loadedModules: 17,
        databaseSheets: 19,
        securityPolicy: 'Authorization.canManageQuestion(userId, questionId, action)',
      },
      null,
      2
    )
  );

  const handleCopyCode = (mod: GasModuleFile) => {
    navigator.clipboard.writeText(mod.code);
    setCopiedId(mod.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulateGasRpc = async (callName: string) => {
    if (callName === 'initializeAll19Sheets') {
      const res = await invokeGasApi(
        'Database',
        'initializeAll19Sheets',
        { verifyHeaders: true },
        () => ({
          rpcCall: 'google.script.run.apiDispatch({ module: "Database", action: "initializeAll19Sheets" })',
          totalSheetsVerified: 19,
          sheets: [
            'Users', 'Roles', 'AcademicYears', 'Semesters', 'Classes',
            'Students', 'Enrollments', 'Subjects', 'TeacherSubjectAssignments',
            'Exams', 'Questions', 'ExamAttempts', 'ExamAnswers',
            'MonthlyScores', 'SemesterScores', 'AnnualResults',
            'GradingScales', 'SystemSettings', 'AuditLogs',
          ],
        })
      );
      setRpcOutput(JSON.stringify(res, null, 2));
    } else if (callName === 'canManageQuestion') {
      const res = await invokeGasApi(
        'Authorization',
        'canManageQuestion',
        { userId: 'USR-TCH-12C', questionId: 'QST-ICT-001', action: 'EDIT' },
        () => ({
          rpcCall: 'Authorization.canManageQuestion("USR-TCH-12C", "QST-ICT-001", "EDIT")',
          allowed: true,
          actor: 'ជួន លីរតនៈ (TEACHER)',
          subjectAssignedCheck: 'SUB-ICT ∈ [SUB-ICT] (PASS)',
          createdByOwnerCheck: 'QST-ICT-001.CreatedByUserID === "USR-TCH-12C" (PASS)',
        })
      );
      setRpcOutput(JSON.stringify(res, null, 2));
    } else {
      const res = await invokeGasApi(
        'ReportService',
        'splitTwoColumns1To35And36To70',
        { classId: 'CLS-12C' },
        () => ({
          rpcCall: 'ReportService.splitTwoColumns1To35And36To70(class12CRankedRows)',
          className: '12C',
          leftColumnRange: 'ល.រ 1..35 (35 slots)',
          rightColumnRange: 'ល.រ 36..70 (35 slots, 3 active students + 32 blank print rows)',
          femalePrefixApplied: 'ក.គឿង កន្និកា',
        })
      );
      setRpcOutput(JSON.stringify(res, null, 2));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 font-medium">
            Google Apps Script Backend · 17 Modular .gs Services · HtmlService + google.script.run
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-khmer-body mt-1">
            ស្ថាបត្យកម្ម Backend Google Apps Script ទាំង ១៧ ម៉ូឌុល (.gs)
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Modular server-side services designed for Google Sheets + Google Drive today and clean repository migration to PostgreSQL / MySQL later.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSimulateGasRpc('initializeAll19Sheets')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test Database.initializeAll19Sheets()</span>
          </button>
          <button
            type="button"
            onClick={() => handleSimulateGasRpc('canManageQuestion')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test Authorization.canManageQuestion()</span>
          </button>
          <button
            type="button"
            onClick={() => handleSimulateGasRpc('splitTwoColumns')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test ReportService.gs</span>
          </button>
        </div>
      </div>

      {/* Main Split View: 17 .gs Files List + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              17 Backend .gs Modules
            </span>
            <span className="text-xs font-mono-tabular text-slate-500">
              Apps Script V8
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {GAS_BACKEND_MODULES.map((mod) => {
              const isSelected = mod.filename === selectedModule.filename;
              return (
                <button
                  key={`${mod.id}-${mod.filename}`}
                  type="button"
                  onClick={() => setSelectedModule(mod)}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono-tabular ${
                          isSelected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {String(mod.id).padStart(2, '0')}.
                      </span>
                      <span className="text-xs font-mono-tabular font-bold truncate">
                        {mod.filename}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] font-khmer-body mt-0.5 truncate ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {mod.summaryKh}
                    </div>
                  </div>
                  <Code2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isSelected ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="lg:col-span-8 space-y-6">
          {/* Code Inspector Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {selectedModule.filename}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Exports: {selectedModule.exportedFunctions.join(', ')}</span>
                </div>
                <p className="text-xs text-slate-700 font-khmer-body mt-0.5">
                  {selectedModule.summaryKh} — {selectedModule.summaryEn}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyCode(selectedModule)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0 self-start"
              >
                {copiedId === selectedModule.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied .gs</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy {selectedModule.filename}</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono-tabular overflow-x-auto leading-relaxed max-h-[420px]">
              <code>{selectedModule.code}</code>
            </pre>
          </div>

          {/* google.script.run Bridge Console */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span>google.script.run RPC Response Inspector</span>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                HtmlService + Safe Preview Fallback
              </span>
            </div>
            <pre className="p-4 bg-slate-900 text-emerald-300 text-xs font-mono-tabular overflow-x-auto">
              <code>{rpcOutput}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};
