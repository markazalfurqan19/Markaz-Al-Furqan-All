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
import { t } from '../src/shared/i18n.ts';
import { ROLE_NAV_ACCESS } from '../src/shared/types.ts';

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
          title: 'Test Report',
          columns: ['Code', 'Name'],
          rows: [['AFQ-2026-000001', 'Test Student']],
        }),
      });
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('content-type')).toContain('application/pdf');

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
});
