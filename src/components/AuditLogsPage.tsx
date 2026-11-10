import React, { useState, useMemo } from 'react';
import { DatabaseState } from '../types/database';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface AuditLogsPageProps {
  db: DatabaseState;
  activeUserId: string;
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({
  db,
  activeUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  const activeUser = useMemo(
    () => db.Users.find((u) => u.UserID === activeUserId),
    [db.Users, activeUserId]
  );
  const activeRole = useMemo(
    () => db.Roles.find((r) => r.RoleID === activeUser?.RoleID),
    [db.Roles, activeUser]
  );

  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    db.AuditLogs.forEach((l) => set.add(l.Module));
    return Array.from(set);
  }, [db.AuditLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.AuditLogs.filter((log) => {
      if (selectedModule !== 'ALL' && log.Module !== selectedModule) {
        return false;
      }
      if (!q) return true;
      return (
        log.LogID.toLowerCase().includes(q) ||
        log.UserID.toLowerCase().includes(q) ||
        log.Action.toLowerCase().includes(q) ||
        log.Module.toLowerCase().includes(q) ||
        log.RecordID.toLowerCase().includes(q) ||
        log.Description.toLowerCase().includes(q) ||
        log.OldValueJSON.toLowerCase().includes(q) ||
        log.NewValueJSON.toLowerCase().includes(q)
      );
    });
  }, [db.AuditLogs, searchQuery, selectedModule]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 font-mono-tabular">
            <Activity className="w-4 h-4" />
            <span>AuditLogsPage.tsx · Phase 11 Security & Activity Audit Trail (AuditService.gs)</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 font-khmer-moul mt-1">
            កំណត់ហេតុសុវត្ថិភាព និងសកម្មភាពប្រព័ន្ធ (AuditLogs Sheet #19)
          </h2>
          <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
            កត់ត្រាគ្រប់សកម្មភាពទាំងអស់ (UserID, Action, Module, OldValueJSON, NewValueJSON, Timestamp) សម្រាប់ការត្រួតពិនិត្យរបស់គណៈគ្រប់គ្រងសាលា។
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold font-khmer-body text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>ចំនួនកំណត់ហេតុសរុប៖ {db.AuditLogs.length} កំណត់ត្រា</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold font-mono-tabular text-blue-700">
            Role: {activeRole?.RoleName || 'TEACHER'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar + Paginated Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ស្វែងរកតាម UserID, Action, Module, ឬ JSON..."
              aria-label="ស្វែងរកកំណត់ហេតុសុវត្ថិភាព"
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white font-khmer-body focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <label htmlFor="audit-module-select" className="text-xs font-bold text-slate-700 font-khmer-body">
              ម៉ូឌុល (.gs)៖
            </label>
            <select
              id="audit-module-select"
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white font-mono-tabular cursor-pointer"
            >
              <option value="ALL">ទាំងអស់ ({db.AuditLogs.length})</option>
              {uniqueModules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sticky First Columns Horizontal Scroll Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs font-khmer-body min-w-[980px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-100 py-2.5 px-3 w-24 border-r border-slate-200">
                  LogID
                </th>
                <th className="sticky left-24 z-10 bg-slate-100 py-2.5 px-3 w-32 border-r border-slate-200">
                  UserID
                </th>
                <th className="py-2.5 px-3 w-48">Action</th>
                <th className="py-2.5 px-3 w-40">Module</th>
                <th className="py-2.5 px-3 w-28">RecordID</th>
                <th className="py-2.5 px-3 w-48">OldValueJSON</th>
                <th className="py-2.5 px-3 w-56">NewValueJSON</th>
                <th className="py-2.5 px-3">Description & Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {paginatedLogs.map((log) => {
                const isDenied = log.Action.includes('DENIED');
                const userObj = db.Users.find((u) => u.UserID === log.UserID);
                return (
                  <tr
                    key={log.LogID}
                    className={`transition-colors ${
                      isDenied ? 'bg-red-50/40 hover:bg-red-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white py-2.5 px-3 font-mono-tabular font-bold text-slate-800 border-r border-slate-200">
                      {log.LogID}
                    </td>
                    <td className="sticky left-24 z-10 bg-white py-2.5 px-3 border-r border-slate-200">
                      <div className="font-mono-tabular font-bold text-slate-900">
                        {log.UserID}
                      </div>
                      {userObj && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[115px]">
                          {userObj.FullNameKh}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono-tabular text-[11px] font-bold ${
                          isDenied
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isDenied && <ShieldAlert className="w-3 h-3 text-red-600" />}
                        <span>{log.Action}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular font-semibold text-indigo-700">
                      {log.Module}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                      {log.RecordID}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-slate-500 max-w-[180px] truncate" title={log.OldValueJSON}>
                      {log.OldValueJSON}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-emerald-700 max-w-[220px] truncate" title={log.NewValueJSON}>
                      {log.NewValueJSON}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{log.Description}</div>
                      <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                        {log.Timestamp} · {log.IPOrSessionReference}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between pt-2 text-xs font-khmer-body text-slate-600">
          <div>
            បង្ហាញជួរទី {(currentPage - 1) * pageSize + 1} ដល់{' '}
            {Math.min(currentPage * pageSize, filteredLogs.length)} នៃ {filteredLogs.length} កំណត់ត្រា
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="ទំព័រមុន"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono-tabular font-bold text-slate-800">
              ទំព័រ {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="ទំព័របន្ទាប់"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
