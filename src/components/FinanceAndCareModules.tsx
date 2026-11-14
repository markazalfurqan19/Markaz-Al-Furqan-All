import React, { useMemo, useState } from 'react';
import { MarkazCrest } from './PwaControls.tsx';
import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Coins,
  HandHeart,
  Printer,
  Receipt,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { getNextSequentialCode, logAuditEvent } from '../lib/markazDb.ts';
import { t } from '../shared/i18n.ts';
import { formatETB, todayISOEthiopia } from '../shared/quranData.ts';
import {
  AdmissionApplication,
  Campaign,
  Donation,
  Donor,
  FeePlan,
  Halaqah,
  Invoice,
  MarkazLanguage,
  Payment,
  PaymentMethod,
  Pledge,
  Sponsor,
  Student,
  StudyTrack,
  UserProfile,
} from '../shared/types.ts';

/* ============================================================================
 * 1. FINANCE & TUITION MODULE (Fee Plans, Invoices, Receipts, Void/Reversal)
 * ========================================================================== */
export const FinanceModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  feePlans: FeePlan[];
  invoices: Invoice[];
  payments: Payment[];
}> = ({ lang, user, students, feePlans, invoices, payments }) => {
  const [tab, setTab] = useState<'payments' | 'invoices' | 'plans'>('payments');
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [invoiceId, setInvoiceId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [amountETB, setAmountETB] = useState('750');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [printPayment, setPrintPayment] = useState<Payment | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Invoice form
  const [invStudentId, setInvStudentId] = useState(students[0]?.id || '');
  const [invPeriod, setInvPeriod] = useState(todayISOEthiopia().slice(0, 7));
  const [invAmount, setInvAmount] = useState('750');

  // Fee Plan form
  const [planName, setPlanName] = useState('');
  const [planTrack, setPlanTrack] = useState<StudyTrack>('full_hifz');
  const [planAmount, setPlanAmount] = useState('750');
  const [planFreq, setPlanFreq] = useState<'monthly' | 'term' | 'annual' | 'one_time'>('monthly');

  const canWriteFinance = ['super_admin', 'director', 'accountant'].includes(user.role);

  const reconciliation = useMemo(() => {
    const active = payments.filter((p) => p.reversalStatus === 'active');
    const total = active.reduce((a, b) => a + b.amountETB, 0);
    const cash = active.filter((p) => p.method === 'cash').reduce((a, b) => a + b.amountETB, 0);
    const bank = active.filter((p) => p.method === 'bank').reduce((a, b) => a + b.amountETB, 0);
    const mobile = active.filter((p) => p.method === 'mobile').reduce((a, b) => a + b.amountETB, 0);
    const reversedCount = payments.filter((p) => p.reversalStatus === 'reversed').length;
    const outstanding = invoices.reduce((a, b) => a + (b.balance || 0), 0);
    return { total, cash, bank, mobile, reversedCount, outstanding };
  }, [payments, invoices]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    const amt = Math.max(1, Number(amountETB) || 0);
    try {
      const receiptNo = await getNextSequentialCode('receipts', 'AFQ-RCP');
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, 'payments'), {
        receiptNo,
        invoiceId: invoiceId || '',
        studentId: st.id,
        studentName: st.fullName,
        payerName: payerName.trim() || st.guardianName,
        amountETB: amt,
        method,
        transactionDate: todayISOEthiopia(),
        recordedBy: user.uid,
        reversalStatus: 'active',
        createdAt: now,
      });

      if (invoiceId) {
        const inv = invoices.find((i) => i.id === invoiceId);
        if (inv) {
          const newPaid = (inv.amountPaid || 0) + amt;
          const newBal = Math.max(0, (inv.amountDue || 0) - newPaid);
          await updateDoc(doc(db, 'invoices', inv.id), {
            amountPaid: newPaid,
            balance: newBal,
            status: newBal === 0 ? 'paid' : 'partial',
            updatedAt: now,
          });
        }
      }

      await logAuditEvent({
        actorRole: user.role,
        action: 'CREATE_RECEIPT',
        entity: 'payments',
        entityId: ref.id,
        summary: `Issued receipt ${receiptNo} (${amt} ETB, ${method}) for ${st.code}`,
      });
      setPayerName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payments');
    }
  };

  const handleReversePayment = async (payment: Payment) => {
    if (reversalReason.trim().length < 4) return;
    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        reversalStatus: 'reversed',
        reversalReason: reversalReason.trim(),
        reversedBy: user.uid,
        reversedAt: new Date().toISOString(),
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'REVERSE_PAYMENT',
        entity: 'payments',
        entityId: payment.id,
        summary: `Reversed receipt ${payment.receiptNo} (${payment.amountETB} ETB)`,
        reason: reversalReason.trim(),
      });
      setReversingId(null);
      setReversalReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${payment.id}`);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === invStudentId);
    if (!st) return;
    const due = Math.max(0, Number(invAmount) || 0);
    try {
      const invoiceNo = `INV-${todayISOEthiopia().replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
      await addDoc(collection(db, 'invoices'), {
        invoiceNo,
        studentId: st.id,
        studentName: st.fullName,
        studentCode: st.code,
        period: invPeriod,
        amountDue: due,
        amountPaid: 0,
        balance: due,
        status: 'unpaid',
        dueDate: todayISOEthiopia(),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invoices');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'feePlans'), {
        name: planName.trim(),
        track: planTrack,
        amountETB: Math.max(0, Number(planAmount) || 0),
        frequency: planFreq,
        effectiveFrom: todayISOEthiopia(),
        active: true,
      });
      setPlanName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'feePlans');
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily Reconciliation Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <p className="text-xs font-semibold text-[#4A6355]">Net Tuition Collected</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#145A32]">
            {formatETB(reconciliation.total, lang)}
          </p>
        </div>
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <p className="text-xs font-semibold text-[#4A6355]">Channels (Cash / Bank / Mobile)</p>
          <p className="mt-1.5 font-mono-tabular text-xs font-bold text-[#0B3D2E]">
            {reconciliation.cash} / {reconciliation.bank} / {reconciliation.mobile} ETB
          </p>
        </div>
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <p className="text-xs font-semibold text-[#4A6355]">Outstanding Invoice Balance</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-amber-700">
            {formatETB(reconciliation.outstanding, lang)}
          </p>
        </div>
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <p className="text-xs font-semibold text-[#4A6355]">Audited Reversals</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#0E2419]">
            {reconciliation.reversedCount}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {(['payments', 'invoices', 'plans'] as const).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className={`rounded-lg px-4 py-2 text-xs font-bold capitalize ${
              tab === tk
                ? 'bg-[#145A32] text-white'
                : 'border border-[#D6E3DA] bg-white text-[#334E3F]'
            }`}
          >
            {tk === 'payments' ? 'Receipts & Payments' : tk === 'invoices' ? 'Invoices' : 'Fee Plans'}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <div className="space-y-6">
          {canWriteFinance && (
            <form
              onSubmit={handleRecordPayment}
              className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#145A32]" />
                <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
                  {t(lang, 'recordPayment')}
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
                >
                  <option value="">Direct Payment (Optional Invoice)</option>
                  {invoices
                    .filter((i) => i.studentId === studentId && i.status !== 'paid')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNo} ({i.balance} ETB due)
                      </option>
                    ))}
                </select>
                <input
                  placeholder="Payer Name (optional)"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={amountETB}
                  onChange={(e) => setAmountETB(e.target.value)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
                />
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
                >
                  <option value="cash">{t(lang, 'method_cash')}</option>
                  <option value="bank">{t(lang, 'method_bank')}</option>
                  <option value="mobile">{t(lang, 'method_mobile')}</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!studentId}
                className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E]"
              >
                Issue Sequential Receipt
              </button>
            </form>
          )}

          {/* Printable Receipt Preview */}
          {printPayment && (
            <div className="print-container rounded-xl border-2 border-[#C49A45] bg-white p-6">
              <div className="flex items-start justify-between border-b border-[#EAF3ED] pb-3">
                <div className="flex items-center gap-3">
                  <MarkazCrest size={50} />
                  <div>
                    <p className="font-arabic text-xs font-bold text-[#145A32]" dir="rtl">
                      {t(lang, 'brandArabic')}
                    </p>
                    <h4 className="font-display text-base font-bold text-[#0B3D2E]">
                      {t(lang, 'brandMain')} — OFFICIAL RECEIPT
                    </h4>
                    <p className="font-mono-tabular text-xs font-bold text-[#145A32]">
                      {printPayment.receiptNo}
                    </p>
                  </div>
                </div>
                <div className="no-print flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#145A32] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {t(lang, 'print')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintPayment(null)}
                    className="rounded-lg border border-[#D6E3DA] px-3 py-1.5 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-[#4A6355]">Student</dt>
                  <dd className="font-bold">{printPayment.studentName}</dd>
                </div>
                <div>
                  <dt className="text-[#4A6355]">Payer</dt>
                  <dd className="font-semibold">{printPayment.payerName}</dd>
                </div>
                <div>
                  <dt className="text-[#4A6355]">Amount</dt>
                  <dd className="font-mono-tabular text-sm font-bold text-[#145A32]">
                    {formatETB(printPayment.amountETB, lang)} ({printPayment.method})
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Receipts Ledger */}
          <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t(lang, 'receiptNo')}</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">{t(lang, 'paymentMethod')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t(lang, 'amountETB')}</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAF3ED]">
                  {payments.map((p) => (
                    <React.Fragment key={p.id}>
                      <tr>
                        <td className="px-4 py-3 font-mono-tabular font-bold text-[#145A32]">
                          {p.receiptNo}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">{p.transactionDate}</td>
                        <td className="px-4 py-3 font-medium">{p.studentName}</td>
                        <td className="px-4 py-3 uppercase">{p.method}</td>
                        <td className="px-4 py-3 text-right font-mono-tabular font-bold">
                          {p.amountETB.toLocaleString()} ETB
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                              p.reversalStatus === 'active'
                                ? 'bg-[#EAF3ED] text-[#145A32]'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.reversalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setPrintPayment(p)}
                            className="rounded border border-[#D6E3DA] px-2 py-1 text-[11px] font-semibold"
                          >
                            Receipt
                          </button>
                          {canWriteFinance && p.reversalStatus === 'active' && (
                            <button
                              type="button"
                              onClick={() => setReversingId(p.id)}
                              className="rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700"
                            >
                              {t(lang, 'voidReceipt')}
                            </button>
                          )}
                        </td>
                      </tr>
                      {reversingId === p.id && (
                        <tr className="bg-red-50/70">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                placeholder={t(lang, 'reversalReason')}
                                value={reversalReason}
                                onChange={(e) => setReversalReason(e.target.value)}
                                className="min-w-[260px] flex-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleReversePayment(p)}
                                className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Confirm Audited Reversal
                              </button>
                              <button
                                type="button"
                                onClick={() => setReversingId(null)}
                                className="rounded-lg border border-[#D6E3DA] bg-white px-3 py-1.5 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-4">
          {canWriteFinance && (
            <form
              onSubmit={handleCreateInvoice}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-[#D6E3DA] bg-white p-4"
            >
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-semibold">Student</label>
                <select
                  required
                  value={invStudentId}
                  onChange={(e) => setInvStudentId(e.target.value)}
                  className="w-full rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Period (YYYY-MM)</label>
                <input
                  value={invPeriod}
                  onChange={(e) => setInvPeriod(e.target.value)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Amount (ETB)</label>
                <input
                  type="number"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="min-h-[36px] rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white"
              >
                {t(lang, 'createInvoice')}
              </button>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice #</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 text-right font-semibold">Due</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3ED]">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono-tabular font-semibold">{inv.invoiceNo}</td>
                    <td className="px-4 py-3">{inv.studentName}</td>
                    <td className="px-4 py-3 font-mono-tabular">{inv.period}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular">{inv.amountDue} ETB</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-bold">
                      {inv.balance} ETB
                    </td>
                    <td className="px-4 py-3 uppercase">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          {canWriteFinance && (
            <form
              onSubmit={handleCreatePlan}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-[#D6E3DA] bg-white p-4"
            >
              <input
                required
                placeholder="Fee Plan Title"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              />
              <select
                value={planTrack}
                onChange={(e) => setPlanTrack(e.target.value as StudyTrack)}
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              >
                <option value="full_hifz">{t(lang, 'track_full_hifz')}</option>
                <option value="nazirah_tajweed">{t(lang, 'track_nazirah_tajweed')}</option>
              </select>
              <input
                type="number"
                value={planAmount}
                onChange={(e) => setPlanAmount(e.target.value)}
                className="w-28 rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
              />
              <select
                value={planFreq}
                onChange={(e) =>
                  setPlanFreq(e.target.value as 'monthly' | 'term' | 'annual' | 'one_time')
                }
                className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
              >
                <option value="monthly">Monthly</option>
                <option value="term">Term</option>
                <option value="annual">Annual</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-[#145A32] px-4 py-2 text-xs font-bold text-white"
              >
                {t(lang, 'createFeePlan')}
              </button>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {feePlans.map((fp) => (
              <div key={fp.id} className="rounded-xl border border-[#D6E3DA] bg-white p-4 text-xs">
                <p className="font-bold text-[#0B3D2E]">{fp.name}</p>
                <p className="mt-1 font-mono-tabular text-base font-bold text-[#145A32]">
                  {formatETB(fp.amountETB, lang)} / {fp.frequency}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. KAFALAT & SPONSORSHIP MODULE (No Double Allocation)
 * ========================================================================== */
export const KafalatModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  students: Student[];
  sponsors: Sponsor[];
}> = ({ lang, user, students, sponsors }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [commitmentETB, setCommitmentETB] = useState('1500');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [anonymousReporting, setAnonymousReporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManage = ['super_admin', 'director', 'kafalat_officer', 'accountant'].includes(user.role);

  const activeBeneficiaryIds = useMemo(
    () =>
      new Set(
        sponsors.filter((s) => s.status === 'active' && s.beneficiaryStudentId).map((s) => s.beneficiaryStudentId!)
      ),
    [sponsors]
  );

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (beneficiaryId && activeBeneficiaryIds.has(beneficiaryId)) {
      setErrorMsg(t(lang, 'doubleSponsorBlocked'));
      return;
    }
    const beneficiary = students.find((s) => s.id === beneficiaryId);
    try {
      const ref = await addDoc(collection(db, 'sponsors'), {
        fullName: fullName.trim(),
        phone: phone.trim(),
        commitmentETB: Math.max(100, Number(commitmentETB) || 500),
        frequency,
        beneficiaryStudentId: beneficiary?.id || '',
        beneficiaryStudentName: beneficiary?.fullName || '',
        startDate: todayISOEthiopia(),
        monthsPaid: 0,
        status: 'active',
        anonymousReporting,
        createdAt: new Date().toISOString(),
      });
      if (beneficiary) {
        await updateDoc(doc(db, 'students', beneficiary.id), {
          sponsorId: ref.id,
          kafalatEligible: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        });
      }
      await logAuditEvent({
        actorRole: user.role,
        action: 'ADD_KAFALAT_SPONSOR',
        entity: 'sponsors',
        entityId: ref.id,
        summary: `Added Kafalat sponsor ${fullName.trim()} (${commitmentETB} ETB)`,
      });
      setFullName('');
      setPhone('');
      setBeneficiaryId('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sponsors');
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={handleAddSponsor}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <HandHeart className="h-4 w-4 text-[#C49A45]" />
            <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
              {t(lang, 'addSponsor')}
            </h3>
          </div>
          {errorMsg && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              required
              placeholder="Sponsor Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <input
              placeholder="Phone"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <input
              type="number"
              required
              min={100}
              value={commitmentETB}
              onChange={(e) => setCommitmentETB(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'quarterly' | 'annual')}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
            <select
              value={beneficiaryId}
              onChange={(e) => setBeneficiaryId(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs sm:col-span-2"
            >
              <option value="">Unallocated (General Kafalat Pool)</option>
              {students
                .filter((s) => s.status === 'active')
                .map((s) => {
                  const alreadySponsored = activeBeneficiaryIds.has(s.id);
                  return (
                    <option key={s.id} value={s.id} disabled={alreadySponsored}>
                      {s.code} — {s.fullName} {alreadySponsored ? '[Already Sponsored]' : ''}
                    </option>
                  );
                })}
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={anonymousReporting}
                onChange={(e) => setAnonymousReporting(e.target.checked)}
                className="accent-[#145A32]"
              />
              <span>Anonymous public reporting</span>
            </label>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B3D2E]"
          >
            {t(lang, 'save')}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Sponsor</th>
              <th className="px-4 py-3 font-semibold">Beneficiary Student</th>
              <th className="px-4 py-3 text-right font-semibold">Commitment</th>
              <th className="px-4 py-3 font-semibold">Frequency</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAF3ED]">
            {sponsors.map((sp) => (
              <tr key={sp.id}>
                <td className="px-4 py-3 font-semibold">
                  {sp.anonymousReporting ? 'Anonymous Sponsor' : sp.fullName}
                </td>
                <td className="px-4 py-3 text-[#4A6355]">
                  {sp.beneficiaryStudentName || 'Unallocated Pool'}
                </td>
                <td className="px-4 py-3 text-right font-mono-tabular font-bold text-[#145A32]">
                  {formatETB(sp.commitmentETB, lang)}
                </td>
                <td className="px-4 py-3 capitalize">{sp.frequency}</td>
                <td className="px-4 py-3 uppercase">{sp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. DONATIONS & FUNDRAISING MODULE (Separate Pledge vs Received Cash)
 * ========================================================================== */
export const DonationsModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  campaigns: Campaign[];
  pledges: Pledge[];
  donations: Donation[];
}> = ({ lang, user, campaigns, pledges, donations }) => {
  const [donorName, setDonorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || 'camp-ramadan-kafalat');
  const [amountETB, setAmountETB] = useState('5000');
  const [method, setMethod] = useState<PaymentMethod>('bank');

  const canManage = ['super_admin', 'director', 'accountant', 'kafalat_officer'].includes(user.role);

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const camp = campaigns.find((c) => c.id === campaignId);
    const amt = Math.max(1, Number(amountETB) || 0);
    try {
      const receiptNo = `DON-${todayISOEthiopia().replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const ref = await addDoc(collection(db, 'donations'), {
        donorName: isAnonymous ? 'Anonymous Donor' : donorName.trim(),
        isAnonymous,
        campaignId: camp?.id || campaignId,
        campaignTitle: camp?.title || 'General Endowment',
        amountETB: amt,
        method,
        receiptNo,
        receivedAt: todayISOEthiopia(),
        recordedBy: user.uid,
      });
      if (camp) {
        await updateDoc(doc(db, 'campaigns', camp.id), {
          raisedETB: increment(amt),
        });
      }
      await logAuditEvent({
        actorRole: user.role,
        action: 'RECORD_DONATION',
        entity: 'donations',
        entityId: ref.id,
        summary: `Recorded received donation ${receiptNo} (${amt} ETB)`,
      });
      setDonorName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'donations');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#C49A45]/50 bg-[#FBF8EE] p-4 text-xs text-[#7A5915]">
        {t(lang, 'pledgeNotice')}
      </div>

      {/* Campaigns Progress */}
      <div className="grid gap-4 sm:grid-cols-2">
        {campaigns.map((c) => {
          const pct = c.targetETB > 0 ? Math.min(100, Math.round((c.raisedETB / c.targetETB) * 100)) : 0;
          return (
            <div key={c.id} className="rounded-xl border border-[#D6E3DA] bg-white p-5">
              <h4 className="font-display text-sm font-bold text-[#0B3D2E]">{c.title}</h4>
              <p className="mt-1 text-xs text-[#4A6355]">{c.description}</p>
              <div className="mt-3 flex justify-between text-xs font-mono-tabular">
                <span className="font-bold text-[#145A32]">
                  Raised: {formatETB(c.raisedETB, lang)}
                </span>
                <span className="text-[#4A6355]">Target: {formatETB(c.targetETB, lang)}</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#EAF3ED]">
                <div className="h-full bg-[#145A32]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {canManage && (
        <form
          onSubmit={handleRecordDonation}
          className="rounded-xl border border-[#D6E3DA] bg-white p-5 space-y-4"
        >
          <h3 className="font-display text-sm font-bold text-[#0B3D2E]">
            {t(lang, 'recordDonation')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              required={!isAnonymous}
              disabled={isAnonymous}
              placeholder="Donor Full Name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            />
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              required
              value={amountETB}
              onChange={(e) => setAmountETB(e.target.value)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs tabular-nums"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="rounded-lg border border-[#D6E3DA] px-3 py-2 text-xs"
            >
              <option value="cash">{t(lang, 'method_cash')}</option>
              <option value="bank">{t(lang, 'method_bank')}</option>
              <option value="mobile">{t(lang, 'method_mobile')}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="accent-[#145A32]"
              />
              <span>Anonymous Donor</span>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
            >
              {t(lang, 'recordDonation')}
            </button>
          </div>
        </form>
      )}

      {/* Separate Pledges vs Received Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <h4 className="mb-3 font-display text-sm font-bold text-[#0B3D2E]">
            Unfulfilled Pledges ({pledges.length})
          </h4>
          <div className="divide-y divide-[#EAF3ED] text-xs">
            {pledges.map((pl) => (
              <div key={pl.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">{pl.donorName}</p>
                  <p className="text-[#4A6355]">{pl.tier}</p>
                </div>
                <div className="text-right font-mono-tabular">
                  <p className="font-bold text-[#7A5915]">{formatETB(pl.amountETB, lang)}</p>
                  <p className="text-[10px] uppercase">{pl.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#D6E3DA] bg-white p-4">
          <h4 className="mb-3 font-display text-sm font-bold text-[#0B3D2E]">
            Actual Received Donations ({donations.length})
          </h4>
          <div className="divide-y divide-[#EAF3ED] text-xs">
            {donations.map((dn) => (
              <div key={dn.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">{dn.donorName}</p>
                  <p className="font-mono-tabular text-[11px] text-[#4A6355]">
                    {dn.receiptNo} • {dn.receivedAt}
                  </p>
                </div>
                <p className="font-mono-tabular font-bold text-[#145A32]">
                  {formatETB(dn.amountETB, lang)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. ADMISSIONS QUEUE MODULE (Review & Convert to Student)
 * ========================================================================== */
export const AdmissionsModule: React.FC<{
  lang: MarkazLanguage;
  user: UserProfile;
  admissions: AdmissionApplication[];
  halaqahs: Halaqah[];
}> = ({ lang, user, admissions, halaqahs }) => {
  const canReview = ['super_admin', 'director', 'registrar'].includes(user.role);

  const updateStatus = async (
    adm: AdmissionApplication,
    status: AdmissionApplication['status']
  ) => {
    try {
      await updateDoc(doc(db, 'admissions', adm.id), {
        status,
        reviewedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'REVIEW_ADMISSION',
        entity: 'admissions',
        entityId: adm.id,
        summary: `Updated admission ${adm.referenceNo} to ${status}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admissions/${adm.id}`);
    }
  };

  const convertToStudent = async (adm: AdmissionApplication) => {
    try {
      const code = await getNextSequentialCode('students', 'AFQ');
      const now = new Date().toISOString();
      const firstHalaqah = halaqahs[0];
      const studentRef = await addDoc(collection(db, 'students'), {
        code,
        fullName: adm.fullName,
        dob: adm.dob || '',
        age: adm.age,
        gender: adm.gender,
        guardianIds: [],
        guardianName: adm.guardianName,
        guardianPhone: adm.guardianPhone,
        address: adm.address || '',
        track: adm.track,
        currentSurah: 'Al-Fatihah',
        juzLevel: adm.priorHifzJuz || 0,
        halaqahId: firstHalaqah?.id || '',
        halaqahGroup: firstHalaqah?.name || '',
        status: 'active',
        kafalatEligible: false,
        enrollmentDate: todayISOEthiopia(),
        admissionSource: adm.referenceNo,
        institutionId: user.institutionId,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      });
      await updateDoc(doc(db, 'admissions', adm.id), {
        status: 'enrolled',
        linkedStudentId: studentRef.id,
        reviewedBy: user.uid,
        updatedAt: now,
      });
      await logAuditEvent({
        actorRole: user.role,
        action: 'ENROLL_ADMISSION',
        entity: 'admissions',
        entityId: adm.id,
        summary: `Converted admission ${adm.referenceNo} to student ${code}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admissions/${adm.id}`);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#D6E3DA] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D6E3DA] bg-[#F3F7F4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">{t(lang, 'fullName')}</th>
              <th className="px-4 py-3 font-semibold">{t(lang, 'guardianName')}</th>
              <th className="px-4 py-3 font-semibold">{t(lang, 'track')}</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAF3ED]">
            {admissions.map((adm) => (
              <tr key={adm.id}>
                <td className="px-4 py-3 font-mono-tabular font-bold text-[#145A32]">
                  {adm.referenceNo}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {adm.fullName} ({adm.age}y)
                </td>
                <td className="px-4 py-3">
                  {adm.guardianName} •{' '}
                  <span className="font-mono-tabular" dir="ltr">
                    {adm.guardianPhone}
                  </span>
                </td>
                <td className="px-4 py-3">{t(lang, `track_${adm.track}`)}</td>
                <td className="px-4 py-3 uppercase font-semibold">{adm.status}</td>
                <td className="px-4 py-3 text-right space-x-1.5">
                  {canReview && adm.status !== 'enrolled' && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateStatus(adm, 'accepted')}
                        className="rounded border border-[#145A32]/40 bg-[#EAF3ED] px-2 py-1 text-[11px] font-semibold text-[#145A32]"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(adm, 'waitlisted')}
                        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800"
                      >
                        Waitlist
                      </button>
                      <button
                        type="button"
                        onClick={() => convertToStudent(adm)}
                        className="rounded bg-[#C49A45] px-2.5 py-1 text-[11px] font-bold text-[#0B3D2E]"
                      >
                        {t(lang, 'convertToStudent')}
                      </button>
                    </>
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
