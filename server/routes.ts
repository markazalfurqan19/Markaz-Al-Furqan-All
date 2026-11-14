import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import express, { Request, Response } from 'express';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
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

interface ExportKpiItem {
  label: string;
  value: string;
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

function toPdfSafeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*');
}

function parseKpis(raw: unknown): ExportKpiItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      label: String(obj.label ?? ''),
      value: String(obj.value ?? ''),
    };
  });
}

  router.post('/exports/pdf', (req: Request, res: Response) => {
    try {
      const title = toPdfSafeText(String(req.body?.title || 'Al-Furqaan Markaz Report'));
      const subtitle = toPdfSafeText(
        String(req.body?.subtitle || 'Chiro - West Hararghe - Oromia - Ethiopia')
      );
      const narrativeText =
        typeof req.body?.narrativeText === 'string'
          ? toPdfSafeText(req.body.narrativeText.trim())
          : '';
      const kpis = parseKpis(req.body?.kpis);
      const columns: string[] = Array.isArray(req.body?.columns)
        ? req.body.columns.map((c: unknown) => toPdfSafeText(String(c)))
        : [];
      const rows: string[][] = Array.isArray(req.body?.rows)
        ? req.body.rows.map((r: unknown) =>
            Array.isArray(r) ? r.map((cell: unknown) => toPdfSafeText(String(cell))) : []
          )
        : [];

      const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Official Markaz Header
      doc.setFillColor(11, 61, 46);
      doc.rect(0, 0, pageWidth, 28, 'F');
      const logoData = getLogoDataUrl();
      const textX = logoData ? 34 : 14;
      if (logoData) {
        doc.addImage(logoData, 'PNG', 10, 4, 20, 20);
      }
      doc.setTextColor(196, 154, 69);
      doc.setFontSize(13);
      doc.text("GIDDU-GALA HIFZII QUR'AANAA AL-FURQAAN", textX, 11);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(title, textX, 18);
      doc.setFontSize(8);
      doc.text(`${subtitle} * ${new Date().toISOString().slice(0, 10)}`, textX, 24);

      let cursorY = 36;

      // Optional KPI Summary Table
      if (kpis.length > 0) {
        autoTable(doc, {
          startY: cursorY,
          head: [['Verified Indicator', 'Value']],
          body: kpis.map((k) => [toPdfSafeText(k.label), toPdfSafeText(k.value)]),
          headStyles: { fillColor: [20, 90, 50], textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 2.5 },
          margin: { left: 14, right: 14 },
        });
        cursorY =
          ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
            cursorY) + 8;
      }

      // Optional Narrative Draft Text
      if (narrativeText) {
        doc.setTextColor(14, 36, 25);
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(narrativeText, pageWidth - 28) as string[];
        for (const line of lines) {
          if (cursorY > pageHeight - 16) {
            doc.addPage();
            cursorY = 18;
          }
          doc.text(line, 14, cursorY);
          cursorY += 5.2;
        }
        cursorY += 6;
      }

      // Optional Records Table
      if (columns.length > 0 && rows.length > 0) {
        if (cursorY > pageHeight - 36) {
          doc.addPage();
          cursorY = 18;
        }
        autoTable(doc, {
          startY: cursorY,
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
      }

      const buffer = Buffer.from(doc.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="alfurqaan-report.pdf"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'PDF export error' });
    }
  });

  router.post('/exports/pptx', async (req: Request, res: Response) => {
    try {
      const title = String(req.body?.title || 'Al-Furqaan Markaz Management Report');
      const subtitle = String(req.body?.subtitle || 'Chiro – West Hararghe – Oromia – Ethiopia');
      const isRtl = req.body?.language === 'ar';
      const narrativeText =
        typeof req.body?.narrativeText === 'string' ? req.body.narrativeText.trim() : '';
      const kpis = parseKpis(req.body?.kpis);
      const columns: string[] = Array.isArray(req.body?.columns)
        ? req.body.columns.map((c: unknown) => String(c))
        : [];
      const rows: string[][] = Array.isArray(req.body?.rows)
        ? req.body.rows.map((r: unknown) =>
            Array.isArray(r) ? r.map((cell: unknown) => String(cell)) : []
          )
        : [];

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'Giddu-Gala Hifzii Qur’aanaa Al-Furqaan';
      pptx.title = title;
      pptx.rtlMode = isRtl;

      const logoData = getLogoDataUrl();
      const dateStr = new Date().toISOString().slice(0, 10);

      // Slide 1: Cover Slide (Islamic Green & Gold)
      const slide1 = pptx.addSlide();
      slide1.background = { color: '0B3D2E' };
      slide1.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 6.9,
        w: 13.33,
        h: 0.6,
        fill: { color: 'C49A45' },
      });
      if (logoData) {
        slide1.addImage({ data: logoData, x: 0.8, y: 1.0, w: 1.7, h: 1.7 });
      }
      slide1.addText('GIDDU-GALA HIFZII QUR’AANAA AL-FURQAAN', {
        x: 2.8,
        y: 1.2,
        w: 9.7,
        h: 0.6,
        fontSize: 22,
        bold: true,
        color: 'E6C573',
        fontFace: 'Plus Jakarta Sans',
      });
      slide1.addText(title, {
        x: 0.8,
        y: 3.1,
        w: 11.7,
        h: 1.2,
        fontSize: 30,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Plus Jakarta Sans',
        rtlMode: isRtl,
      });
      slide1.addText(`${subtitle}  •  Generated ${dateStr}`, {
        x: 0.8,
        y: 4.5,
        w: 11.7,
        h: 0.5,
        fontSize: 13,
        color: 'CFE2D7',
      });
      slide1.addText('Editable Management Report Deck — Human Review Required Before Distribution', {
        x: 0.8,
        y: 7.0,
        w: 11.7,
        h: 0.4,
        fontSize: 11,
        bold: true,
        color: '0B3D2E',
      });

      // Slide 2: Verified KPI Summary Slide
      if (kpis.length > 0) {
        const kpiSlide = pptx.addSlide();
        kpiSlide.background = { color: 'F3F7F4' };
        kpiSlide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.85,
          fill: { color: '0B3D2E' },
        });
        if (logoData) {
          kpiSlide.addImage({ data: logoData, x: 0.4, y: 0.12, w: 0.6, h: 0.6 });
        }
        kpiSlide.addText('Verified Markaz Key Performance Indicators', {
          x: 1.2,
          y: 0.18,
          w: 11.5,
          h: 0.5,
          fontSize: 18,
          bold: true,
          color: 'FFFFFF',
        });

        kpis.slice(0, 8).forEach((kpi, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = 0.6 + col * 6.2;
          const y = 1.25 + row * 1.4;
          kpiSlide.addShape(pptx.ShapeType.roundRect, {
            x,
            y,
            w: 5.9,
            h: 1.15,
            fill: { color: 'FFFFFF' },
            line: { color: 'D6E3DA', width: 1 },
          });
          kpiSlide.addText(kpi.label, {
            x: x + 0.25,
            y: y + 0.15,
            w: 5.4,
            h: 0.35,
            fontSize: 11,
            color: '4A6355',
            bold: true,
            rtlMode: isRtl,
          });
          kpiSlide.addText(kpi.value, {
            x: x + 0.25,
            y: y + 0.52,
            w: 5.4,
            h: 0.5,
            fontSize: 20,
            color: '145A32',
            bold: true,
          });
        });
      }

      // Slide 3+: Editable Narrative Draft Slides
      if (narrativeText) {
        const paragraphs: string[] = narrativeText
          .split(/\n{2,}/)
          .map((p: string) => p.trim())
          .filter(Boolean);
        const chunks: string[][] = [];
        let current: string[] = [];
        let charCount = 0;
        for (const p of paragraphs) {
          if (current.length > 0 && charCount + p.length > 900) {
            chunks.push(current);
            current = [];
            charCount = 0;
          }
          current.push(p);
          charCount += p.length;
        }
        if (current.length > 0) chunks.push(current);

        chunks.forEach((group, idx) => {
          const nSlide = pptx.addSlide();
          nSlide.background = { color: 'FFFFFF' };
          nSlide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: 13.33,
            h: 0.85,
            fill: { color: '145A32' },
          });
          if (logoData) {
            nSlide.addImage({ data: logoData, x: 0.4, y: 0.12, w: 0.6, h: 0.6 });
          }
          nSlide.addText(
            chunks.length > 1
              ? `${title} — Narrative Analysis (${idx + 1}/${chunks.length})`
              : `${title} — Narrative Analysis`,
            {
              x: 1.2,
              y: 0.18,
              w: 11.5,
              h: 0.5,
              fontSize: 17,
              bold: true,
              color: 'FFFFFF',
              rtlMode: isRtl,
            }
          );
          nSlide.addText(group.join('\n\n'), {
            x: 0.7,
            y: 1.15,
            w: 11.9,
            h: 5.8,
            fontSize: 13,
            color: '0E2419',
            valign: 'top',
            rtlMode: isRtl,
          });
        });
      }

      // Final Slide(s): Editable Data Table (up to 12 rows per slide)
      if (columns.length > 0 && rows.length > 0) {
        const pageSize = 12;
        for (let offset = 0; offset < Math.min(rows.length, 48); offset += pageSize) {
          const slice = rows.slice(offset, offset + pageSize);
          const tSlide = pptx.addSlide();
          tSlide.background = { color: 'FFFFFF' };
          tSlide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: 13.33,
            h: 0.8,
            fill: { color: '0B3D2E' },
          });
          if (logoData) {
            tSlide.addImage({ data: logoData, x: 0.35, y: 0.1, w: 0.6, h: 0.6 });
          }
          tSlide.addText(`Markaz Records Summary (${offset + 1}–${offset + slice.length})`, {
            x: 1.1,
            y: 0.16,
            w: 11.5,
            h: 0.48,
            fontSize: 16,
            bold: true,
            color: 'E6C573',
          });

          const tableRows = [
            columns.map((c) => ({
              text: c,
              options: { bold: true, color: 'FFFFFF', fill: { color: '145A32' } },
            })),
            ...slice.map((r, rIdx) =>
              r.map((cell) => ({
                text: cell,
                options: {
                  color: '0E2419',
                  fill: { color: rIdx % 2 === 0 ? 'F9FBF9' : 'FFFFFF' },
                },
              }))
            ),
          ];

          tSlide.addTable(tableRows as Parameters<typeof tSlide.addTable>[0], {
            x: 0.5,
            y: 1.05,
            w: 12.3,
            fontSize: 10,
            border: { type: 'solid', color: 'D6E3DA', pt: 0.5 },
          });
        }
      }

      const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="alfurqaan-report.pptx"');
      res.send(buf);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'PPTX export error' });
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
