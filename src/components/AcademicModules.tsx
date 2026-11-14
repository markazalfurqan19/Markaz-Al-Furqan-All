import React, { useMemo, useState } from 'react';
import { MarkazCrest } from './PwaControls.tsx';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileSpreadsheet,
  Plus,
  QrCode,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { getNextSequentialCode, logAuditEvent } from '../lib/markazDb.ts';
import { t } from '../shared/i18n.ts';
import {
  computeExamGrade,
  detectDuplicateStudent,
  JUZ_LIST,
  QURAN_SURAHS,
  todayISOEthiopia,
} from '../shared/quranData.ts';
import {
  AttendanceRecord,
  AttendanceStatus,
  ExamRecord,
  Halaqah,
  HifzGrade,
  HifzLog,
  InstitutionSettings,
  Invoice,
  MarkazLanguage,
  StaffMember,
  Student,
  StudentStatus,
  StudyTrack,
  UserProfile,
} from '../shared/types.ts';

/* ============================================================================
 * 1. STUDENTS MODULE
 * ========================================================================== */
interface StudentsModuleProps {
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  halaqahs: Halaqah[];
  hifzLogs: HifzLog[];
  attendance: AttendanceRecord[];
  exams: ExamRecord[];
  invoices: Invoice[];
}

export const StudentsModule: React.FC<StudentsModuleProps> = ({
  lang,
  user,
  students,
  halaqahs,
  hifzLogs,
  attendance,
  exams,
  invoices,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'hifz' | 'attendance' | 'exams' | 'finance'>('overview');

  // Form states
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('12');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('Chiro, West Hararghe');
  const [track, setTrack] = useState<StudyTrack>('full_hifz');
  const [halaqahId, setHalaqahId] = useState(halaqahs[0]?.id || '');
  const [currentSurah, setCurrentSurah] = useState('Al-Fatihah');
  const [juzLevel, setJuzLevel] = useState('1');
  const [kafalatEligible, setKafalatEligible] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canWriteStudents = ['super_admin', 'director', 'registrar'].includes(user.role);

  const duplicateMatch = useMemo(() => {
    if (!fullName.trim() || (!guardianPhone.trim() && !dob)) return null;
    return detectDuplicateStudent({ fullName, guardianPhone, dob }, students);
  }, [fullName, guardianPhone, dob, students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.guardianPhone.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q)
      );
    });
  }, [students, search, statusFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const code = await getNextSequentialCode('students', 'AFQ');
      const selectedH = halaqahs.find((h) => h.id === halaqahId);
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'students'), {
        code,
        fullName: fullName.trim(),
        dob,
        age: Number(age) || 10,
        gender,
        guardianIds: [],
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        address: address.trim(),
        track,
        currentSurah,
        juzLevel: Math.min(30, Math.max(0, Number(juzLevel) || 0)),
        halaqahId: selectedH?.id || '',
        halaqahGroup: selectedH?.name || '',
        status: 'active',
        kafalatEligible,
        sponsorId: '',
        enrollmentDate: todayISOEthiopia(),
        admissionSource: 'direct_registration',
        notes: notes.trim(),
        institutionId: user.institutionId,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      });

      await logAuditEvent({
        actorRole: user.role,
        action: 'CREATE_STUDENT',
        entity: 'students',
        entityId: docRef.id,
        summary: `Registered student ${code} (${fullName.trim()})`,
      });

      setShowForm(false);
      setFullName('');
      setGuardianName('');
      setGuardianPhone('');
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (student: Student, newStatus: StudentStatus) => {
    try {
      await updateDoc(doc(db, 'students', student.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'UPDATE_STUDENT_STATUS',
        entity: 'students',
        entityId: student.id,
        summary: `Changed ${student.code} status from ${student.status} to ${newStatus}`,
      });
      if (selectedStudent?.id === student.id) {
        setSelectedStudent({ ...student, status: newStatus });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D6E3DA] bg-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#4A6355]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              className="w-full rounded-lg border border-[#D6E3DA] bg-[#F9FBF9] py-2 pr-3 pl-9 text-xs outline-none focus:border-[#145A32]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[38px] rounded-lg border border-[#D6E3DA] bg-[#F9FBF9] px-3 text-xs font-medium outline-none focus:border-[#145A32]"
          >
            <option value="all">{t(lang, 'filterAll')}</option>
            <option value="active">{t(lang, 'status_active')}</option>
            <option value="graduated">{t(lang, 'status_graduated')}</option>
            <option value="suspended">{t(lang, 'status_suspended')}</option>
            <option value="withdrawn">{t(lang, 'status_withdrawn')}</option>
            <option value="archived">{t(lang, 'status_archived')}</option>
          </select>
        </div>

        {canWriteStudents && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t(lang, 'registerStudent')}</span>
          </button>
        )}
      </div>

      {/* Registration Drawer/Card */}
      {showForm && canWriteStudents && (
        <form
          onSubmit={handleRegister}
          className="rounded-xl border border-[#C49A45]/60 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#EAF3ED] pb-3">
            <div className="flex items-center gap-3">
              <MarkazCrest size={42} />
              <div>
                <p className="text-[11px] font-semibold text-[#145A32]">{t(lang, 'brandMain')}</p>
                <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
                  {t(lang, 'registerStudent')}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1 text-[#4A6355] hover:bg-[#EAF3ED]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {duplicateMatch && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {t(lang, 'duplicateWarning')}{' '}
                <strong className="font-mono-tabular">{duplicateMatch.code}</strong> —{' '}
                {duplicateMatch.fullName}
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'fullName')} *</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'dob')}</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'age')} *</label>
              <input
                type="number"
                required
                min={3}
                max={90}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'gender')} *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="male">{t(lang, 'male')}</option>
                <option value="female">{t(lang, 'female')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'guardianName')} *</label>
              <input
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'guardianPhone')} *</label>
              <input
                required
                dir="ltr"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'track')}</label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as StudyTrack)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="full_hifz">{t(lang, 'track_full_hifz')}</option>
                <option value="part_time_hifz">{t(lang, 'track_part_time_hifz')}</option>
                <option value="nazirah_tajweed">{t(lang, 'track_nazirah_tajweed')}</option>
                <option value="islamic_studies">{t(lang, 'track_islamic_studies')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'halaqah')}</label>
              <select
                value={halaqahId}
                onChange={(e) => setHalaqahId(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="">— Unassigned —</option>
                {halaqahs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'currentSurah')}</label>
              <select
                value={currentSurah}
                onChange={(e) => setCurrentSurah(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                {QURAN_SURAHS.map((sr) => (
                  <option key={sr.number} value={sr.latin}>
                    {sr.number}. {sr.latin} ({sr.arabic})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'juzLevel')}</label>
              <input
                type="number"
                min={0}
                max={30}
                value={juzLevel}
                onChange={(e) => setJuzLevel(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'address')}</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0B3D2E]">
                <input
                  type="checkbox"
                  checked={kafalatEligible}
                  onChange={(e) => setKafalatEligible(e.target.checked)}
                  className="h-4 w-4 accent-[#145A32]"
                />
                <span>{t(lang, 'kafalatEligible')}</span>
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'notes')}</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[#D6E3DA] px-4 py-2 text-xs font-semibold text-[#4A6355]"
            >
              {t(lang, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E]"
            >
              {saving ? t(lang, 'loading') : t(lang, 'save')}
            </button>
          </div>
        </form>
      )}

      {/* Student Directory Table */}
      <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#4A6355]">{t(lang, 'noRecords')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4] text-[#334E3F]">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t(lang, 'studentCode')}</th>
                  <th className="px-4 py-3 font-semibold">{t(lang, 'fullName')}</th>
                  <th className="px-4 py-3 font-semibold">{t(lang, 'halaqah')}</th>
                  <th className="px-4 py-3 font-semibold">{t(lang, 'currentSurah')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t(lang, 'juzLevel')}</th>
                  <th className="px-4 py-3 font-semibold">{t(lang, 'guardianPhone')}</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3ED]">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className="cursor-pointer transition hover:bg-[#F9FBF9]"
                  >
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-[#145A32]">
                      {s.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0E2419]">
                      {s.fullName}
                      {s.kafalatEligible && (
                        <span className="ml-2 rounded border border-[#C49A45]/50 bg-[#F7F0DF] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A5915]">
                          Kafalat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#4A6355]">{s.halaqahGroup || '—'}</td>
                    <td className="px-4 py-3 text-[#4A6355]">{s.currentSurah}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                      {s.juzLevel}/30
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-[#4A6355]" dir="ltr">
                      {s.guardianPhone}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          s.status === 'active'
                            ? 'bg-[#EAF3ED] text-[#145A32]'
                            : s.status === 'graduated'
                            ? 'bg-[#F7F0DF] text-[#7A5915]'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t(lang, `status_${s.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Full Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#D6E3DA] bg-white p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#EAF3ED] pb-4">
              <div className="flex items-center gap-3">
                <MarkazCrest size={48} />
                <div>
                  <p className="font-mono-tabular text-xs font-bold text-[#145A32]">
                    {selectedStudent.code}
                  </p>
                  <h3 className="font-display text-lg font-bold text-[#0B3D2E]">
                    {selectedStudent.fullName}
                  </h3>
                  <p className="text-xs text-[#4A6355]">
                    {t(lang, `track_${selectedStudent.track}`)} • {selectedStudent.halaqahGroup || 'Unassigned'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-1.5 text-[#4A6355] hover:bg-[#EAF3ED]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex flex-wrap gap-2 border-b border-[#EAF3ED] pb-3">
              {(['overview', 'hifz', 'attendance', 'exams', 'finance'] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setProfileTab(tabKey)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                    profileTab === tabKey
                      ? 'bg-[#145A32] text-white'
                      : 'bg-[#F3F7F4] text-[#334E3F]'
                  }`}
                >
                  {tabKey}
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs">
              {profileTab === 'overview' && (
                <div className="space-y-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[#4A6355]">{t(lang, 'guardianName')}</dt>
                      <dd className="font-semibold">{selectedStudent.guardianName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#4A6355]">{t(lang, 'guardianPhone')}</dt>
                      <dd className="font-mono-tabular font-semibold" dir="ltr">
                        {selectedStudent.guardianPhone}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#4A6355]">{t(lang, 'currentSurah')}</dt>
                      <dd className="font-semibold">{selectedStudent.currentSurah}</dd>
                    </div>
                    <div>
                      <dt className="text-[#4A6355]">{t(lang, 'juzLevel')}</dt>
                      <dd className="font-mono-tabular font-semibold">{selectedStudent.juzLevel} / 30</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[#4A6355]">{t(lang, 'notes')}</dt>
                      <dd className="mt-0.5 rounded-lg bg-[#F9FBF9] p-2.5 text-[#0E2419]">
                        {selectedStudent.notes || '—'}
                      </dd>
                    </div>
                  </dl>

                  {canWriteStudents && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#EAF3ED] pt-3">
                      <span className="font-semibold text-[#4A6355]">Lifecycle Status:</span>
                      {(['active', 'suspended', 'withdrawn', 'graduated', 'archived'] as StudentStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(selectedStudent, st)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                              selectedStudent.status === st
                                ? 'border-[#145A32] bg-[#145A32] text-white'
                                : 'border-[#D6E3DA] bg-white text-[#334E3F]'
                            }`}
                          >
                            {t(lang, `status_${st}`)}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'hifz' && (
                <div className="space-y-2">
                  {hifzLogs
                    .filter((l) => l.studentId === selectedStudent.id)
                    .map((l) => (
                      <div key={l.id} className="flex justify-between rounded-lg border border-[#EAF3ED] p-3">
                        <div>
                          <p className="font-semibold">{l.sabaqRange} ({l.currentSurah})</p>
                          <p className="text-[#4A6355]">
                            Sabqi: {l.sabqiJuz} • Manzil: {l.manzilJuz}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[#145A32]">{l.grade}</span>
                          <p className="font-mono-tabular text-[11px] text-[#4A6355]">{l.date}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {profileTab === 'attendance' && (
                <div className="space-y-2">
                  {attendance
                    .filter((a) => a.targetId === selectedStudent.id)
                    .map((a) => (
                      <div key={a.id} className="flex justify-between rounded-lg border border-[#EAF3ED] p-2.5">
                        <span className="font-mono-tabular">{a.date} ({a.session})</span>
                        <span className="font-semibold">{a.status}</span>
                      </div>
                    ))}
                </div>
              )}

              {profileTab === 'exams' && (
                <div className="space-y-2">
                  {exams
                    .filter((ex) => ex.studentId === selectedStudent.id)
                    .map((ex) => (
                      <div key={ex.id} className="flex justify-between rounded-lg border border-[#EAF3ED] p-2.5">
                        <div>
                          <p className="font-semibold">{ex.examType} — Juz {ex.juzTested}</p>
                          <p className="text-[#4A6355]">{ex.approvalStatus}</p>
                        </div>
                        <span className="font-mono-tabular font-bold text-[#145A32]">
                          {ex.totalScore}/100 ({ex.grade})
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {profileTab === 'finance' && (
                <div className="space-y-2">
                  {invoices
                    .filter((inv) => inv.studentId === selectedStudent.id)
                    .map((inv) => (
                      <div key={inv.id} className="flex justify-between rounded-lg border border-[#EAF3ED] p-2.5">
                        <div>
                          <p className="font-mono-tabular font-semibold">{inv.invoiceNo}</p>
                          <p className="text-[#4A6355]">{inv.period}</p>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <p className="font-bold">{inv.amountPaid} / {inv.amountDue} ETB</p>
                          <p className="text-[11px] uppercase text-[#4A6355]">{inv.status}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. HALAQAHS & SCHEDULING MODULE
 * ========================================================================== */
export const HalaqahsModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  halaqahs: Halaqah[];
  students: Student[];
  staff: StaffMember[];
}> = ({ lang, user, halaqahs, students, staff }) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Hifz Intensive');
  const [track, setTrack] = useState<StudyTrack>('full_hifz');
  const [muallimId, setMuallimId] = useState('');
  const [schedule, setSchedule] = useState('Sabtii – Kamisa (06:00 – 08:30)');
  const [shift, setShift] = useState<'morning' | 'afternoon' | 'evening' | 'weekend'>('morning');
  const [classroom, setClassroom] = useState('Hall A');
  const [capacity, setCapacity] = useState('25');
  const [transferStudentId, setTransferStudentId] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const canManage = ['super_admin', 'director', 'registrar'].includes(user.role);

  const handleCreateHalaqah = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenStaff = staff.find((st) => st.id === muallimId);
    const now = new Date().toISOString();
    try {
      const ref = await addDoc(collection(db, 'halaqahs'), {
        name: name.trim(),
        level: level.trim(),
        track,
        muallimId: chosenStaff?.id || user.uid,
        muallimName: chosenStaff?.fullName || user.displayName,
        schedule: schedule.trim(),
        shift,
        classroom: classroom.trim(),
        capacity: Math.max(1, Number(capacity) || 20),
        active: true,
        createdAt: now,
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'CREATE_HALAQAH',
        entity: 'halaqahs',
        entityId: ref.id,
        summary: `Created Halaqah ${name.trim()}`,
      });
      setName('');
      setMsg('Halaqah group saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'halaqahs');
    }
  };

  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === transferStudentId);
    const target = halaqahs.find((h) => h.id === transferTargetId);
    if (!st || !target) return;
    try {
      await updateDoc(doc(db, 'students', st.id), {
        halaqahId: target.id,
        halaqahGroup: target.name,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'TRANSFER_HALAQAH',
        entity: 'students',
        entityId: st.id,
        summary: `Moved ${st.code} to ${target.name}`,
      });
      setMsg(`Transferred ${st.fullName} to ${target.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${st.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-xl border border-[#145A32]/30 bg-[#EAF3ED] px-4 py-2.5 text-xs font-medium text-[#0B3D2E]">
          {msg}
        </div>
      )}

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleCreateHalaqah}
            className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              Create Halaqah Group
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Halaqah Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
              <input
                required
                placeholder="Level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
              <select
                value={muallimId}
                onChange={(e) => setMuallimId(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="">Assign Mu’allim (Default: Current User)</option>
                {staff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName}
                  </option>
                ))}
              </select>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as 'morning' | 'afternoon' | 'evening' | 'weekend')}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="weekend">Weekend</option>
              </select>
              <input
                placeholder="Schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
              <input
                type="number"
                min={1}
                placeholder="Capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums outline-none focus:border-[#145A32]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E]"
            >
              {t(lang, 'save')}
            </button>
          </form>

          <form
            onSubmit={handleTransferStudent}
            className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              Transfer Student Between Halaqahs
            </h3>
            <div className="space-y-3">
              <select
                required
                value={transferStudentId}
                onChange={(e) => setTransferStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="">Select Student...</option>
                {students.filter((s) => s.status === 'active').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.fullName} ({s.halaqahGroup || 'Unassigned'})
                  </option>
                ))}
              </select>
              <select
                required
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="">Target Halaqah...</option>
                {halaqahs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.muallimName})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#C49A45] px-4 py-2 text-xs font-bold text-[#0B3D2E] hover:bg-[#D5AE5C]"
            >
              Execute Transfer
            </button>
          </form>
        </div>
      )}

      {/* Halaqah Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {halaqahs.map((h) => {
          const count = students.filter((s) => s.status === 'active' && s.halaqahId === h.id).length;
          return (
            <div key={h.id} className="rounded-xl border border-[#D6E3DA] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-display text-sm font-bold text-[#0B3D2E]">{h.name}</h4>
                  <p className="text-xs text-[#4A6355]">{h.level}</p>
                </div>
                <span className="font-mono-tabular rounded bg-[#EAF3ED] px-2 py-0.5 text-xs font-bold text-[#145A32]">
                  {count}/{h.capacity}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-[#334E3F]">
                <p>Mu’allim: <strong>{h.muallimName}</strong></p>
                <p>Room: {h.classroom} • {h.shift}</p>
                <p className="text-[11px] text-[#4A6355]">{h.schedule}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. HIFZ PROGRESS (SABAQ, SABQI, MANZIL) MODULE
 * ========================================================================== */
export const HifzModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  hifzLogs: HifzLog[];
}> = ({ lang, user, students, hifzLogs }) => {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [sabaqRange, setSabaqRange] = useState('Aayah 1–15');
  const [sabaqPages, setSabaqPages] = useState('1.5');
  const [currentSurah, setCurrentSurah] = useState('Al-Baqarah');
  const [sabqiJuz, setSabqiJuz] = useState('Juz 1');
  const [manzilJuz, setManzilJuz] = useState('Juz 30');
  const [grade, setGrade] = useState<HifzGrade>('Jayyid Jiddan');
  const [remarks, setRemarks] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  const canLog = ['super_admin', 'director', 'muallim'].includes(user.role);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'hifzLogs'), {
        studentId: st.id,
        studentName: st.fullName,
        studentCode: st.code,
        halaqahId: st.halaqahId || '',
        date: todayISOEthiopia(),
        sabaqRange: sabaqRange.trim(),
        sabaqPages: Number(sabaqPages) || 1,
        currentSurah,
        sabqiJuz: sabqiJuz.trim(),
        manzilJuz: manzilJuz.trim(),
        grade,
        muallimId: user.uid,
        muallimName: user.displayName,
        remarks: remarks.trim(),
        reviewStatus: 'submitted',
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'students', st.id), {
        currentSurah,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'LOG_HIFZ',
        entity: 'hifzLogs',
        entityId: ref.id,
        summary: `Logged Hifz (${grade}) for ${st.code}`,
      });
      setRemarks('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'hifzLogs');
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return hifzLogs.filter((l) => gradeFilter === 'all' || l.grade === gradeFilter);
  }, [hifzLogs, gradeFilter]);

  return (
    <div className="space-y-6">
      {canLog && (
        <form
          onSubmit={handleLog}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-[#145A32]" />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">{t(lang, 'logHifz')}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Student *</label>
              <select
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="">Select Student...</option>
                {students.filter((s) => s.status === 'active').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'currentSurah')}</label>
              <select
                value={currentSurah}
                onChange={(e) => setCurrentSurah(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                {QURAN_SURAHS.map((sr) => (
                  <option key={sr.number} value={sr.latin}>
                    {sr.number}. {sr.latin} ({sr.arabic})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'sabaqRange')} *</label>
              <input
                required
                value={sabaqRange}
                onChange={(e) => setSabaqRange(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'sabaqPages')}</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={40}
                value={sabaqPages}
                onChange={(e) => setSabaqPages(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums outline-none focus:border-[#145A32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'sabqiJuz')}</label>
              <select
                value={sabqiJuz}
                onChange={(e) => setSabqiJuz(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                {JUZ_LIST.map((j) => (
                  <option key={j} value={`Juz ${j}`}>
                    Juz {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'manzilJuz')}</label>
              <select
                value={manzilJuz}
                onChange={(e) => setManzilJuz(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                {JUZ_LIST.map((j) => (
                  <option key={j} value={`Juz ${j}`}>
                    Juz {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'grade')}</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as HifzGrade)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              >
                <option value="Mumtaz">Mumtaz</option>
                <option value="Jayyid Jiddan">Jayyid Jiddan</option>
                <option value="Jayyid">Jayyid</option>
                <option value="Maqbul">Maqbul</option>
                <option value="Needs Revision">Needs Revision</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">{t(lang, 'remarks')}</label>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs outline-none focus:border-[#145A32]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !studentId}
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E] disabled:opacity-50"
          >
            {saving ? t(lang, 'loading') : t(lang, 'save')}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-[#D6E3DA] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
            Hifz Logs ({filteredLogs.length})
          </h3>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
          >
            <option value="all">{t(lang, 'filterAll')}</option>
            <option value="Mumtaz">Mumtaz</option>
            <option value="Jayyid Jiddan">Jayyid Jiddan</option>
            <option value="Jayyid">Jayyid</option>
            <option value="Needs Revision">Needs Revision</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Student</th>
                <th className="px-3 py-2.5 font-semibold">Sabaq</th>
                <th className="px-3 py-2.5 font-semibold">Sabqi / Manzil</th>
                <th className="px-3 py-2.5 font-semibold">{t(lang, 'grade')}</th>
                <th className="px-3 py-2.5 font-semibold">Mu’allim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAF3ED]">
              {filteredLogs.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2.5 font-mono-tabular">{l.date}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <span className="font-mono-tabular text-[#145A32]">{l.studentCode}</span> —{' '}
                    {l.studentName}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.currentSurah}: {l.sabaqRange} ({l.sabaqPages}p)
                  </td>
                  <td className="px-3 py-2.5 text-[#4A6355]">
                    {l.sabqiJuz} / {l.manzilJuz}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    <span
                      className={
                        l.grade === 'Needs Revision' ? 'text-amber-700' : 'text-[#145A32]'
                      }
                    >
                      {l.grade}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#4A6355]">{l.muallimName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. ATTENDANCE MODULE (Students, Staff, & Secure QR Token Check-in)
 * ========================================================================== */
export const AttendanceModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  staff: StaffMember[];
  halaqahs: Halaqah[];
  attendance: AttendanceRecord[];
}> = ({ lang, user, students, staff, halaqahs, attendance }) => {
  const [mode, setMode] = useState<'student' | 'staff'>('student');
  const [date, setDate] = useState(todayISOEthiopia());
  const [session, setSession] = useState<'fajr' | 'morning' | 'afternoon' | 'maghrib' | 'full_day'>(
    'morning'
  );
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('all');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string>('');
  const [reasonNote, setReasonNote] = useState('');

  const canMark = ['super_admin', 'director', 'registrar', 'muallim'].includes(user.role);

  const targets = useMemo(() => {
    if (mode === 'staff') return staff.filter((st) => st.employmentStatus === 'active');
    return students.filter((s) => {
      if (s.status !== 'active') return false;
      if (selectedHalaqah !== 'all' && s.halaqahId !== selectedHalaqah) return false;
      return true;
    });
  }, [mode, students, staff, selectedHalaqah]);

  const markStatus = async (
    target: { id: string; fullName: string; code?: string; staffCode?: string; halaqahId?: string },
    status: AttendanceStatus,
    qrVerified = false
  ) => {
    try {
      await addDoc(collection(db, 'attendance'), {
        recordType: mode,
        targetId: target.id,
        targetName: target.fullName,
        targetCode: target.code || target.staffCode || '',
        halaqahId: target.halaqahId || '',
        date,
        session,
        status,
        reason: reasonNote.trim(),
        qrVerified,
        recordedBy: user.uid,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendance');
    }
  };

  const generateSecureQrToken = async () => {
    const rawToken = `AFQ-ATT:${date}:${session}:${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    setQrToken(rawToken);
    const url = await QRCode.toDataURL(rawToken, { width: 180, margin: 1 });
    setQrDataUrl(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D6E3DA] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('student')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold ${
              mode === 'student' ? 'bg-[#145A32] text-white' : 'bg-[#F3F7F4] text-[#334E3F]'
            }`}
          >
            {t(lang, 'studentAttendance')}
          </button>
          <button
            type="button"
            onClick={() => setMode('staff')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold ${
              mode === 'staff' ? 'bg-[#145A32] text-white' : 'bg-[#F3F7F4] text-[#334E3F]'
            }`}
          >
            {t(lang, 'staffAttendance')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
          />
          <select
            value={session}
            onChange={(e) =>
              setSession(e.target.value as 'fajr' | 'morning' | 'afternoon' | 'maghrib' | 'full_day')
            }
            className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
          >
            <option value="fajr">Fajr</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="maghrib">Maghrib</option>
            <option value="full_day">Full Day</option>
          </select>
          {mode === 'student' && (
            <select
              value={selectedHalaqah}
              onChange={(e) => setSelectedHalaqah(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
            >
              <option value="all">All Halaqahs</option>
              {halaqahs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={generateSecureQrToken}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C49A45] bg-[#FBF8EE] px-3 py-1.5 text-xs font-bold text-[#7A5915]"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{t(lang, 'qrTokenCheckin')}</span>
          </button>
        </div>
      </div>

      {qrDataUrl && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#C49A45]/60 bg-white p-4">
          <img src={qrDataUrl} alt="Secure QR Session Token" className="h-28 w-28 rounded border" />
          <div className="text-xs">
            <p className="font-bold text-[#0B3D2E]">Session QR Attendance Token</p>
            <p className="mt-1 font-mono-tabular text-[#145A32]">{qrToken}</p>
            <p className="mt-1 text-[#4A6355]">
              Opaque session-scoped token (not bare student ID) for authenticated verification.
            </p>
          </div>
        </div>
      )}

      {canMark && (
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'recordAttendance')}
            </h3>
            <input
              placeholder="Optional absence/late note..."
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              className="min-w-[220px] rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
            />
          </div>
          <div className="divide-y divide-[#EAF3ED]">
            {targets.map((item) => {
              const existingToday = attendance.find(
                (a) =>
                  a.recordType === mode &&
                  a.targetId === item.id &&
                  a.date === date &&
                  a.session === session
              );
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="text-xs">
                    <span className="font-mono-tabular font-semibold text-[#145A32]">
                      {'code' in item ? item.code : item.staffCode}
                    </span>{' '}
                    — <span className="font-semibold">{item.fullName}</span>
                    {existingToday && (
                      <span className="ml-2 rounded bg-[#EAF3ED] px-2 py-0.5 text-[10px] font-bold text-[#145A32]">
                        {existingToday.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['Present', 'Absent', 'Late', 'Excused'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => markStatus(item, st)}
                        className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                          existingToday?.status === st
                            ? 'border-[#145A32] bg-[#145A32] text-white'
                            : 'border-[#D6E3DA] bg-[#F9FBF9] text-[#334E3F] hover:border-[#145A32]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. EXAMS & ASSESSMENT MODULE
 * ========================================================================== */
export const ExamsModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  exams: ExamRecord[];
  settings: InstitutionSettings;
}> = ({ lang, user, students, exams, settings }) => {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [examType, setExamType] = useState<'hifz_oral' | 'tajweed' | 'revision' | 'written'>(
    'hifz_oral'
  );
  const [juzTested, setJuzTested] = useState('Juz 1–5');
  const [totalScore, setTotalScore] = useState('92');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  const canMarkExam = ['super_admin', 'director', 'examiner'].includes(user.role);
  const canApprove = ['super_admin', 'director'].includes(user.role);

  const handleRecordExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    const scoreNum = Math.min(100, Math.max(0, Number(totalScore) || 0));
    const grade = computeExamGrade(scoreNum, settings.gradingScale);
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'exams'), {
        studentId: st.id,
        studentName: st.fullName,
        studentCode: st.code,
        halaqahId: st.halaqahId || '',
        examDate: todayISOEthiopia(),
        examType,
        juzTested: juzTested.trim(),
        totalScore: scoreNum,
        maximumScore: 100,
        grade,
        examinerId: user.uid,
        examinerName: user.displayName,
        approvalStatus: 'marked',
        comments: comments.trim(),
        createdAt: new Date().toISOString(),
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'RECORD_EXAM',
        entity: 'exams',
        entityId: ref.id,
        summary: `Recorded ${examType} exam (${scoreNum}/100, ${grade}) for ${st.code}`,
      });
      setComments('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'exams');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (ex: ExamRecord) => {
    try {
      await updateDoc(doc(db, 'exams', ex.id), {
        approvalStatus: 'published',
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'PUBLISH_EXAM',
        entity: 'exams',
        entityId: ex.id,
        summary: `Approved & published exam result for ${ex.studentCode}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${ex.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {canMarkExam && (
        <form
          onSubmit={handleRecordExam}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[#145A32]" />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'scheduleExam')}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="">Select Student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.fullName}
                </option>
              ))}
            </select>
            <select
              value={examType}
              onChange={(e) =>
                setExamType(e.target.value as 'hifz_oral' | 'tajweed' | 'revision' | 'written')
              }
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="hifz_oral">Hifz Oral</option>
              <option value="tajweed">Tajweed</option>
              <option value="revision">Revision</option>
              <option value="written">Islamic Studies (Written)</option>
            </select>
            <input
              required
              placeholder={t(lang, 'juzTested')}
              value={juzTested}
              onChange={(e) => setJuzTested(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <input
              type="number"
              min={0}
              max={100}
              required
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <input
              placeholder="Examiner comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs sm:col-span-2 lg:col-span-4"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !studentId}
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E]"
          >
            {saving ? t(lang, 'loading') : t(lang, 'save')}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">{t(lang, 'examType')}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, 'juzTested')}</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">{t(lang, 'grade')}</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAF3ED]">
              {exams.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-3 font-mono-tabular">{ex.examDate}</td>
                  <td className="px-4 py-3 font-medium">
                    <span className="font-mono-tabular text-[#145A32]">{ex.studentCode}</span> —{' '}
                    {ex.studentName}
                  </td>
                  <td className="px-4 py-3">{ex.examType}</td>
                  <td className="px-4 py-3">{ex.juzTested}</td>
                  <td className="px-4 py-3 text-right font-mono-tabular font-bold">
                    {ex.totalScore}/{ex.maximumScore}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#145A32]">{ex.grade}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        ex.approvalStatus === 'published'
                          ? 'bg-[#EAF3ED] text-[#145A32]'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {ex.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canApprove && ex.approvalStatus !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handlePublish(ex)}
                        className="rounded-lg bg-[#C49A45] px-2.5 py-1 text-[11px] font-bold text-[#0B3D2E] hover:bg-[#D5AE5C]"
                      >
                        {t(lang, 'approvePublish')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
