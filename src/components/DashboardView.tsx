import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BellRing,
  BookOpen,
  CalendarCheck,
  Coins,
  HandHeart,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BrowserPushPermission,
  ConsecutiveAbsenceAlert,
} from '../lib/attendanceMonitorService.ts';
import { initializeStarterMarkazWorkspace } from '../lib/markazDb.ts';
import { t } from '../shared/i18n.ts';
import { formatETB, todayISOEthiopia } from '../shared/quranData.ts';
import {
  AdmissionApplication,
  AttendanceRecord,
  Campaign,
  Donation,
  ExamRecord,
  Halaqah,
  HifzLog,
  MarkazLanguage,
  NavSectionId,
  Payment,
  Pledge,
  Sponsor,
  StaffMember,
  Student,
  UserProfile,
} from '../shared/types.ts';

interface DashboardViewProps {
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  halaqahs: Halaqah[];
  attendance: AttendanceRecord[];
  hifzLogs: HifzLog[];
  exams: ExamRecord[];
  payments: Payment[];
  sponsors: Sponsor[];
  campaigns: Campaign[];
  pledges: Pledge[];
  donations: Donation[];
  admissions: AdmissionApplication[];
  staff: StaffMember[];
  consecutiveAlerts?: ConsecutiveAbsenceAlert[];
  pushPermission?: BrowserPushPermission;
  onEnablePush?: () => void;
  onNavigate: (tab: NavSectionId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  user,
  students,
  halaqahs,
  attendance,
  hifzLogs,
  exams,
  payments,
  sponsors,
  pledges,
  donations,
  admissions,
  staff,
  consecutiveAlerts = [],
  pushPermission = 'default',
  onEnablePush,
  onNavigate,
}) => {
  const [initializing, setInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);

  const today = todayISOEthiopia();

  const metrics = useMemo(() => {
    const activeStudents = students.filter((s) => s.status === 'active');
    const maleCount = activeStudents.filter((s) => s.gender === 'male').length;
    const femaleCount = activeStudents.filter((s) => s.gender === 'female').length;
    const graduates = students.filter((s) => s.status === 'graduated').length;

    const todayStudentAtt = attendance.filter(
      (a) => a.recordType === 'student' && a.date === today
    );
    const presentToday = todayStudentAtt.filter(
      (a) => a.status === 'Present' || a.status === 'Late'
    ).length;
    const attendanceRate =
      todayStudentAtt.length > 0
        ? Math.round((presentToday / todayStudentAtt.length) * 100)
        : 0;

    const activePayments = payments.filter((p) => p.reversalStatus === 'active');
    const tuitionCollected = activePayments.reduce((acc, p) => acc + (p.amountETB || 0), 0);

    const activeSponsors = sponsors.filter((s) => s.status === 'active').length;
    const pendingAdmissions = admissions.filter(
      (a) => a.status === 'submitted' || a.status === 'under_review'
    ).length;

    const avgExamScore =
      exams.length > 0
        ? Math.round(exams.reduce((acc, e) => acc + (e.totalScore || 0), 0) / exams.length)
        : 0;

    const totalPledged = pledges
      .filter((p) => p.status !== 'cancelled')
      .reduce((acc, p) => acc + (p.amountETB || 0), 0);
    const totalDonated = donations.reduce((acc, d) => acc + (d.amountETB || 0), 0);

    // At-risk learners: Needs Revision or >= 2 absences
    const absenceByStudent = new Map<string, number>();
    for (const rec of attendance) {
      if (rec.recordType === 'student' && rec.status === 'Absent') {
        absenceByStudent.set(rec.targetId, (absenceByStudent.get(rec.targetId) || 0) + 1);
      }
    }
    const revisionFlags = new Set(
      hifzLogs.filter((l) => l.grade === 'Needs Revision').map((l) => l.studentId)
    );
    const atRisk = activeStudents.filter(
      (s) => (absenceByStudent.get(s.id) || 0) >= 2 || revisionFlags.has(s.id)
    );

    return {
      activeCount: activeStudents.length,
      maleCount,
      femaleCount,
      graduates,
      attendanceRate,
      todayAttTotal: todayStudentAtt.length,
      tuitionCollected,
      activeSponsors,
      pendingAdmissions,
      avgExamScore,
      totalPledged,
      totalDonated,
      atRisk,
      activeStaff: staff.filter((st) => st.employmentStatus === 'active').length,
    };
  }, [students, attendance, payments, sponsors, admissions, exams, pledges, donations, hifzLogs, staff, today]);

  const halaqahChartData = useMemo(() => {
    return halaqahs.map((h) => {
      const enrolled = students.filter(
        (s) => s.status === 'active' && s.halaqahId === h.id
      ).length;
      const logs = hifzLogs.filter((l) => l.halaqahId === h.id).length;
      return {
        name: h.name.replace('Halaqah ', '').slice(0, 16),
        students: enrolled,
        hifzEntries: logs,
      };
    });
  }, [halaqahs, students, hifzLogs]);

  const trackBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      full_hifz: 0,
      part_time_hifz: 0,
      nazirah_tajweed: 0,
      islamic_studies: 0,
    };
    for (const s of students.filter((st) => st.status === 'active')) {
      counts[s.track] = (counts[s.track] || 0) + 1;
    }
    return [
      { track: t(lang, 'track_full_hifz'), count: counts.full_hifz },
      { track: t(lang, 'track_part_time_hifz'), count: counts.part_time_hifz },
      { track: t(lang, 'track_nazirah_tajweed'), count: counts.nazirah_tajweed },
      { track: t(lang, 'track_islamic_studies'), count: counts.islamic_studies },
    ];
  }, [students, lang]);

  const handleInitWorkspace = async () => {
    setInitializing(true);
    setInitMessage(null);
    try {
      await initializeStarterMarkazWorkspace(user);
      setInitMessage('Markaz starter halaqahs, fee plans, and endowment campaign initialized.');
    } catch (err) {
      setInitMessage(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Starter Setup Banner if Empty Workspace for Management */}
      {(user.role === 'super_admin' || user.role === 'director') && halaqahs.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#C49A45]/60 bg-[#FBF8EE] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#C49A45]" />
            <div>
              <h3 className="text-sm font-bold text-[#0B3D2E]">
                Initialize Al-Furqaan Starter Workspace
              </h3>
              <p className="text-xs text-[#4A6355]">
                Create default Chiro Halaqah groups, ETB tuition fee plans, and Kafalat endowment
                campaign in Cloud Firestore.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={initializing}
            onClick={handleInitWorkspace}
            className="min-h-[40px] rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E] disabled:opacity-60 whitespace-nowrap"
          >
            {initializing ? t(lang, 'loading') : 'Initialize Markaz Defaults'}
          </button>
        </div>
      )}

      {initMessage && (
        <div className="rounded-xl border border-[#145A32]/30 bg-[#EAF3ED] px-4 py-3 text-xs font-medium text-[#0B3D2E]">
          {initMessage}
        </div>
      )}

      {/* 3-Day Consecutive Absence Alert Banner */}
      {consecutiveAlerts.length > 0 && (
        <div
          role="region"
          aria-label={t(lang, 'absenceStreakAlertTitle')}
          className="rounded-xl border-2 border-[#C49A45] bg-[#FFFBEB] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#B45309]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-[#78350F]">
                  {t(lang, 'absenceStreakAlertTitle')} ({consecutiveAlerts.length})
                </h3>
                <p className="mt-0.5 text-xs text-[#92400E]">
                  {t(lang, 'absenceStreakBannerSubtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pushPermission === 'default' && onEnablePush && (
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#C49A45] bg-white px-3 py-1.5 text-xs font-semibold text-[#78350F] hover:bg-[#FEF3C7]"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>{t(lang, 'enablePushAlerts')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#145A32] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0B3D2E]"
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>{t(lang, 'reviewAttendance')}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {consecutiveAlerts.slice(0, 6).map((alert) => (
              <div
                key={alert.alertKey}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#F59E0B]/40 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#0B3D2E]">
                    {alert.studentName}
                  </p>
                  <p className="font-mono-tabular text-[11px] text-[#4A6355]">
                    {alert.studentCode || alert.studentId}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block rounded bg-[#FEF3C7] px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-[#B45309]">
                    {alert.consecutiveDays}d
                  </span>
                  <p className="mt-0.5 font-mono-tabular text-[10px] text-[#78350F]">
                    {alert.dates[0]} → {alert.dates[2]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Grid — Tabular Numerals, Clean Borders */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4A6355]">
            <span>{t(lang, 'kpiActiveStudents')}</span>
            <Users className="h-4 w-4 text-[#145A32]" />
          </div>
          <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#0B3D2E]">
            {metrics.activeCount}
          </div>
          <div className="mt-1 flex gap-3 text-[11px] text-[#4A6355] tabular-nums">
            <span>{t(lang, 'male')}: {metrics.maleCount}</span>
            <span>{t(lang, 'female')}: {metrics.femaleCount}</span>
            <span>{t(lang, 'status_graduated')}: {metrics.graduates}</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4A6355]">
            <span>{t(lang, 'kpiAttendanceRate')}</span>
            <CalendarCheck className="h-4 w-4 text-[#145A32]" />
          </div>
          <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#0B3D2E]">
            {metrics.attendanceRate}%
          </div>
          <div className="mt-1 text-[11px] text-[#4A6355] tabular-nums">
            {today} • {metrics.todayAttTotal} logged
          </div>
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4A6355]">
            <span>{t(lang, 'kpiMonthlyRevenue')}</span>
            <Coins className="h-4 w-4 text-[#C49A45]" />
          </div>
          <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#0B3D2E]">
            {formatETB(metrics.tuitionCollected, lang)}
          </div>
          <div className="mt-1 text-[11px] text-[#4A6355] tabular-nums">
            Donations: {formatETB(metrics.totalDonated, lang)}
          </div>
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4A6355]">
            <span>{t(lang, 'kpiActiveSponsors')}</span>
            <HandHeart className="h-4 w-4 text-[#C49A45]" />
          </div>
          <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#0B3D2E]">
            {metrics.activeSponsors}
          </div>
          <div className="mt-1 text-[11px] text-[#4A6355] tabular-nums">
            Pledged: {formatETB(metrics.totalPledged, lang)}
          </div>
        </div>
      </div>

      {/* Secondary Executive Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('admissions')}
          className="rounded-xl border border-[#D6E3DA] bg-white p-4 text-start transition hover:border-[#145A32]"
        >
          <p className="text-xs font-semibold text-[#4A6355]">{t(lang, 'kpiPendingAdmissions')}</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#145A32]">
            {metrics.pendingAdmissions}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('exams')}
          className="rounded-xl border border-[#D6E3DA] bg-white p-4 text-start transition hover:border-[#145A32]"
        >
          <p className="text-xs font-semibold text-[#4A6355]">{t(lang, 'kpiAvgExamScore')}</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#145A32]">
            {metrics.avgExamScore} / 100
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('hifz')}
          className="rounded-xl border border-[#D6E3DA] bg-white p-4 text-start transition hover:border-[#145A32]"
        >
          <p className="text-xs font-semibold text-[#4A6355]">{t(lang, 'kpiAtRiskLearners')}</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#B45309]">
            {metrics.atRisk.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('staff')}
          className="rounded-xl border border-[#D6E3DA] bg-white p-4 text-start transition hover:border-[#145A32]"
        >
          <p className="text-xs font-semibold text-[#4A6355]">{t(lang, 'nav_staff')}</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#145A32]">
            {metrics.activeStaff}
          </p>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
                Halaqah Enrollment & Hifz Log Activity
              </h3>
              <p className="text-xs text-[#4A6355]">Live Firestore counts per study circle</p>
            </div>
            <BookOpen className="h-4 w-4 text-[#145A32]" />
          </div>
          {halaqahChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[#D6E3DA] text-xs text-[#4A6355]">
              {t(lang, 'noRecords')}
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={halaqahChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EEE8" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334E3F' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#334E3F' }} />
                  <Tooltip />
                  <Bar dataKey="students" name="Students" fill="#145A32" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hifzEntries" name="Hifz Logs" fill="#C49A45" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
                {t(lang, 'track')} Breakdown
              </h3>
              <p className="text-xs text-[#4A6355]">Active student enrollment distribution</p>
            </div>
            <Award className="h-4 w-4 text-[#C49A45]" />
          </div>
          <div className="space-y-3">
            {trackBreakdown.map((item) => {
              const pct =
                metrics.activeCount > 0 ? Math.round((item.count / metrics.activeCount) * 100) : 0;
              return (
                <div key={item.track}>
                  <div className="mb-1 flex justify-between text-xs font-medium">
                    <span className="text-[#0E2419]">{item.track}</span>
                    <span className="font-mono-tabular text-[#145A32]">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAF3ED]">
                    <div
                      className="h-full rounded-full bg-[#145A32]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* At-Risk Learners Alert Table */}
      <div className="rounded-xl border border-[#D6E3DA] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#B45309]" />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'kpiAtRiskLearners')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('hifz')}
            className="text-xs font-semibold text-[#145A32] hover:underline"
          >
            {t(lang, 'nav_hifz')} →
          </button>
        </div>

        {metrics.atRisk.length === 0 ? (
          <p className="py-4 text-xs text-[#4A6355]">
            All active learners are maintaining satisfactory attendance and Hifz revision consistency.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D6E3DA] text-[#4A6355]">
                <tr>
                  <th className="py-2 pr-3 font-semibold">{t(lang, 'studentCode')}</th>
                  <th className="py-2 pr-3 font-semibold">{t(lang, 'fullName')}</th>
                  <th className="py-2 pr-3 font-semibold">{t(lang, 'halaqah')}</th>
                  <th className="py-2 pr-3 font-semibold">{t(lang, 'currentSurah')}</th>
                  <th className="py-2 text-right font-semibold">{t(lang, 'juzLevel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3ED]">
                {metrics.atRisk.slice(0, 8).map((s) => (
                  <tr key={s.id} className="hover:bg-[#F9FBF9]">
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[#145A32]">
                      {s.code}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-[#0E2419]">{s.fullName}</td>
                    <td className="py-2.5 pr-3 text-[#4A6355]">{s.halaqahGroup || '—'}</td>
                    <td className="py-2.5 pr-3 text-[#4A6355]">{s.currentSurah}</td>
                    <td className="py-2.5 text-right font-mono-tabular">{s.juzLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
