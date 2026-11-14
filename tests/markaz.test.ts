import { describe, expect, it } from 'vitest';
import express from 'express';
import { createApiRouter } from '../server/routes.ts';
import {
  computeExamGrade,
  detectDuplicateStudent,
  formatETB,
  formatSequentialCode,
  QURAN_SURAHS,
} from '../src/shared/quranData.ts';
import { detectThreeDayConsecutiveAbsences } from '../src/lib/attendanceMonitorService.ts';
import { t } from '../src/shared/i18n.ts';
import { AttendanceRecord, ROLE_NAV_ACCESS, Student } from '../src/shared/types.ts';

describe('Al-Furqaan Markaz Domain & Security Verification', () => {
  it('provides all 114 Quran Surahs and trilingual dictionary completeness', () => {
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(QURAN_SURAHS[0].latin).toBe('Al-Fatihah');
    expect(QURAN_SURAHS[113].latin).toBe('An-Nas');
    expect(t('om', 'brandMain')).toContain('AL-FURQAAN');
    expect(t('ar', 'brandMain')).toContain('الْفُرْقَانِ');
    expect(t('en', 'brandMain')).toContain('AL-FURQAAN');
  });

  it('formats sequential AFQ codes and ETB currency properly', () => {
    expect(formatSequentialCode('AFQ', 7, '2026')).toBe('AFQ-2026-000007');
    expect(formatSequentialCode('AFQ-RCP', 42, '2026')).toBe('AFQ-RCP-2026-000042');
    expect(formatSequentialCode('AFQ-CERT', 1, 'BATCH1447')).toBe('AFQ-CERT-BATCH1447-000001');
    expect(formatETB(1500, 'en')).toBe('1,500 ETB');
  });

  it('detects duplicate student registrations by name+phone or name+DOB', () => {
    const existing = [
      {
        id: 'stu1',
        code: 'AFQ-2026-000001',
        fullName: 'Abdurrahman Ahmad',
        guardianPhone: '+251911223344',
        dob: '2014-05-10',
      },
    ];
    const match = detectDuplicateStudent(
      { fullName: 'abdurrahman   ahmad', guardianPhone: '0911223344', dob: '' },
      existing
    );
    expect(match?.code).toBe('AFQ-2026-000001');
    expect(
      detectDuplicateStudent(
        { fullName: 'Yusuf Ibrahim', guardianPhone: '0911223344', dob: '' },
        existing
      )
    ).toBeNull();
  });

  it('computes exam grades and restricts Guardian role navigation scope', () => {
    expect(computeExamGrade(95)).toBe('Mumtaz');
    expect(computeExamGrade(82)).toBe('Jayyid Jiddan');
    expect(computeExamGrade(50)).toBe('Needs Revision');
    expect(ROLE_NAV_ACCESS.guardian).toEqual(['guardian_portal', 'notifications']);
    expect(ROLE_NAV_ACCESS.muallim).not.toContain('finance');
  });

  it('serves /api/v1/health and PDF/XLSX export endpoints cleanly', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1', createApiRouter());

    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3001;

    try {
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.ok).toBe(true);
      expect(healthJson.service).toBe('al-furqaan-markaz');

      const pdfRes = await fetch(`http://127.0.0.1:${port}/api/v1/exports/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Executive Markaz Overview Report',
          narrativeText: 'Active students increased steadily with strong Sabqi and Manzil attendance.',
          kpis: [{ label: 'Active Students', value: '42' }],
          columns: ['Code', 'Name'],
          rows: [['AFQ-2026-000001', 'Test Student']],
        }),
      });
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('content-type')).toContain('application/pdf');

      const pptxRes = await fetch(`http://127.0.0.1:${port}/api/v1/exports/pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Executive Markaz Overview Report',
          narrativeText: 'Executive Summary\n\nActive learners completed 128 Sabaq entries.',
          kpis: [{ label: 'Active Students', value: '42' }],
          columns: ['Code', 'Name'],
          rows: [['AFQ-2026-000001', 'Test Student']],
        }),
      });
      expect(pptxRes.status).toBe(200);
      expect(pptxRes.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );

      const xlsxRes = await fetch(`http://127.0.0.1:${port}/api/v1/exports/xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetName: 'Students',
          columns: ['Code', 'Name'],
          rows: [['AFQ-2026-000001', 'Test Student']],
        }),
      });
      expect(xlsxRes.status).toBe(200);
      expect(xlsxRes.headers.get('content-type')).toContain('spreadsheetml.sheet');
    } finally {
      server.close();
    }
  });

  it('detects 3+ consecutive days of student absence while ignoring gaps and non-absent sessions', () => {
    const baseStudents: Student[] = [
      {
        id: 'stu-streak',
        code: 'AFQ-2026-000010',
        fullName: 'Bilal Hassan',
        dob: '2013-02-01',
        age: 13,
        gender: 'male',
        guardianIds: [],
        guardianName: 'Hassan Ali',
        guardianPhone: '+251911000010',
        address: 'Chiro',
        track: 'full_hifz',
        currentSurah: 'Al-Baqarah',
        juzLevel: 5,
        halaqahId: 'hlq-1',
        halaqahGroup: 'Halaqah 1',
        status: 'active',
        kafalatEligible: false,
        enrollmentDate: '2026-01-01',
        admissionSource: 'manual',
        institutionId: 'al-furqaan-chiro',
        createdBy: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'stu-gap',
        code: 'AFQ-2026-000011',
        fullName: 'Sumayyah Yusuf',
        dob: '2014-03-10',
        age: 12,
        gender: 'female',
        guardianIds: [],
        guardianName: 'Yusuf Omar',
        guardianPhone: '+251911000011',
        address: 'Chiro',
        track: 'nazirah_tajweed',
        currentSurah: 'An-Naba',
        juzLevel: 1,
        halaqahId: 'hlq-2',
        halaqahGroup: 'Halaqah 2',
        status: 'active',
        kafalatEligible: false,
        enrollmentDate: '2026-01-01',
        admissionSource: 'manual',
        institutionId: 'al-furqaan-chiro',
        createdBy: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'stu-withdrawn',
        code: 'AFQ-2026-000012',
        fullName: 'Archived Student',
        dob: '2012-01-01',
        age: 14,
        gender: 'male',
        guardianIds: [],
        guardianName: 'Guardian',
        guardianPhone: '+251911000012',
        address: 'Chiro',
        track: 'full_hifz',
        currentSurah: 'Al-Fatihah',
        juzLevel: 1,
        halaqahId: 'hlq-1',
        halaqahGroup: 'Halaqah 1',
        status: 'withdrawn',
        kafalatEligible: false,
        enrollmentDate: '2026-01-01',
        admissionSource: 'manual',
        institutionId: 'al-furqaan-chiro',
        createdBy: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const makeRec = (
      id: string,
      targetId: string,
      date: string,
      status: AttendanceRecord['status'],
      session: AttendanceRecord['session'] = 'morning',
      recordType: AttendanceRecord['recordType'] = 'student'
    ): AttendanceRecord => ({
      id,
      recordType,
      targetId,
      targetName: 'Test',
      targetCode: 'CODE',
      halaqahId: 'hlq-1',
      date,
      session,
      status,
      recordedBy: 'u1',
      createdAt: `${date}T08:00:00.000Z`,
    });

    const records: AttendanceRecord[] = [
      // stu-streak: exact 3 consecutive days
      makeRec('a1', 'stu-streak', '2026-11-12', 'Absent'),
      makeRec('a2', 'stu-streak', '2026-11-13', 'Absent'),
      makeRec('a3', 'stu-streak', '2026-11-14', 'Absent'),
      // stu-gap: 3 absent records same day + non-consecutive + Present session breaking middle day
      makeRec('b1', 'stu-gap', '2026-11-10', 'Absent', 'fajr'),
      makeRec('b2', 'stu-gap', '2026-11-10', 'Absent', 'morning'),
      makeRec('b3', 'stu-gap', '2026-11-10', 'Absent', 'afternoon'),
      makeRec('b4', 'stu-gap', '2026-11-11', 'Absent', 'fajr'),
      makeRec('b5', 'stu-gap', '2026-11-11', 'Present', 'morning'),
      makeRec('b6', 'stu-gap', '2026-11-12', 'Absent', 'morning'),
      // stu-withdrawn: 3 days absent, but student is withdrawn (should ignore)
      makeRec('c1', 'stu-withdrawn', '2026-11-12', 'Absent'),
      makeRec('c2', 'stu-withdrawn', '2026-11-13', 'Absent'),
      makeRec('c3', 'stu-withdrawn', '2026-11-14', 'Absent'),
      // staff record: 3 days absent (should ignore)
      makeRec('d1', 'staff-1', '2026-11-12', 'Absent', 'morning', 'staff'),
      makeRec('d2', 'staff-1', '2026-11-13', 'Absent', 'morning', 'staff'),
      makeRec('d3', 'staff-1', '2026-11-14', 'Absent', 'morning', 'staff'),
    ];

    const alerts = detectThreeDayConsecutiveAbsences(records, baseStudents);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].studentId).toBe('stu-streak');
    expect(alerts[0].studentCode).toBe('AFQ-2026-000010');
    expect(alerts[0].consecutiveDays).toBe(3);
    expect(alerts[0].dates).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
    expect(alerts[0].alertKey).toBe('abs3_stu-streak_2026-11-14');
  });
});

