import React, { useState } from 'react';
import { DatabaseState } from '../types/database';
import { ReportCategoryId, ReportSubItemId } from './ReportCenterView';
import { SuperAdminDashboardSection } from './SuperAdminDashboardSection';
import { GasAdapterConfig } from '../lib/gasPersistenceAdapter';

export type DashboardPortalMode =
  | 'ADMIN_DASHBOARD'
  | 'TEACHER_DASHBOARD'
  | 'STUDENT_MOBILE_PROFILE';

export type DashboardSubSectionMode =
  | 'MAIN_DASHBOARD'
  | 'ACADEMIC_STATISTICS'
  | 'PERFORMANCE_OVERVIEW';

interface GrowlyDashboardViewProps {
  db: DatabaseState;
  activeUserId?: string;
  searchQuery?: string;
  adapterConfig?: GasAdapterConfig;
  dashboardSubMode?: DashboardSubSectionMode;
  onChangeDashboardSubMode?: (mode: DashboardSubSectionMode) => void;
  onNavigateSection: (section: string) => void;
  onOpenReportShortcut?: (
    category: ReportCategoryId,
    subReport: ReportSubItemId
  ) => void;
}

export const GrowlyDashboardView: React.FC<GrowlyDashboardViewProps> = ({
  db,
  activeUserId = 'USR-TCH-12C',
  adapterConfig,
  onNavigateSection,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  return (
    <div className="space-y-6">
      <SuperAdminDashboardSection
        db={db}
        activeUserId={activeUserId}
        selectedClassId={selectedClassId}
        onSelectClassId={setSelectedClassId}
        adapterConfig={adapterConfig}
        onNavigateSection={onNavigateSection}
      />
    </div>
  );
};
