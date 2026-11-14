import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import express, { Request, Response } from 'express';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MarkazLanguage } from '../src/shared/types.ts';

let cachedLogoDataUrl: string | null = null;
function getLogoDataUrl(): string | null {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const logoPath = path.resolve(process.cwd(), 'public', 'markaz-logo.png');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      cachedLogoDataUrl = `data:image/png;base64,${b64}`;
      return cachedLogoDataUrl;
    }
  } catch {
    // Ignore missing optional PNG
  }
  return null;
}

function sanitizeAggregateInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const forbiddenKeys = new Set([
    'phone',
    'guardianPhone',
    'email',
    'address',
    'dob',
    'uid',
    'password',
    'token',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (forbiddenKeys.has(k)) continue;
    if (typeof v === 'string') {
      // Mask any accidental Ethiopian phone numbers or email strings
      out[k] = v
        .replace(/\b(?:\+?251|0)?9\d{8}\b/g, '[PHONE-MASKED]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL-MASKED]');
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 40).map((item) =>
        typeof item === 'object' && item !== null ? sanitizeAggregateInput(item) : item
      );
    } else if (typeof v === 'object' && v !== null) {
      out[k] = sanitizeAggregateInput(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createApiRouter() {
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'al-furqaan-markaz',
      institution: 'Giddu-Gala Hifzii Qur’aanaa Al-Furqaan',
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/ai/report-draft', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const language = (['om', 'ar', 'en'].includes(req.body?.language)
        ? req.body.language
        : 'om') as MarkazLanguage;
      const topic = String(req.body?.topic || 'executive').slice(0, 80);
      const aggregateData = sanitizeAggregateInput(req.body?.aggregates || {});

      const languageNames: Record<MarkazLanguage, string> = {
        om: 'Afaan Oromoo',
        ar: 'Arabic (العربية الفصحى)',
        en: 'English',
      };

      const prompt = [
        `You are drafting an administrative report for GIDDU-GALA HIFZII QUR’AANAA AL-FURQAAN (Chiro, West Hararghe, Oromia, Ethiopia).`,
        `Target Language: ${languageNames[language]}. Write the ENTIRE response strictly in ${languageNames[language]}.`,
        `Report Topic: ${topic}.`,
        `Rules:`,
        `1. Use ONLY the verified aggregate statistics provided below. Do NOT invent any numbers, student names, or financial amounts.`,
        `2. This output is a human-reviewed DRAFT only. Never claim to modify grades, financial ledgers, admissions, or user permissions.`,
        `3. Format clearly with: Title, Executive Summary (2-3 sentences), Key Observations (3-4 concise bullet points referencing the exact numbers provided), and Recommended Follow-up Actions (2-3 practical items for Markaz leadership/Mu'allim).`,
        `Verified Masked Aggregate Data:`,
        JSON.stringify(aggregateData, null, 2),
      ].join('\n');

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      const draftText = response.text?.trim() || '';
      res.json({
        draftText,
        language,
        topic,
        model: 'gemini-4-hydrogen',
        humanReviewRequired: true,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      res.status(500).json({ error: message });
    }
  });

  router.post('/exports/pdf', (req: Request, res: Response) => {
    try {
      const title = String(req.body?.title || 'Al-Furqaan Markaz Report');
      const subtitle = String(req.body?.subtitle || 'Chiro – West Hararghe – Oromia – Ethiopia');
      const columns: string[] = Array.isArray(req.body?.columns)
        ? req.body.columns.map(String)
        : [];
      const rows: string[][] = Array.isArray(req.body?.rows)
        ? req.body.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map(String) : []))
        : [];

      const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
      doc.setFillColor(11, 61, 46);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');
      const logoData = getLogoDataUrl();
      const textX = logoData ? 34 : 14;
      if (logoData) {
        doc.addImage(logoData, 'PNG', 10, 4, 20, 20);
      }
      doc.setTextColor(196, 154, 69);
      doc.setFontSize(13);
      doc.text('GIDDU-GALA HIFZII QUR’AANAA AL-FURQAAN', textX, 11);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(title, textX, 18);
      doc.setFontSize(8);
      doc.text(`${subtitle} • ${new Date().toISOString().slice(0, 10)}`, textX, 24);

      autoTable(doc, {
        startY: 32,
        head: [columns],
        body: rows,
        headStyles: {
          fillColor: [20, 90, 50],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [243, 247, 244],
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
        },
      });

      const buffer = Buffer.from(doc.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="alfurqaan-report.pdf"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'PDF export error' });
    }
  });

  router.post('/exports/xlsx', (req: Request, res: Response) => {
    try {
      const sheetName = String(req.body?.sheetName || 'MarkazReport').slice(0, 31);
      const columns: string[] = Array.isArray(req.body?.columns)
        ? req.body.columns.map(String)
        : [];
      const rows: unknown[][] = Array.isArray(req.body?.rows) ? req.body.rows : [];

      const aoa = [columns, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="alfurqaan-report.xlsx"');
      res.send(buf);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'XLSX export error' });
    }
  });

  return router;
}
