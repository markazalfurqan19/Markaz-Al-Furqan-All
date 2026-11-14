import { MarkazLanguage } from './types.ts';

export interface SurahInfo {
  number: number;
  arabic: string;
  latin: string;
  juz: number;
}

export const QURAN_SURAHS: SurahInfo[] = [
  { number: 1, arabic: 'الفاتحة', latin: 'Al-Fatihah', juz: 1 },
  { number: 2, arabic: 'البقرة', latin: 'Al-Baqarah', juz: 1 },
  { number: 3, arabic: 'آل عمران', latin: 'Aal-Imran', juz: 3 },
  { number: 4, arabic: 'النساء', latin: 'An-Nisa', juz: 4 },
  { number: 5, arabic: 'المائدة', latin: 'Al-Maidah', juz: 6 },
  { number: 6, arabic: 'الأنعام', latin: 'Al-Anam', juz: 7 },
  { number: 7, arabic: 'الأعراف', latin: 'Al-Araf', juz: 8 },
  { number: 8, arabic: 'الأنفال', latin: 'Al-Anfal', juz: 9 },
  { number: 9, arabic: 'التوبة', latin: 'At-Tawbah', juz: 10 },
  { number: 10, arabic: 'يونس', latin: 'Yunus', juz: 11 },
  { number: 11, arabic: 'هود', latin: 'Hud', juz: 11 },
  { number: 12, arabic: 'يوسف', latin: 'Yusuf', juz: 12 },
  { number: 13, arabic: 'الرعد', latin: 'Ar-Rad', juz: 13 },
  { number: 14, arabic: 'إبراهيم', latin: 'Ibrahim', juz: 13 },
  { number: 15, arabic: 'الحجر', latin: 'Al-Hijr', juz: 14 },
  { number: 16, arabic: 'النحل', latin: 'An-Nahl', juz: 14 },
  { number: 17, arabic: 'الإسراء', latin: 'Al-Isra', juz: 15 },
  { number: 18, arabic: 'الكهف', latin: 'Al-Kahf', juz: 15 },
  { number: 19, arabic: 'مريم', latin: 'Maryam', juz: 16 },
  { number: 20, arabic: 'طه', latin: 'Ta-Ha', juz: 16 },
  { number: 21, arabic: 'الأنبياء', latin: 'Al-Anbiya', juz: 17 },
  { number: 22, arabic: 'الحج', latin: 'Al-Hajj', juz: 17 },
  { number: 23, arabic: 'المؤمنون', latin: 'Al-Muminun', juz: 18 },
  { number: 24, arabic: 'النور', latin: 'An-Nur', juz: 18 },
  { number: 25, arabic: 'الفرقان', latin: 'Al-Furqan', juz: 18 },
  { number: 26, arabic: 'الشعراء', latin: 'Ash-Shuara', juz: 19 },
  { number: 27, arabic: 'النمل', latin: 'An-Naml', juz: 19 },
  { number: 28, arabic: 'القصص', latin: 'Al-Qasas', juz: 20 },
  { number: 29, arabic: 'العنكبوت', latin: 'Al-Ankabut', juz: 20 },
  { number: 30, arabic: 'الروم', latin: 'Ar-Rum', juz: 21 },
  { number: 31, arabic: 'لقمان', latin: 'Luqman', juz: 21 },
  { number: 32, arabic: 'السجدة', latin: 'As-Sajdah', juz: 21 },
  { number: 33, arabic: 'الأحزاب', latin: 'Al-Ahzab', juz: 21 },
  { number: 34, arabic: 'سبأ', latin: 'Saba', juz: 22 },
  { number: 35, arabic: 'فاطر', latin: 'Fatir', juz: 22 },
  { number: 36, arabic: 'يس', latin: 'Ya-Sin', juz: 22 },
  { number: 37, arabic: 'الصافات', latin: 'As-Saffat', juz: 23 },
  { number: 38, arabic: 'ص', latin: 'Sad', juz: 23 },
  { number: 39, arabic: 'الزمر', latin: 'Az-Zumar', juz: 23 },
  { number: 40, arabic: 'غافر', latin: 'Ghafir', juz: 24 },
  { number: 41, arabic: 'فصلت', latin: 'Fussilat', juz: 24 },
  { number: 42, arabic: 'الشورى', latin: 'Ash-Shura', juz: 25 },
  { number: 43, arabic: 'الزخرف', latin: 'Az-Zukhruf', juz: 25 },
  { number: 44, arabic: 'الدخان', latin: 'Ad-Dukhan', juz: 25 },
  { number: 45, arabic: 'الجاثية', latin: 'Al-Jathiyah', juz: 25 },
  { number: 46, arabic: 'الأحقاف', latin: 'Al-Ahqaf', juz: 26 },
  { number: 47, arabic: 'محمد', latin: 'Muhammad', juz: 26 },
  { number: 48, arabic: 'الفتح', latin: 'Al-Fath', juz: 26 },
  { number: 49, arabic: 'الحجرات', latin: 'Al-Hujurat', juz: 26 },
  { number: 50, arabic: 'ق', latin: 'Qaf', juz: 26 },
  { number: 51, arabic: 'الذاريات', latin: 'Adh-Dhariyat', juz: 26 },
  { number: 52, arabic: 'الطور', latin: 'At-Tur', juz: 27 },
  { number: 53, arabic: 'النجم', latin: 'An-Najm', juz: 27 },
  { number: 54, arabic: 'القمر', latin: 'Al-Qamar', juz: 27 },
  { number: 55, arabic: 'الرحمن', latin: 'Ar-Rahman', juz: 27 },
  { number: 56, arabic: 'الواقعة', latin: 'Al-Waqiah', juz: 27 },
  { number: 57, arabic: 'الحديد', latin: 'Al-Hadid', juz: 27 },
  { number: 58, arabic: 'المجادلة', latin: 'Al-Mujadila', juz: 28 },
  { number: 59, arabic: 'الحشر', latin: 'Al-Hashr', juz: 28 },
  { number: 60, arabic: 'الممتحنة', latin: 'Al-Mumtahanah', juz: 28 },
  { number: 61, arabic: 'الصف', latin: 'As-Saff', juz: 28 },
  { number: 62, arabic: 'الجمعة', latin: 'Al-Jumuah', juz: 28 },
  { number: 63, arabic: 'المنافقون', latin: 'Al-Munafiqun', juz: 28 },
  { number: 64, arabic: 'التغابن', latin: 'At-Taghabun', juz: 28 },
  { number: 65, arabic: 'الطلاق', latin: 'At-Talaq', juz: 28 },
  { number: 66, arabic: 'التحريم', latin: 'At-Tahrim', juz: 28 },
  { number: 67, arabic: 'الملك', latin: 'Al-Mulk', juz: 29 },
  { number: 68, arabic: 'القلم', latin: 'Al-Qalam', juz: 29 },
  { number: 69, arabic: 'الحاقة', latin: 'Al-Haqqah', juz: 29 },
  { number: 70, arabic: 'المعارج', latin: 'Al-Maarij', juz: 29 },
  { number: 71, arabic: 'نوح', latin: 'Nuh', juz: 29 },
  { number: 72, arabic: 'الجن', latin: 'Al-Jinn', juz: 29 },
  { number: 73, arabic: 'المزمل', latin: 'Al-Muzzammil', juz: 29 },
  { number: 74, arabic: 'المدثر', latin: 'Al-Muddaththir', juz: 29 },
  { number: 75, arabic: 'القيامة', latin: 'Al-Qiyamah', juz: 29 },
  { number: 76, arabic: 'الإنسان', latin: 'Al-Insan', juz: 29 },
  { number: 77, arabic: 'المرسلات', latin: 'Al-Mursalat', juz: 29 },
  { number: 78, arabic: 'النبأ', latin: 'An-Naba', juz: 30 },
  { number: 79, arabic: 'النازعات', latin: 'An-Naziat', juz: 30 },
  { number: 80, arabic: 'عبس', latin: 'Abasa', juz: 30 },
  { number: 81, arabic: 'التكوير', latin: 'At-Takwir', juz: 30 },
  { number: 82, arabic: 'الانفطار', latin: 'Al-Infitar', juz: 30 },
  { number: 83, arabic: 'المطففين', latin: 'Al-Mutaffifin', juz: 30 },
  { number: 84, arabic: 'الانشقاق', latin: 'Al-Inshiqaq', juz: 30 },
  { number: 85, arabic: 'البروج', latin: 'Al-Buruj', juz: 30 },
  { number: 86, arabic: 'الطارق', latin: 'At-Tariq', juz: 30 },
  { number: 87, arabic: 'الأعلى', latin: 'Al-Ala', juz: 30 },
  { number: 88, arabic: 'الغاشية', latin: 'Al-Ghashiyah', juz: 30 },
  { number: 89, arabic: 'الفجر', latin: 'Al-Fajr', juz: 30 },
  { number: 90, arabic: 'البلد', latin: 'Al-Balad', juz: 30 },
  { number: 91, arabic: 'الشمس', latin: 'Ash-Shams', juz: 30 },
  { number: 92, arabic: 'الليل', latin: 'Al-Layl', juz: 30 },
  { number: 93, arabic: 'الضحى', latin: 'Ad-Duha', juz: 30 },
  { number: 94, arabic: 'الشرح', latin: 'Ash-Sharh', juz: 30 },
  { number: 95, arabic: 'التين', latin: 'At-Tin', juz: 30 },
  { number: 96, arabic: 'العلق', latin: 'Al-Alaq', juz: 30 },
  { number: 97, arabic: 'القدر', latin: 'Al-Qadr', juz: 30 },
  { number: 98, arabic: 'البينة', latin: 'Al-Bayyinah', juz: 30 },
  { number: 99, arabic: 'الزلزلة', latin: 'Az-Zalzalah', juz: 30 },
  { number: 100, arabic: 'العاديات', latin: 'Al-Adiyat', juz: 30 },
  { number: 101, arabic: 'القارعة', latin: 'Al-Qariah', juz: 30 },
  { number: 102, arabic: 'التكاثر', latin: 'At-Takathur', juz: 30 },
  { number: 103, arabic: 'العصر', latin: 'Al-Asr', juz: 30 },
  { number: 104, arabic: 'الهمزة', latin: 'Al-Humazah', juz: 30 },
  { number: 105, arabic: 'الفيل', latin: 'Al-Fil', juz: 30 },
  { number: 106, arabic: 'قريش', latin: 'Quraysh', juz: 30 },
  { number: 107, arabic: 'الماعون', latin: 'Al-Maun', juz: 30 },
  { number: 108, arabic: 'الكوثر', latin: 'Al-Kawthar', juz: 30 },
  { number: 109, arabic: 'الكافرون', latin: 'Al-Kafirun', juz: 30 },
  { number: 110, arabic: 'النصر', latin: 'An-Nasr', juz: 30 },
  { number: 111, arabic: 'المسد', latin: 'Al-Masad', juz: 30 },
  { number: 112, arabic: 'الإخلاص', latin: 'Al-Ikhlas', juz: 30 },
  { number: 113, arabic: 'الفلق', latin: 'Al-Falaq', juz: 30 },
  { number: 114, arabic: 'الناس', latin: 'An-Nas', juz: 30 },
];

export const JUZ_LIST = Array.from({ length: 30 }, (_, i) => i + 1);

export function formatETB(amount: number, lang: MarkazLanguage = 'om'): string {
  const num = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
  return lang === 'ar' ? `${formatted} بر إثيوبي` : `${formatted} ETB`;
}

export function todayISOEthiopia(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function formatHijriSupplemental(dateStr?: string, lang: MarkazLanguage = 'om'): string {
  try {
    const dt = dateStr ? new Date(dateStr) : new Date();
    const locale = lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dt);
  } catch {
    return '';
  }
}

export function computeExamGrade(
  score: number,
  scale = { mumtazMin: 90, jayyidJiddanMin: 80, jayyidMin: 70, maqbulMin: 60 }
): string {
  if (score >= scale.mumtazMin) return 'Mumtaz';
  if (score >= scale.jayyidJiddanMin) return 'Jayyid Jiddan';
  if (score >= scale.jayyidMin) return 'Jayyid';
  if (score >= scale.maqbulMin) return 'Maqbul';
  return 'Needs Revision';
}

export function formatSequentialCode(
  prefix: 'AFQ' | 'AFQ-RCP' | 'AFQ-ADM' | 'AFQ-CERT',
  seq: number,
  batchOrYear?: string
): string {
  const year = batchOrYear ?? String(new Date().getFullYear());
  const padded = String(Math.max(1, Math.floor(seq))).padStart(6, '0');
  return `${prefix}-${year}-${padded}`;
}

export function detectDuplicateStudent(
  candidate: { fullName: string; guardianPhone: string; dob: string },
  existing: Array<{ id: string; code: string; fullName: string; guardianPhone: string; dob: string }>
): { id: string; code: string; fullName: string } | null {
  const normName = candidate.fullName.trim().toLowerCase().replace(/\s+/g, ' ');
  const normPhone = candidate.guardianPhone.replace(/\D/g, '').slice(-9);
  for (const s of existing) {
    const sName = s.fullName.trim().toLowerCase().replace(/\s+/g, ' ');
    const sPhone = s.guardianPhone.replace(/\D/g, '').slice(-9);
    const sameName = sName === normName;
    const samePhone = normPhone.length >= 6 && sPhone === normPhone;
    const sameDob = candidate.dob && s.dob && candidate.dob === s.dob;
    if ((sameName && samePhone) || (sameName && sameDob)) {
      return { id: s.id, code: s.code, fullName: s.fullName };
    }
  }
  return null;
}

export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}
