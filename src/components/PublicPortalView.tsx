import React, { useState } from 'react';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import {
  Award,
  CheckCircle2,
  FileCheck2,
  Globe,
  HandHeart,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { generatePublicAdmissionRef } from '../lib/markazDb.ts';
import { t } from '../shared/i18n.ts';
import { formatETB, todayISOEthiopia } from '../shared/quranData.ts';
import {
  MarkazLanguage,
  PublicCertificateSummary,
  StudyTrack,
} from '../shared/types.ts';
import { MarkazCrest, PWAInstallButton } from './PwaControls.tsx';

interface PublicPortalViewProps {
  lang: MarkazLanguage;
  onChangeLang: (lang: MarkazLanguage) => void;
  onSignInGoogle: () => Promise<void>;
  signingIn: boolean;
  authError: string | null;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({
  lang,
  onChangeLang,
  onSignInGoogle,
  signingIn,
  authError,
}) => {
  const [activeTab, setActiveTab] = useState<'admission' | 'pledge' | 'verify'>('admission');

  // Admission state
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('12');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [phone, setPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('Chiro, West Hararghe');
  const [track, setTrack] = useState<StudyTrack>('full_hifz');
  const [priorHifzJuz, setPriorHifzJuz] = useState('0');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [admissionSubmitting, setAdmissionSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [admissionErr, setAdmissionErr] = useState<string | null>(null);

  // Public Pledge state
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState('2500');
  const [pledgeTier, setPledgeTier] = useState('Monthly Kafalat Support');
  const [pledgeSubmitted, setPledgeSubmitted] = useState<string | null>(null);
  const [pledgeSubmitting, setPledgeSubmitting] = useState(false);

  // Public QR Certificate verification
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<PublicCertificateSummary | 'not_found' | null>(
    null
  );

  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmissionErr(null);
    if (!consentAccepted) {
      setAdmissionErr(t(lang, 'consentText'));
      return;
    }
    setAdmissionSubmitting(true);
    try {
      const referenceNo = generatePublicAdmissionRef();
      await addDoc(collection(db, 'admissions'), {
        referenceNo,
        fullName: fullName.trim(),
        dob,
        age: Number(age) || 10,
        gender,
        phone: phone.trim() || guardianPhone.trim(),
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        address: address.trim(),
        track,
        priorHifzJuz: Math.min(30, Math.max(0, Number(priorHifzJuz) || 0)),
        consentAccepted: true,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      });
      setSubmittedRef(referenceNo);
      setFullName('');
      setPhone('');
      setGuardianName('');
      setGuardianPhone('');
      setConsentAccepted(false);
    } catch (err) {
      setAdmissionErr(err instanceof Error ? err.message : 'Submission error');
    } finally {
      setAdmissionSubmitting(false);
    }
  };

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPledgeSubmitting(true);
    try {
      await addDoc(collection(db, 'pledges'), {
        donorName: donorName.trim(),
        donorPhone: donorPhone.trim(),
        campaignId: 'camp-ramadan-kafalat',
        campaignTitle: 'Al-Furqaan Orphan & Hifz Kafalat Endowment',
        amountETB: Math.max(100, Number(pledgeAmount) || 500),
        tier: pledgeTier,
        status: 'pledged',
        pledgedAt: todayISOEthiopia(),
      });
      setPledgeSubmitted(`${donorName.trim()} (${formatETB(Number(pledgeAmount) || 500, lang)})`);
      setDonorName('');
      setDonorPhone('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pledges');
    } finally {
      setPledgeSubmitting(false);
    }
  };

  const handleVerifyCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = verifyToken.trim().toUpperCase();
    if (cleaned.length < 12) {
      setVerifyResult('not_found');
      return;
    }
    setVerifyLoading(true);
    try {
      const snap = await getDoc(doc(db, 'publicCertificates', cleaned));
      if (!snap.exists()) {
        setVerifyResult('not_found');
      } else {
        setVerifyResult(snap.data() as PublicCertificateSummary);
      }
    } catch {
      setVerifyResult('not_found');
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F7F4] text-[#0E2419]">
      {/* Top Institutional Banner */}
      <header className="islamic-lattice-bg border-b border-[#C49A45]/40 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <MarkazCrest size={48} className="shrink-0 shadow-sm" />
            <div>
              <p className="font-arabic text-base font-bold text-[#E6C573] sm:text-lg" dir="rtl">
                {t(lang, 'brandArabic')}
              </p>
              <h1 className="font-display text-sm font-bold tracking-tight text-white sm:text-base">
                {t(lang, 'brandMain')}
              </h1>
              <p className="text-xs text-[#C7DDD0]">{t(lang, 'brandLocation')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Language Switcher */}
            <div className="inline-flex items-center rounded-lg border border-white/20 bg-[#0B3D2E]/80 p-1">
              <Globe className="mx-1.5 h-3.5 w-3.5 text-[#E6C573]" />
              {(['om', 'ar', 'en'] as MarkazLanguage[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChangeLang(code)}
                  className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold transition whitespace-nowrap ${
                    lang === code
                      ? 'bg-[#C49A45] text-[#0B3D2E]'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  {code === 'om' ? 'Oromoo' : code === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>

            <PWAInstallButton lang={lang} />

            <button
              type="button"
              disabled={signingIn}
              onClick={onSignInGoogle}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#C49A45] px-4 py-2 text-xs font-bold text-[#0B3D2E] shadow-sm transition hover:bg-[#D4AE5E] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4" />
              <span>{signingIn ? t(lang, 'loading') : t(lang, 'signInGoogle')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {authError && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {authError}
          </div>
        )}

        {/* Hadith & Hero Summary Strip */}
        <section className="mb-8 grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#D6E3DA] bg-white p-6 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF3ED] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#145A32]">
                  {t(lang, 'brandTagline')}
                </p>
                <h2 className="font-display mt-1 text-xl font-bold text-[#0B3D2E] sm:text-2xl">
                  {t(lang, 'publicPortal')}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#C49A45]/40 bg-[#F7F0DF] px-3 py-1.5 text-xs font-semibold text-[#7A5915]">
                <ShieldCheck className="h-4 w-4" />
                Firebase Auth + RBAC
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-[#145A32]">{t(lang, 'hadithQuote')}</p>

            {/* Portal Mode Tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('admission')}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'admission'
                    ? 'border-[#145A32] bg-[#145A32] text-white'
                    : 'border-[#D6E3DA] bg-[#F3F7F4] text-[#0E2419] hover:border-[#145A32]/50'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>{t(lang, 'publicAdmissionTitle')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pledge')}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'pledge'
                    ? 'border-[#145A32] bg-[#145A32] text-white'
                    : 'border-[#D6E3DA] bg-[#F3F7F4] text-[#0E2419] hover:border-[#145A32]/50'
                }`}
              >
                <HandHeart className="h-4 w-4" />
                <span>{t(lang, 'submitPledge')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('verify')}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'verify'
                    ? 'border-[#145A32] bg-[#145A32] text-white'
                    : 'border-[#D6E3DA] bg-[#F3F7F4] text-[#0E2419] hover:border-[#145A32]/50'
                }`}
              >
                <FileCheck2 className="h-4 w-4" />
                <span>{t(lang, 'verifyCertificateTitle')}</span>
              </button>
            </div>
          </div>

          {/* Staff / Guardian Sign-In Card */}
          <aside className="flex flex-col justify-between rounded-2xl border border-[#C49A45]/45 bg-[#0B3D2E] p-6 text-white lg:col-span-4">
            <div>
              <div className="flex items-center gap-2 text-[#E6C573]">
                <Award className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {t(lang, 'staffPortal')}
                </span>
              </div>
              <h3 className="font-display mt-2 text-lg font-bold">
                Mu’allim, Registrar, Accountant & Guardian Access
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#CFE2D7]">
                Sign in with your verified Google account. Access is governed strictly by your
                Markaz role, assigned Halaqah, or verified guardian link.
              </p>
            </div>

            <button
              type="button"
              disabled={signingIn}
              onClick={onSignInGoogle}
              className="mt-6 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#C49A45] px-4 py-2.5 text-sm font-bold text-[#0B3D2E] transition hover:bg-[#D9B462]"
            >
              <LogIn className="h-4 w-4" />
              <span>{t(lang, 'signInGoogle')}</span>
            </button>
          </aside>
        </section>

        {/* Active Public Panel */}
        {activeTab === 'admission' && (
          <section className="rounded-2xl border border-[#D6E3DA] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-[#EAF3ED] pb-4">
              <MarkazCrest size={52} />
              <div>
                <p className="font-arabic text-sm font-bold text-[#145A32]" dir="rtl">
                  {t(lang, 'brandArabic')}
                </p>
                <h3 className="font-display text-lg font-bold text-[#0B3D2E]">
                  {t(lang, 'publicAdmissionTitle')}
                </h3>
                <p className="text-xs text-[#4A6355]">{t(lang, 'brandLocation')}</p>
              </div>
            </div>
            {submittedRef && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#145A32]/30 bg-[#EAF3ED] p-4 text-sm text-[#0B3D2E]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#145A32]" />
                <div>
                  <p className="font-bold">Application Submitted Successfully</p>
                  <p className="mt-1 font-mono-tabular text-xs">
                    Reference: <span className="font-bold">{submittedRef}</span>
                  </p>
                </div>
              </div>
            )}
            {admissionErr && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {admissionErr}
              </div>
            )}
            <form onSubmit={handleAdmissionSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'fullName')} *
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'dob')}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'age')} *
                </label>
                <input
                  type="number"
                  min={4}
                  max={70}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'gender')} *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                >
                  <option value="male">{t(lang, 'male')}</option>
                  <option value="female">{t(lang, 'female')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'guardianName')} *
                </label>
                <input
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'guardianPhone')} *
                </label>
                <input
                  required
                  dir="ltr"
                  placeholder="+251 9..."
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'track')} *
                </label>
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value as StudyTrack)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                >
                  <option value="full_hifz">{t(lang, 'track_full_hifz')}</option>
                  <option value="part_time_hifz">{t(lang, 'track_part_time_hifz')}</option>
                  <option value="nazirah_tajweed">{t(lang, 'track_nazirah_tajweed')}</option>
                  <option value="islamic_studies">{t(lang, 'track_islamic_studies')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'juzLevel')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={priorHifzJuz}
                  onChange={(e) => setPriorHifzJuz(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'address')}
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] p-3.5 text-xs text-[#2B4637]">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#145A32]"
                  />
                  <span>{t(lang, 'consentText')}</span>
                </label>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={admissionSubmitting}
                  className="min-h-[46px] rounded-xl bg-[#145A32] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B3D2E] disabled:opacity-60"
                >
                  {admissionSubmitting ? t(lang, 'loading') : t(lang, 'submitApplication')}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'pledge' && (
          <section className="rounded-2xl border border-[#D6E3DA] bg-white p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-[#0B3D2E]">
              {t(lang, 'submitPledge')}
            </h3>
            <p className="mt-1 text-xs text-[#4A6355]">{t(lang, 'pledgeNotice')}</p>
            {pledgeSubmitted && (
              <div className="mt-4 rounded-xl border border-[#145A32]/30 bg-[#EAF3ED] p-4 text-sm text-[#0B3D2E]">
                Jazakumullahu Khayran! Pledge logged for <span className="font-bold">{pledgeSubmitted}</span>.
              </div>
            )}
            <form onSubmit={handlePledgeSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'fullName')} *
                </label>
                <input
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  Phone
                </label>
                <input
                  dir="ltr"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  {t(lang, 'amountETB')} *
                </label>
                <input
                  type="number"
                  min={100}
                  required
                  value={pledgeAmount}
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#145A32]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#334E3F]">
                  Sponsorship / Waqf Tier
                </label>
                <select
                  value={pledgeTier}
                  onChange={(e) => setPledgeTier(e.target.value)}
                  className="w-full rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-3.5 py-2.5 text-sm outline-none focus:border-[#145A32]"
                >
                  <option>Monthly Kafalat Support</option>
                  <option>Mushaf & Learning Kit</option>
                  <option>Markaz Building Waqf</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={pledgeSubmitting}
                  className="min-h-[46px] rounded-xl bg-[#C49A45] px-6 py-2.5 text-sm font-bold text-[#0B3D2E] transition hover:bg-[#D5AE5C]"
                >
                  {pledgeSubmitting ? t(lang, 'loading') : t(lang, 'submitPledge')}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'verify' && (
          <section className="rounded-2xl border border-[#D6E3DA] bg-white p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-[#0B3D2E]">
              {t(lang, 'verifyCertificateTitle')}
            </h3>
            <form onSubmit={handleVerifyCertificate} className="mt-4 flex flex-wrap gap-3">
              <input
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder={t(lang, 'verifyTokenPlaceholder')}
                dir="ltr"
                className="min-w-[260px] flex-1 rounded-xl border border-[#D6E3DA] bg-[#F9FBF9] px-4 py-2.5 font-mono-tabular text-sm uppercase outline-none focus:border-[#145A32]"
              />
              <button
                type="submit"
                disabled={verifyLoading}
                className="min-h-[44px] rounded-xl bg-[#145A32] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0B3D2E]"
              >
                {verifyLoading ? t(lang, 'loading') : t(lang, 'verifyBtn')}
              </button>
            </form>

            {verifyResult === 'not_found' && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                No matching certificate record found for this verification token.
              </div>
            )}

            {verifyResult && verifyResult !== 'not_found' && (
              <div className="mt-6 rounded-xl border border-[#C49A45]/60 bg-[#FBF9F2] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DEC3] pb-3">
                  <span className="font-mono-tabular text-sm font-bold text-[#0B3D2E]">
                    {verifyResult.certificateNo}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                      verifyResult.status === 'active'
                        ? 'bg-[#EAF3ED] text-[#145A32]'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {verifyResult.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[#4A6355]">Graduate Initials</dt>
                    <dd className="mt-0.5 font-bold text-[#0E2419]">
                      {verifyResult.studentInitials}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A6355]">{t(lang, 'track')}</dt>
                    <dd className="mt-0.5 font-bold text-[#0E2419]">
                      {t(lang, `track_${verifyResult.track}`)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A6355]">Batch</dt>
                    <dd className="mt-0.5 font-mono-tabular font-bold text-[#0E2419]">
                      {verifyResult.graduationBatch}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A6355]">Issued Date</dt>
                    <dd className="mt-0.5 font-mono-tabular font-bold text-[#0E2419]">
                      {verifyResult.issuedAt.slice(0, 10)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
