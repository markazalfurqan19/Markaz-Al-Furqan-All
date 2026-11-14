import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { formatSequentialCode, todayISOEthiopia } from '../shared/quranData.ts';
import { InstitutionSettings, MarkazLanguage, UserProfile, UserRole } from '../shared/types.ts';
import { db, firebaseAuth, handleFirestoreError, OperationType } from './firebase.ts';

export const SUPER_ADMIN_EMAIL = 'markazalfurqan19@gmail.com';

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  institutionNameOm: 'GIDDU-GALA HIFZII QUR’AANAA AL-FURQAAN',
  institutionNameAr: 'مَرْكَزُ الْفُرْقَانِ لِتَحْفِيظِ الْقُرْآنِ الْكَرِيمِ',
  institutionNameEn: 'Al-Furqaan Qur’an Memorization Centre',
  location: 'Chiro – West Hararghe – Oromia – Ethiopia',
  defaultLanguage: 'om',
  hijriDisplayEnabled: true,
  activeAcademicYear: '2026 / 1447H',
  gradingScale: {
    mumtazMin: 90,
    jayyidJiddanMin: 80,
    jayyidMin: 70,
    maqbulMin: 60,
  },
};

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isBootstrapAdmin =
      (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const role: UserRole = isBootstrapAdmin ? 'super_admin' : 'guardian';
    const now = new Date().toISOString();

    const profile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Markaz User',
      email: user.email || '',
      phone: user.phoneNumber || '',
      role,
      institutionId: 'al-furqaan-chiro',
      assignedHalaqahIds: [],
      linkedStudentIds: [],
      preferredLanguage: 'om',
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(userRef, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function getNextSequentialCode(
  counterKey: 'students' | 'receipts' | 'certificates' | 'invoices',
  prefix: 'AFQ' | 'AFQ-RCP' | 'AFQ-CERT',
  batchOrYear?: string
): Promise<string> {
  const counterRef = doc(db, 'counters', counterKey);
  try {
    const seq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? Number(snap.data().seq || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { seq: next, updatedAt: new Date().toISOString() }, { merge: true });
      return next;
    });
    return formatSequentialCode(prefix, seq, batchOrYear);
  } catch {
    const fallbackSeq = Math.floor((Date.now() % 899999) + 100000);
    return formatSequentialCode(prefix, fallbackSeq, batchOrYear);
  }
}

export function generatePublicAdmissionRef(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(100000 + Math.random() * 899999));
  return `AFQ-ADM-${year}-${suffix}`;
}

export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'AFQV';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function logAuditEvent(params: {
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  reason?: string;
}): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return;
  try {
    await addDoc(collection(db, 'auditLogs'), {
      actorUid: currentUser.uid,
      actorEmail: currentUser.email || '',
      actorRole: params.actorRole,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      summary: params.summary.slice(0, 480),
      reason: (params.reason || '').slice(0, 280),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err);
  }
}

export async function updateInstitutionSettings(
  settings: Partial<InstitutionSettings>,
  actorUid: string
): Promise<void> {
  const ref = doc(db, 'settings', 'institution');
  try {
    await setDoc(
      ref,
      {
        ...DEFAULT_INSTITUTION_SETTINGS,
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/institution');
  }
}

export async function initializeStarterMarkazWorkspace(
  actor: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const today = todayISOEthiopia();

  try {
    await setDoc(
      doc(db, 'settings', 'institution'),
      {
        ...DEFAULT_INSTITUTION_SETTINGS,
        updatedAt: now,
        updatedBy: actor.uid,
      },
      { merge: true }
    );

    await setDoc(doc(db, 'test', 'connection'), {
      status: 'connected',
      checkedAt: now,
    });

    const halaqahs = [
      {
        id: 'hlq-abu-bakr',
        name: 'Halaqah Abu Bakr As-Siddiiq',
        level: 'Hifz Intensive (Juz 1–30)',
        track: 'full_hifz',
        muallimId: actor.uid,
        muallimName: 'Ustaaz Abdulkarim Ahmad',
        schedule: 'Sabtii – Kamisa (05:30 – 08:30 & 16:00 – 18:00)',
        shift: 'morning',
        classroom: 'Masjid Hall A1',
        capacity: 25,
        active: true,
        createdAt: now,
      },
      {
        id: 'hlq-khadija',
        name: 'Halaqah Ummul Mu’miniin Khadiijah',
        level: 'Naaziraa & Tajwiid Foundation',
        track: 'nazirah_tajweed',
        muallimId: actor.uid,
        muallimName: 'Ustaaza Faaxumaa Jamaal',
        schedule: 'Wiixata – Jimaata (14:00 – 17:00)',
        shift: 'afternoon',
        classroom: 'Wing B – Room 2',
        capacity: 24,
        active: true,
        createdAt: now,
      },
    ];
    for (const h of halaqahs) {
      await setDoc(doc(db, 'halaqahs', h.id), h, { merge: true });
    }

    await setDoc(
      doc(db, 'feePlans', 'plan-full-hifz'),
      {
        name: 'Full Hifz Monthly Tuition',
        track: 'full_hifz',
        amountETB: 750,
        frequency: 'monthly',
        effectiveFrom: today,
        active: true,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'feePlans', 'plan-nazirah'),
      {
        name: 'Nazirah & Tajweed Monthly Tuition',
        track: 'nazirah_tajweed',
        amountETB: 500,
        frequency: 'monthly',
        effectiveFrom: today,
        active: true,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'campaigns', 'camp-ramadan-kafalat'),
      {
        title: 'Al-Furqaan Orphan & Hifz Kafalat Endowment',
        description:
          'Supporting orphaned and deserving Huffaz students in Chiro with monthly sponsorship, Mushafs, and boarding care.',
        targetETB: 500000,
        pledgedETB: 0,
        raisedETB: 0,
        startDate: today,
        status: 'active',
        createdAt: now,
      },
      { merge: true }
    );

    await logAuditEvent({
      actorRole: actor.role,
      action: 'INITIALIZE_WORKSPACE',
      entity: 'settings',
      entityId: 'institution',
      summary: 'Initialized Markaz institution settings, starter halaqahs, fee plans, and endowment campaign.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'workspace_init');
  }
}

export async function updateUserLanguagePreference(
  uid: string,
  lang: MarkazLanguage
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      preferredLanguage: lang,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Non-blocking UI preference update
  }
}

export function downloadCsvClient(
  filename: string,
  columns: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [columns.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join(
    '\n'
  );
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadServerPdf(params: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename?: string;
}): Promise<void> {
  const res = await fetch('/api/v1/exports/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to generate PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = params.filename || 'alfurqaan-report.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadServerXlsx(params: {
  sheetName: string;
  columns: string[];
  rows: (string | number)[][];
  filename?: string;
}): Promise<void> {
  const res = await fetch('/api/v1/exports/xlsx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to generate XLSX');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = params.filename || 'alfurqaan-report.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
