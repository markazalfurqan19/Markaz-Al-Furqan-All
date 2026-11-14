import React, { useMemo, useState } from 'react';
import { addDoc, collection, doc, increment, setDoc, updateDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  BellRing,
  Download,
  FileSpreadsheet,
  FileText,
  Presentation,
  Printer,
  Shield,
  Sparkles,
} from 'lucide-react';
import { BrowserPushPermission } from '../lib/attendanceMonitorService.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  downloadCsvClient,
  downloadServerPdf,
  downloadServerPptx,
  downloadServerXlsx,
  generateVerificationToken,
  getNextSequentialCode,
  logAuditEvent,
  updateInstitutionSettings,
} from '../lib/markazDb.ts';
import { t } from '../shared/i18n.ts';
import { formatETB, getInitials, todayISOEthiopia } from '../shared/quranData.ts';
import {
  AttendanceRecord,
  AuditLog,
  Book,
  BookLoan,
  Certificate,
  ExamRecord,
  Halaqah,
  HifzLog,
  InstitutionSettings,
  Invoice,
  MarkazLanguage,
  NotificationRecord,
  Payment,
  Sponsor,
  StaffMember,
  Student,
  UserProfile,
  UserRole,
} from '../shared/types.ts';
import { MarkazCrest } from './PwaControls.tsx';

/* ============================================================================
 * 1. STAFF & MU'ALLIM MODULE
 * ========================================================================== */
export const StaffModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  staff: StaffMember[];
}> = ({ lang, user, staff }) => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('muallim');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [qualification, setQualification] = useState('Haafizul Qur’aan & Ijaazah');
  const [contractType, setContractType] = useState<'full_time' | 'part_time' | 'volunteer'>(
    'full_time'
  );

  const canManage = ['super_admin', 'director'].includes(user.role);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const staffCode = `STF-${String(staff.length + 1).padStart(4, '0')}`;
      const ref = await addDoc(collection(db, 'staff'), {
        staffCode,
        fullName: fullName.trim(),
        role,
        phone: phone.trim(),
        email: email.trim(),
        qualification: qualification.trim(),
        employmentStatus: 'active',
        contractType,
        assignedHalaqahIds: [],
        joinDate: todayISOEthiopia(),
        active: true,
        createdAt: new Date().toISOString(),
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'CREATE_STAFF',
        entity: 'staff',
        entityId: ref.id,
        summary: `Added staff ${staffCode} (${fullName.trim()}, ${role})`,
      });
      setFullName('');
      setPhone('');
      setEmail('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staff');
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={handleAddStaff}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-3 border-b border-[#EAF3ED] pb-3">
            <MarkazCrest size={38} />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              Add Mu’allim / Staff Profile
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              required
              placeholder={t(lang, 'fullName')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="muallim">Mu’allim</option>
              <option value="examiner">Examiner</option>
              <option value="registrar">Registrar</option>
              <option value="accountant">Accountant</option>
              <option value="kafalat_officer">Kafalat Officer</option>
              <option value="librarian">Librarian</option>
              <option value="director">Director</option>
            </select>
            <input
              required
              placeholder="Phone"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <input
              placeholder="Qualification / Ijaazah"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <select
              value={contractType}
              onChange={(e) =>
                setContractType(e.target.value as 'full_time' | 'part_time' | 'volunteer')
              }
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
          >
            {t(lang, 'save')}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">{t(lang, 'fullName')}</th>
              <th className="px-4 py-3 font-semibold">{t(lang, 'roleLabel')}</th>
              <th className="px-4 py-3 font-semibold">Qualification</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAF3ED]">
            {staff.map((st) => (
              <tr key={st.id}>
                <td className="px-4 py-3 font-mono-tabular font-bold text-[#145A32]">
                  {st.staffCode}
                </td>
                <td className="px-4 py-3 font-semibold">{st.fullName}</td>
                <td className="px-4 py-3 capitalize">{st.role.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-[#4A6355]">{st.qualification}</td>
                <td className="px-4 py-3 font-mono-tabular" dir="ltr">
                  {st.phone}
                </td>
                <td className="px-4 py-3 uppercase">{st.employmentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. GUARDIAN PORTAL MODULE (Linked Children Only)
 * ========================================================================== */
export const GuardianPortalModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  hifzLogs: HifzLog[];
  attendance: AttendanceRecord[];
  exams: ExamRecord[];
  invoices: Invoice[];
}> = ({ lang, user, students, hifzLogs, attendance, exams, invoices }) => {
  const linkedChildren = useMemo(
    () => students.filter((s) => user.linkedStudentIds?.includes(s.id)),
    [students, user.linkedStudentIds]
  );

  if (linkedChildren.length === 0) {
    return (
      <div className="rounded-xl border border-[#D6E3DA] bg-white p-8 text-center">
        <MarkazCrest size={56} className="mx-auto mb-3" />
        <h3 className="font-display text-base font-bold text-[#0B3D2E]">
          {t(lang, 'nav_guardian_portal')}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-[#4A6355]">
          Your Google account ({user.email}) is signed in as Parent/Guardian. Ask the Markaz
          Registrar to link your student ID(s) in User Access Settings to view verified Hifz logs,
          attendance, published exams, and tuition statements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {linkedChildren.map((child) => {
        const childHifz = hifzLogs.filter((l) => l.studentId === child.id).slice(0, 5);
        const childExams = exams.filter(
          (ex) => ex.studentId === child.id && ex.approvalStatus === 'published'
        );
        const childAtt = attendance.filter((a) => a.targetId === child.id);
        const presentPct =
          childAtt.length > 0
            ? Math.round(
                (childAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length /
                  childAtt.length) *
                  100
              )
            : 100;
        const childInvoices = invoices.filter((i) => i.studentId === child.id);

        return (
          <div key={child.id} className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF3ED] pb-3">
              <div className="flex items-center gap-3">
                <MarkazCrest size={42} />
                <div>
                  <p className="font-mono-tabular text-xs font-bold text-[#145A32]">{child.code}</p>
                  <h3 className="font-display text-base font-bold text-[#0B3D2E]">
                    {child.fullName}
                  </h3>
                  <p className="text-xs text-[#4A6355]">
                    {child.halaqahGroup} • {child.currentSurah} (Juz {child.juzLevel}/30)
                  </p>
                </div>
              </div>
              <div className="text-right font-mono-tabular">
                <p className="text-xs text-[#4A6355]">Attendance Rate</p>
                <p className="text-lg font-bold text-[#145A32]">{presentPct}%</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 text-xs">
              <div>
                <h4 className="mb-2 font-bold text-[#0B3D2E]">Recent Hifz Logs</h4>
                {childHifz.map((l) => (
                  <div key={l.id} className="mb-1.5 rounded border border-[#EAF3ED] p-2">
                    <p className="font-semibold">
                      {l.date}: {l.currentSurah} — {l.sabaqRange}
                    </p>
                    <p className="text-[#145A32]">{l.grade}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="mb-2 font-bold text-[#0B3D2E]">Published Exam Results</h4>
                {childExams.map((ex) => (
                  <div key={ex.id} className="mb-1.5 rounded border border-[#EAF3ED] p-2">
                    <p className="font-semibold">
                      {ex.examType} (Juz {ex.juzTested})
                    </p>
                    <p className="font-mono-tabular text-[#145A32]">
                      {ex.totalScore}/100 ({ex.grade})
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="mb-2 font-bold text-[#0B3D2E]">Tuition Statements</h4>
                {childInvoices.map((inv) => (
                  <div key={inv.id} className="mb-1.5 rounded border border-[#EAF3ED] p-2">
                    <p className="font-mono-tabular font-semibold">{inv.period}</p>
                    <p className="font-mono-tabular">
                      Balance: {formatETB(inv.balance, lang)} ({inv.status})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ============================================================================
 * 3. LIBRARY & LEARNING RESOURCES MODULE
 * ========================================================================== */
export const LibraryModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  books: Book[];
  bookLoans: BookLoan[];
  students: Student[];
}> = ({ lang, user, books, bookLoans, students }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Tafsir & Tajweed');
  const [accessionCode, setAccessionCode] = useState('');
  const [copies, setCopies] = useState('5');
  const [loanBookId, setLoanBookId] = useState('');
  const [borrowerId, setBorrowerId] = useState('');

  const canManage = ['super_admin', 'director', 'librarian'].includes(user.role);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Math.max(1, Number(copies) || 1);
    try {
      await addDoc(collection(db, 'books'), {
        title: title.trim(),
        author: author.trim(),
        category,
        language: lang,
        accessionCode: accessionCode.trim().toUpperCase(),
        totalCopies: num,
        availableCopies: num,
      });
      setTitle('');
      setAuthor('');
      setAccessionCode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'books');
    }
  };

  const handleIssueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const bk = books.find((b) => b.id === loanBookId);
    const st = students.find((s) => s.id === borrowerId);
    if (!bk || !st || bk.availableCopies <= 0) return;
    try {
      const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      await addDoc(collection(db, 'bookLoans'), {
        bookId: bk.id,
        bookTitle: bk.title,
        accessionCode: bk.accessionCode,
        borrowerId: st.id,
        borrowerName: st.fullName,
        borrowerType: 'student',
        issuedAt: todayISOEthiopia(),
        dueAt: due,
        status: 'borrowed',
        issuedBy: user.uid,
      });
      await updateDoc(doc(db, 'books', bk.id), {
        availableCopies: increment(-1),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bookLoans');
    }
  };

  const handleReturnLoan = async (loan: BookLoan) => {
    try {
      await updateDoc(doc(db, 'bookLoans', loan.id), {
        status: 'returned',
        returnedAt: todayISOEthiopia(),
      });
      await updateDoc(doc(db, 'books', loan.bookId), {
        availableCopies: increment(1),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookLoans/${loan.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleAddBook}
            className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">Add Library Book</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                required
                placeholder="Book Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              />
              <input
                placeholder="Author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              />
              <input
                required
                placeholder="Accession Code (e.g. LIB-001)"
                value={accessionCode}
                onChange={(e) => setAccessionCode(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs uppercase"
              />
              <input
                type="number"
                min={1}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white"
            >
              Add to Catalogue
            </button>
          </form>

          <form
            onSubmit={handleIssueLoan}
            className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">Issue Book Loan</h3>
            <select
              required
              value={loanBookId}
              onChange={(e) => setLoanBookId(e.target.value)}
              className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="">Select Available Book...</option>
              {books
                .filter((b) => b.availableCopies > 0)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.accessionCode} — {b.title} ({b.availableCopies} avail)
                  </option>
                ))}
            </select>
            <select
              required
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="">Select Student Borrower...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.fullName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-[#C49A45] px-4 py-2 text-xs font-bold text-[#0B3D2E]"
            >
              Issue 14-Day Loan
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <h4 className="mb-3 font-display text-sm font-bold text-[#0B3D2E]">
            Catalogue ({books.length})
          </h4>
          <div className="divide-y divide-[#EAF3ED] text-xs">
            {books.map((b) => (
              <div key={b.id} className="flex justify-between py-2.5">
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-[#4A6355]">
                    {b.accessionCode} • {b.author}
                  </p>
                </div>
                <span className="font-mono-tabular font-bold text-[#145A32]">
                  {b.availableCopies}/{b.totalCopies}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <h4 className="mb-3 font-display text-sm font-bold text-[#0B3D2E]">
            Active & Returned Loans ({bookLoans.length})
          </h4>
          <div className="divide-y divide-[#EAF3ED] text-xs">
            {bookLoans.map((ln) => (
              <div key={ln.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">{ln.bookTitle}</p>
                  <p className="text-[#4A6355]">
                    {ln.borrowerName} • Due {ln.dueAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="uppercase font-semibold">{ln.status}</span>
                  {canManage && ln.status === 'borrowed' && (
                    <button
                      type="button"
                      onClick={() => handleReturnLoan(ln)}
                      className="rounded bg-[#EAF3ED] px-2 py-1 text-[11px] font-bold text-[#145A32]"
                    >
                      Return
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. CERTIFICATES & GRADUATION MODULE (Official Crest + QR Verification)
 * ========================================================================== */
export const CertificatesModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  certificates: Certificate[];
}> = ({ lang, user, students, certificates }) => {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [graduationBatch, setGraduationBatch] = useState('BATCH1447');
  const [totalJuzCompleted, setTotalJuzCompleted] = useState('30');
  const [finalGrade, setFinalGrade] = useState('Mumtaz');
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');

  const canIssue = ['super_admin', 'director', 'registrar'].includes(user.role);

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    const cleanBatch = graduationBatch.replace(/[^A-Z0-9]/gi, '').toUpperCase() || '2026';
    try {
      const certificateNo = await getNextSequentialCode('certificates', 'AFQ-CERT', cleanBatch);
      const token = generateVerificationToken();
      const issuedAt = todayISOEthiopia();
      const juzNum = Math.min(30, Math.max(1, Number(totalJuzCompleted) || 30));

      const ref = await addDoc(collection(db, 'certificates'), {
        certificateNo,
        studentId: st.id,
        studentName: st.fullName,
        studentCode: st.code,
        graduationBatch: cleanBatch,
        track: st.track,
        totalJuzCompleted: juzNum,
        finalGrade,
        issuedAt,
        verificationToken: token,
        status: 'active',
        approvedBy: user.uid,
      });

      // Minimal non-PII public verification mirror
      await setDoc(doc(db, 'publicCertificates', token), {
        certificateNo,
        studentInitials: getInitials(st.fullName),
        track: st.track,
        graduationBatch: cleanBatch,
        totalJuzCompleted: juzNum,
        issuedAt,
        status: 'active',
      });

      await logAuditEvent({
        actorRole: user.role,
        action: 'ISSUE_CERTIFICATE',
        entity: 'certificates',
        entityId: ref.id,
        summary: `Issued certificate ${certificateNo} for ${st.code}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'certificates');
    }
  };

  const openCertPreview = async (cert: Certificate) => {
    const dataUrl = await QRCode.toDataURL(cert.verificationToken, { width: 120, margin: 1 });
    setQrUrl(dataUrl);
    setPreviewCert(cert);
  };

  const handleRevoke = async (cert: Certificate) => {
    try {
      await updateDoc(doc(db, 'certificates', cert.id), {
        status: 'revoked',
        revocationReason: 'Administrative revocation',
      });
      await setDoc(
        doc(db, 'publicCertificates', cert.verificationToken),
        { status: 'revoked' },
        { merge: true }
      );
      await logAuditEvent({
        actorRole: user.role,
        action: 'REVOKE_CERTIFICATE',
        entity: 'certificates',
        entityId: cert.id,
        summary: `Revoked certificate ${cert.certificateNo}`,
        reason: 'Administrative revocation',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `certificates/${cert.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {canIssue && (
        <form
          onSubmit={handleIssueCertificate}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-3 border-b border-[#EAF3ED] pb-3">
            <MarkazCrest size={40} />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'issueCertificate')}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="">Select Eligible Student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.fullName}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Batch Code (e.g. BATCH1447)"
              value={graduationBatch}
              onChange={(e) => setGraduationBatch(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs uppercase"
            />
            <input
              type="number"
              min={1}
              max={30}
              value={totalJuzCompleted}
              onChange={(e) => setTotalJuzCompleted(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <input
              value={finalGrade}
              onChange={(e) => setFinalGrade(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={!studentId}
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
          >
            Approve & Issue Certificate
          </button>
        </form>
      )}

      {/* Printable Trilingual Certificate Preview */}
      {previewCert && (
        <div className="print-container rounded-2xl border-4 border-double border-[#C49A45] bg-[#FFFEFA] p-8 text-center">
          <div className="no-print mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#145A32] px-3 py-1.5 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" /> {t(lang, 'print')}
            </button>
            <button
              type="button"
              onClick={() => setPreviewCert(null)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
            >
              Close
            </button>
          </div>

          <MarkazCrest size={78} className="mx-auto" />
          <p className="font-arabic mt-3 text-lg font-bold text-[#145A32]" dir="rtl">
            {t(lang, 'brandArabic')}
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-wide text-[#0B3D2E]">
            {t(lang, 'brandMain')}
          </h3>
          <p className="text-xs text-[#4A6355]">{t(lang, 'brandLocation')}</p>

          <div className="my-6 border-y border-[#C49A45]/40 py-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#C49A45]">
              SHAHADAH / WARAQAA RAGAA / CERTIFICATE OF COMPLETION
            </p>
            <h4 className="font-display mt-2 text-2xl font-bold text-[#0B3D2E]">
              {previewCert.studentName}
            </h4>
            <p className="mt-1 text-xs text-[#334E3F]">
              Has successfully completed{' '}
              <strong className="font-mono-tabular">{previewCert.totalJuzCompleted} Juz</strong> in{' '}
              <strong>{t(lang, `track_${previewCert.track}`)}</strong> with grade{' '}
              <strong>{previewCert.finalGrade}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-left text-xs">
            <div className="space-y-1 font-mono-tabular">
              <p>Certificate No: <strong>{previewCert.certificateNo}</strong></p>
              <p>Verification Token: <strong>{previewCert.verificationToken}</strong></p>
              <p>Issued Date: {previewCert.issuedAt}</p>
            </div>
            {qrUrl && <img src={qrUrl} alt="QR Verification" className="h-24 w-24 border p-1" />}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Certificate #</th>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">QR Token</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAF3ED]">
            {certificates.map((cert) => (
              <tr key={cert.id}>
                <td className="px-4 py-3 font-mono-tabular font-bold text-[#145A32]">
                  {cert.certificateNo}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {cert.studentName} ({cert.totalJuzCompleted} Juz)
                </td>
                <td className="px-4 py-3 font-mono-tabular">{cert.verificationToken}</td>
                <td className="px-4 py-3 uppercase">{cert.status}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => openCertPreview(cert)}
                    className="rounded border border-[#145A32]/40 bg-[#EAF3ED] px-2.5 py-1 text-[11px] font-bold text-[#145A32]"
                  >
                    View & Print
                  </button>
                  {user.role === 'super_admin' && cert.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(cert)}
                      className="rounded border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. NOTIFICATIONS MODULE
 * ========================================================================== */
export const NotificationsModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  notifications: NotificationRecord[];
  pushPermission?: BrowserPushPermission;
  onEnablePush?: () => void;
}> = ({ lang, user, notifications, pushPermission = 'default', onEnablePush }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'in_app' | 'sms' | 'email' | 'whatsapp'>('in_app');
  const [recipientRole, setRecipientRole] = useState('guardian');
  const [consentVerified, setConsentVerified] = useState(true);

  const canSend = !['guardian', 'auditor'].includes(user.role);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientRole,
        title: title.trim(),
        message: message.trim(),
        channel,
        language: lang,
        deliveryStatus: channel === 'in_app' ? 'sent' : 'queued',
        consentVerified,
        createdAt: new Date().toISOString(),
      });
      setTitle('');
      setMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D6E3DA] bg-white px-4 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <BellRing className="h-4 w-4 text-[#145A32]" />
          <span className="font-semibold text-[#0B3D2E]">
            {pushPermission === 'granted'
              ? t(lang, 'pushAlertsActive')
              : pushPermission === 'denied'
                ? t(lang, 'pushAlertsBlocked')
                : t(lang, 'absenceStreakAlertTitle')}
          </span>
        </div>
        {pushPermission === 'default' && onEnablePush && (
          <button
            type="button"
            onClick={onEnablePush}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#145A32] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0B3D2E]"
          >
            <BellRing className="h-3.5 w-3.5" />
            <span>{t(lang, 'enablePushAlerts')}</span>
          </button>
        )}
      </div>

      {canSend && (
        <form
          onSubmit={handleSend}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
            Send Trilingual Notice (No Sensitive Financial/PII Leaks)
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Notice Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs sm:col-span-2"
            />
            <select
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as 'in_app' | 'sms' | 'email' | 'whatsapp')
              }
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="in_app">In-App Notice</option>
              <option value="sms">SMS Queue</option>
              <option value="email">Email Queue</option>
              <option value="whatsapp">WhatsApp Queue</option>
            </select>
            <textarea
              required
              rows={2}
              placeholder="Message body..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs sm:col-span-3"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={consentVerified}
                onChange={(e) => setConsentVerified(e.target.checked)}
                className="accent-[#145A32]"
              />
              <span>Recipient communication consent verified</span>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
            >
              Dispatch Notice
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {notifications.map((n) => {
          const isAbsenceStreak = n.id.startsWith('abs3_');
          return (
            <div
              key={n.id}
              className={`rounded-xl border p-4 text-xs ${
                isAbsenceStreak
                  ? 'border-[#C49A45] bg-[#FFFBEB]'
                  : 'border-[#D6E3DA] bg-white'
              }`}
            >
              <div className="flex justify-between gap-2">
                <h4 className="flex items-center gap-1.5 font-bold text-[#0B3D2E]">
                  {isAbsenceStreak && <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />}
                  <span>{n.title}</span>
                </h4>
                <span className="font-mono-tabular uppercase text-[#145A32]">
                  {n.channel} • {n.deliveryStatus}
                </span>
              </div>
              <p className="mt-1 text-[#334E3F]">{n.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. REPORTS, EXPORTS & SERVER-SIDE GEMINI AI ASSISTANT
 * ========================================================================== */
export const ReportsAndAiModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  attendance: AttendanceRecord[];
  hifzLogs: HifzLog[];
  payments: Payment[];
  sponsors: Sponsor[];
}> = ({ lang, user, students, attendance, hifzLogs, payments, sponsors }) => {
  const [topic, setTopic] = useState('executive');
  const [draftText, setDraftText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [exportingType, setExportingType] = useState<'pdf' | 'pptx' | 'xlsx' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const reportMeta = useMemo(() => {
    const activeStudents = students.filter((s) => s.status === 'active');
    const activePayments = payments.filter((p) => p.reversalStatus === 'active');
    const presentCount = attendance.filter(
      (a) => a.status === 'Present' || a.status === 'Late'
    ).length;
    const attendanceRate =
      attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
    const tuitionTotal = activePayments.reduce((a, b) => a + b.amountETB, 0);

    const kpis = [
      { label: t(lang, 'kpiActiveStudents'), value: String(activeStudents.length) },
      { label: t(lang, 'kpiAttendanceRate'), value: `${attendanceRate}%` },
      { label: t(lang, 'kpiMonthlyRevenue'), value: formatETB(tuitionTotal, lang) },
      {
        label: t(lang, 'kpiActiveSponsors'),
        value: String(sponsors.filter((sp) => sp.status === 'active').length),
      },
      { label: 'Total Hifz Logs', value: String(hifzLogs.length) },
      {
        label: 'Mumtaz Evaluations',
        value: String(hifzLogs.filter((l) => l.grade === 'Mumtaz').length),
      },
    ];

    let columns: string[] = ['Code', 'Full Name', 'Track', 'Halaqah', 'Surah', 'Juz', 'Status'];
    let rows: (string | number)[][] = students.map((s) => [
      s.code,
      s.fullName,
      s.track,
      s.halaqahGroup || '-',
      s.currentSurah,
      s.juzLevel,
      s.status,
    ]);
    let sheetName = 'AlFurqaanStudents';

    if (topic === 'hifz_academic') {
      columns = ['Date', 'Student', 'Halaqah', 'Surah', 'Sabaq', 'Pages', 'Grade'];
      rows = hifzLogs.slice(0, 80).map((l) => [
        l.date,
        l.studentName,
        l.halaqahId || '-',
        l.currentSurah,
        l.sabaqRange,
        l.sabaqPages,
        l.grade,
      ]);
      sheetName = 'HifzProgress';
    } else if (topic === 'attendance_followup') {
      columns = ['Date', 'Type', 'Code', 'Name', 'Status', 'Verification', 'Session'];
      rows = attendance.slice(0, 80).map((a) => [
        a.date,
        a.recordType,
        a.targetCode || '-',
        a.targetName,
        a.status,
        a.qrVerified ? 'QR Verified' : 'Manual',
        a.session,
      ]);
      sheetName = 'AttendanceLog';
    } else if (topic === 'finance_summary') {
      columns = ['Receipt #', 'Date', 'Student', 'Payer', 'Channel', 'Amount ETB', 'Status'];
      rows = payments.slice(0, 80).map((p) => [
        p.receiptNo,
        p.transactionDate,
        p.studentName,
        p.payerName,
        p.method,
        p.amountETB,
        p.reversalStatus,
      ]);
      sheetName = 'FinanceReceipts';
    }

    const topicLabels: Record<string, string> = {
      executive: 'Executive Markaz Overview Report',
      hifz_academic: 'Hifz & Academic Progress Report',
      attendance_followup: 'Attendance & At-Risk Follow-up Report',
      finance_summary: 'Tuition & Kafalat Summary Report',
    };

    return {
      title: topicLabels[topic] || 'Al-Furqaan Markaz Report',
      sheetName,
      kpis,
      columns,
      rows,
      aggregates: {
        totalActiveStudents: activeStudents.length,
        maleStudents: activeStudents.filter((s) => s.gender === 'male').length,
        femaleStudents: activeStudents.filter((s) => s.gender === 'female').length,
        totalHifzLogs: hifzLogs.length,
        mumtazLogs: hifzLogs.filter((l) => l.grade === 'Mumtaz').length,
        needsRevisionFlags: hifzLogs.filter((l) => l.grade === 'Needs Revision').length,
        attendanceTotalEntries: attendance.length,
        attendancePresentCount: presentCount,
        tuitionCollectedETB: tuitionTotal,
        activeSponsorsCount: sponsors.filter((sp) => sp.status === 'active').length,
      },
    };
  }, [students, attendance, hifzLogs, payments, sponsors, topic, lang]);

  const handleGenerateAiDraft = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/v1/ai/report-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, topic, aggregates: reportMeta.aggregates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI generation failed');
      setDraftText(json.draftText);
      await logAuditEvent({
        actorRole: user.role,
        action: 'AI_DRAFT_REPORT',
        entity: 'reports',
        entityId: topic,
        summary: `Generated masked AI report draft (${topic}, lang=${lang})`,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBuildStructuredDraft = () => {
    setAiError(null);
    const agg = reportMeta.aggregates;
    const summaryLines = [
      reportMeta.title,
      `Institution: ${t(lang, 'brandMain')} (${t(lang, 'brandLocation')})`,
      `Date: ${todayISOEthiopia()}`,
      '',
      'Executive Summary',
      `As of ${todayISOEthiopia()}, Al-Furqaan Markaz records ${agg.totalActiveStudents} active learners (${agg.maleStudents} male, ${agg.femaleStudents} female), an attendance rate of ${reportMeta.kpis[1]?.value || '0%'}, and ${formatETB(agg.tuitionCollectedETB, lang)} in active tuition receipts.`,
      '',
      'Key Verified Observations',
      `- Total daily Hifz evaluations recorded: ${agg.totalHifzLogs} (${agg.mumtazLogs} Mumtaz, ${agg.needsRevisionFlags} Needs Revision flags).`,
      `- Active Kafalat sponsorships linked: ${agg.activeSponsorsCount}.`,
      `- Attendance entries audited: ${agg.attendancePresentCount} present/late out of ${agg.attendanceTotalEntries} total entries.`,
      '',
      'Recommended Follow-Up Actions',
      '- Review learners marked Needs Revision with their assigned Mu’allim for Sabqi & Manzil reinforcement.',
      '- Reconcile daily tuition receipts and follow up on pending admissions in the Registrar queue.',
    ];
    setDraftText(summaryLines.join('\n'));
  };

  const handleDownloadPdf = async (includeDraft: boolean) => {
    setExportingType('pdf');
    setAiError(null);
    try {
      await downloadServerPdf({
        title: reportMeta.title,
        subtitle: t(lang, 'brandLocation'),
        language: lang,
        narrativeText: includeDraft ? draftText || undefined : undefined,
        kpis: reportMeta.kpis,
        columns: reportMeta.columns,
        rows: reportMeta.rows,
        filename: `alfurqaan-${topic}-report.pdf`,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadPptx = async (includeDraft: boolean) => {
    setExportingType('pptx');
    setAiError(null);
    try {
      await downloadServerPptx({
        title: reportMeta.title,
        subtitle: t(lang, 'brandLocation'),
        language: lang,
        narrativeText: includeDraft ? draftText || undefined : undefined,
        kpis: reportMeta.kpis,
        columns: reportMeta.columns,
        rows: reportMeta.rows,
        filename: `alfurqaan-${topic}-deck.pptx`,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'PowerPoint export failed');
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadXlsx = async () => {
    setExportingType('xlsx');
    setAiError(null);
    try {
      await downloadServerXlsx({
        sheetName: reportMeta.sheetName,
        columns: reportMeta.columns,
        rows: reportMeta.rows,
        filename: `alfurqaan-${topic}.xlsx`,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'XLSX export failed');
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Exports Card */}
      <div className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#EAF3ED] pb-3">
          <MarkazCrest size={42} />
          <div>
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              Official Markaz Exports (CSV / XLSX / PDF / Editable PPTX)
            </h3>
            <p className="text-xs text-[#4A6355]">
              Exported figures match live Firestore aggregate records with official Al-Furqaan
              header.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              downloadCsvClient(`alfurqaan-${topic}.csv`, reportMeta.columns, reportMeta.rows)
            }
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6E3DA] bg-[#F9FBF9] px-4 py-2 text-xs font-bold text-[#0B3D2E] hover:border-[#145A32]"
          >
            <Download className="h-4 w-4" /> {t(lang, 'exportCsv')}
          </button>
          <button
            type="button"
            disabled={exportingType !== null}
            onClick={handleDownloadXlsx}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6E3DA] bg-[#F9FBF9] px-4 py-2 text-xs font-bold text-[#0B3D2E] hover:border-[#145A32] disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#145A32]" /> {t(lang, 'exportXlsx')}
          </button>
          <button
            type="button"
            disabled={exportingType !== null}
            onClick={() => handleDownloadPdf(Boolean(draftText))}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E] disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            <span>{exportingType === 'pdf' ? t(lang, 'loading') : t(lang, 'exportPdf')}</span>
          </button>
          <button
            type="button"
            disabled={exportingType !== null}
            onClick={() => handleDownloadPptx(Boolean(draftText))}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#C49A45] px-4 py-2 text-xs font-bold text-[#0B3D2E] hover:bg-[#D5AE5C] disabled:opacity-60"
          >
            <Presentation className="h-4 w-4" />
            <span>{exportingType === 'pptx' ? t(lang, 'loading') : 'Export PPTX (.pptx)'}</span>
          </button>
        </div>
      </div>

      {/* Report Composer & Server-Side Gemini AI Assistant */}
      <div className="rounded-xl border border-[#C49A45]/60 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3">
          <MarkazCrest size={42} />
          <div>
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'aiTitle')}
            </h3>
            <p className="text-xs text-[#7A5915]">{t(lang, 'aiDisclaimer')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
          >
            <option value="executive">Executive Summary</option>
            <option value="hifz_academic">Hifz & Academic Progress</option>
            <option value="attendance_followup">Attendance & At-Risk Follow-up</option>
            <option value="finance_summary">Tuition & Kafalat Summary</option>
          </select>
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleGenerateAiDraft}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#C49A45] px-5 py-2 text-xs font-bold text-[#0B3D2E] hover:bg-[#D5AE5C] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            <span>{aiLoading ? t(lang, 'loading') : t(lang, 'generateAiDraft')}</span>
          </button>
          <button
            type="button"
            onClick={handleBuildStructuredDraft}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#145A32]/40 bg-[#EAF3ED] px-4 py-2 text-xs font-bold text-[#145A32] hover:bg-[#DCEBE1]"
          >
            <FileText className="h-4 w-4" />
            <span>Build Live Stats Summary</span>
          </button>
        </div>

        {aiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {aiError}
          </div>
        )}

        {draftText !== null && (
          <div className="print-container rounded-xl border border-[#D6E3DA] bg-[#FBFDFB] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAF3ED] pb-3">
              <div className="flex items-center gap-2.5">
                <MarkazCrest size={32} />
                <span className="text-xs font-bold text-[#0B3D2E]">
                  Editable Report Draft (Human Review Required)
                </span>
              </div>
              <div className="no-print flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={exportingType !== null}
                  onClick={() => handleDownloadPptx(true)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#C49A45] px-3 py-1.5 text-[11px] font-bold text-[#0B3D2E] hover:bg-[#D5AE5C] disabled:opacity-60"
                >
                  <Presentation className="h-3.5 w-3.5" />
                  <span>{exportingType === 'pptx' ? t(lang, 'loading') : 'Download .pptx'}</span>
                </button>
                <button
                  type="button"
                  disabled={exportingType !== null}
                  onClick={() => handleDownloadPdf(true)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#145A32] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0B3D2E] disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{exportingType === 'pdf' ? t(lang, 'loading') : 'Download .pdf'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#D6E3DA] bg-white px-2.5 py-1.5 text-[11px] font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{t(lang, 'print')}</span>
                </button>
              </div>
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-[#D6E3DA] bg-white p-3 font-sans text-xs leading-relaxed text-[#0E2419] outline-none focus:border-[#145A32]"
            />
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 7. SETTINGS, RBAC USER MANAGER & AUDIT LOGS
 * ========================================================================== */
export const SettingsAndAuditModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  settings: InstitutionSettings;
  allUsers: UserProfile[];
  halaqahs: Halaqah[];
  students: Student[];
  auditLogs: AuditLog[];
}> = ({ lang, user, settings, allUsers, halaqahs, students, auditLogs }) => {
  const [defaultLang, setDefaultLang] = useState<MarkazLanguage>(settings.defaultLanguage);
  const [academicYear, setAcademicYear] = useState(settings.activeAcademicYear);
  const [mumtazMin, setMumtazMin] = useState(String(settings.gradingScale.mumtazMin));
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const canEdit = ['super_admin', 'director'].includes(user.role);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateInstitutionSettings(
      {
        defaultLanguage: defaultLang,
        activeAcademicYear: academicYear,
        gradingScale: {
          ...settings.gradingScale,
          mumtazMin: Math.min(100, Math.max(70, Number(mumtazMin) || 90)),
        },
      },
      user.uid
    );
    await logAuditEvent({
      actorRole: user.role,
      action: 'UPDATE_SETTINGS',
      entity: 'settings',
      entityId: 'institution',
      summary: `Updated institution settings (defaultLanguage=${defaultLang}, year=${academicYear})`,
    });
    setSavedMsg('Institution settings updated.');
  };

  const handleUpdateUserRole = async (target: UserProfile, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'CHANGE_USER_ROLE',
        entity: 'users',
        entityId: target.uid,
        summary: `Changed ${target.email} role from ${target.role} to ${newRole}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleToggleHalaqahAssign = async (target: UserProfile, halaqahId: string) => {
    const current = new Set(target.assignedHalaqahIds || []);
    if (current.has(halaqahId)) current.delete(halaqahId);
    else current.add(halaqahId);
    await updateDoc(doc(db, 'users', target.uid), {
      assignedHalaqahIds: Array.from(current),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-3 border-b border-[#EAF3ED] pb-3">
            <MarkazCrest size={40} />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'institutionSettings')}
            </h3>
          </div>
          {savedMsg && (
            <div className="rounded-lg bg-[#EAF3ED] px-3 py-2 text-xs font-semibold text-[#145A32]">
              {savedMsg}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Default Language</label>
              <select
                value={defaultLang}
                onChange={(e) => setDefaultLang(e.target.value as MarkazLanguage)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              >
                <option value="om">Afaan Oromoo</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Academic Year</label>
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Mumtaz Min Score</label>
              <input
                type="number"
                value={mumtazMin}
                onChange={(e) => setMumtazMin(e.target.value)}
                className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
          >
            {t(lang, 'save')}
          </button>
        </form>
      )}

      {/* RBAC Role Management */}
      {canEdit && (
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
            User Roles & Halaqah Scope ({allUsers.length})
          </h3>
          <div className="divide-y divide-[#EAF3ED] text-xs">
            {allUsers.map((u) => (
              <div key={u.uid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold text-[#0E2419]">{u.displayName}</p>
                  <p className="text-[#4A6355]">{u.email}</p>
                  {u.role === 'muallim' && halaqahs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {halaqahs.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => handleToggleHalaqahAssign(u, h.id)}
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            u.assignedHalaqahIds?.includes(h.id)
                              ? 'border-[#145A32] bg-[#EAF3ED] text-[#145A32]'
                              : 'border-[#D6E3DA] text-[#4A6355]'
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  disabled={u.uid === user.uid && user.role === 'super_admin'}
                  value={u.role}
                  onChange={(e) => handleUpdateUserRole(u, e.target.value as UserRole)}
                  className="rounded-lg border border-[#D6E3DA] px-2.5 py-1.5 text-xs font-semibold"
                >
                  {(
                    [
                      'super_admin',
                      'director',
                      'registrar',
                      'muallim',
                      'examiner',
                      'accountant',
                      'kafalat_officer',
                      'librarian',
                      'guardian',
                      'auditor',
                    ] as UserRole[]
                  ).map((r) => (
                    <option key={r} value={r}>
                      {t(lang, `role_${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Immutable Audit Trail */}
      <div className="rounded-xl border border-[#D6E3DA] bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#145A32]" />
          <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
            {t(lang, 'auditLogsTitle')} ({auditLogs.length})
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-[#EAF3ED] text-xs">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono-tabular font-bold text-[#145A32]">
                  {log.action} ({log.entity})
                </span>
                <span className="font-mono-tabular text-[11px] text-[#4A6355]">
                  {log.timestamp.slice(0, 19).replace('T', ' ')}
                </span>
              </div>
              <p className="mt-0.5 text-[#0E2419]">{log.summary}</p>
              <p className="text-[11px] text-[#4A6355]">
                Actor: {log.actorEmail} ({log.actorRole}) {log.reason ? `• Reason: ${log.reason}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
