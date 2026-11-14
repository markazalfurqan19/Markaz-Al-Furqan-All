import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  DocumentData,
  FirestoreError,
  onSnapshot,
  orderBy,
  Query,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  where,
} from 'firebase/firestore';
import {
  Award,
  Bell,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Coins,
  Globe,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AttendanceModule,
  ExamsModule,
  HalaqahsModule,
  HifzModule,
  StudentsModule,
} from './components/AcademicModules.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import {
  AdmissionsModule,
  DonationsModule,
  FinanceModule,
  KafalatModule,
} from './components/FinanceAndCareModules.tsx';
import {
  CertificatesModule,
  GuardianPortalModule,
  LibraryModule,
  NotificationsModule,
  ReportsAndAiModule,
  SettingsAndAuditModule,
  StaffModule,
} from './components/OperationsAndGovernanceModules.tsx';
import { PublicPortalView } from './components/PublicPortalView.tsx';
import { MarkazCrest, OfflineIndicator, PWAInstallButton } from './components/PwaControls.tsx';
import {
  db,
  firebaseAuth,
  signInWithGooglePopup,
  signOutFirebase,
  testFirestoreConnection,
} from './lib/firebase.ts';
import {
  DEFAULT_INSTITUTION_SETTINGS,
  ensureUserProfile,
  updateUserLanguagePreference,
} from './lib/markazDb.ts';
import { t } from './shared/i18n.ts';
import { formatHijriSupplemental, todayISOEthiopia } from './shared/quranData.ts';
import {
  AdmissionApplication,
  AttendanceRecord,
  AuditLog,
  Book,
  BookLoan,
  Campaign,
  Certificate,
  Donation,
  ExamRecord,
  FeePlan,
  Halaqah,
  HifzLog,
  InstitutionSettings,
  Invoice,
  MarkazLanguage,
  NavSectionId,
  NotificationRecord,
  Payment,
  Pledge,
  ROLE_NAV_ACCESS,
  Sponsor,
  StaffMember,
  Student,
  UserProfile,
} from './shared/types.ts';

class MarkazErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Markaz UI ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F3F7F4] p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center">
            <MarkazCrest size={56} className="mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-[#0B3D2E]">
              Application Recovery Notice
            </h2>
            <p className="mt-2 break-words text-xs text-red-700">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#145A32] px-5 py-2 text-xs font-bold text-white"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ICONS: Record<NavSectionId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  students: Users,
  halaqahs: BookOpen,
  hifz: BookOpen,
  attendance: CalendarCheck,
  exams: ClipboardCheck,
  staff: UserCheck,
  finance: Coins,
  kafalat: HandHeart,
  donations: HandHeart,
  admissions: UserPlus,
  guardian_portal: Users,
  library: BookMarked,
  certificates: Award,
  notifications: Bell,
  reports_ai: Sparkles,
  settings_audit: Settings,
  public_portal: Globe,
};

function MarkazWorkspace() {
  const [lang, setLang] = useState<MarkazLanguage>(() => {
    const saved = localStorage.getItem('alfurqaan_lang');
    return saved === 'ar' || saved === 'en' || saved === 'om' ? saved : 'om';
  });
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavSectionId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore synced collections
  const [settings, setSettings] = useState<InstitutionSettings>(DEFAULT_INSTITUTION_SETTINGS);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [hifzLogs, setHifzLogs] = useState<HifzLog[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookLoans, setBookLoans] = useState<BookLoan[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Apply HTML direction & language attribute cleanly
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('alfurqaan_lang', lang);
  }, [lang]);

  // Boot Firestore connection probe & auth listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!fbUser) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setUserProfile(profile);
        if (profile.preferredLanguage) {
          setLang(profile.preferredLanguage);
        }
        const allowed = ROLE_NAV_ACCESS[profile.role] || ['dashboard'];
        setActiveNav(allowed[0]);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Failed to load user profile');
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Live role-scoped Firestore subscriptions
  useEffect(() => {
    if (!userProfile) return;
    const role = userProfile.role;
    const unsubs: Array<() => void> = [];

    const safeSub = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      qOverride?: Query<DocumentData>
    ) => {
      const ref = qOverride || collection(db, colName);
      unsubs.push(
        onSnapshot(
          ref,
          (snap: QuerySnapshot<DocumentData>) => {
            setter(snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }) as T));
          },
          (err: FirestoreError) => {
            console.warn(`Snapshot permission/sync notice on ${colName}:`, err.message);
          }
        )
      );
    };

    // Institution settings & user's own doc
    unsubs.push(
      onSnapshot(doc(db, 'settings', 'institution'), (snap) => {
        if (snap.exists()) setSettings(snap.data() as InstitutionSettings);
      })
    );
    unsubs.push(
      onSnapshot(doc(db, 'users', userProfile.uid), (snap) => {
        if (snap.exists()) setUserProfile(snap.data() as UserProfile);
      })
    );

    const isMgmt = ['super_admin', 'director', 'auditor'].includes(role);
    const isStaff = role !== 'guardian';

    if (isMgmt || role === 'registrar') {
      safeSub('users', setAllUsers);
    }
    if (isMgmt || ['registrar', 'examiner', 'accountant', 'kafalat_officer', 'librarian'].includes(role)) {
      safeSub('students', setStudents);
    } else if (role === 'muallim' && userProfile.assignedHalaqahIds?.length) {
      safeSub(
        'students',
        setStudents,
        query(collection(db, 'students'), where('halaqahId', 'in', userProfile.assignedHalaqahIds.slice(0, 10)))
      );
    } else if (role === 'guardian' && userProfile.linkedStudentIds?.length) {
      userProfile.linkedStudentIds.slice(0, 10).forEach((sid) => {
        unsubs.push(
          onSnapshot(doc(db, 'students', sid), (snap) => {
            if (snap.exists()) {
              setStudents((prev) => {
                const next = prev.filter((p) => p.id !== sid);
                return [...next, { id: snap.id, ...snap.data() } as Student];
              });
            }
          })
        );
      });
    }

    safeSub('halaqahs', setHalaqahs);
    safeSub('feePlans', setFeePlans);
    safeSub('books', setBooks);
    safeSub('notifications', setNotifications);
    safeSub('campaigns', setCampaigns);

    if (isStaff) {
      safeSub('staff', setStaff);
    }

    if (isMgmt || ['registrar', 'examiner'].includes(role)) {
      safeSub('attendance', setAttendance);
      safeSub('hifzLogs', setHifzLogs);
      safeSub('exams', setExams);
    } else if (role === 'muallim' && userProfile.assignedHalaqahIds?.length) {
      safeSub(
        'attendance',
        setAttendance,
        query(collection(db, 'attendance'), where('halaqahId', 'in', userProfile.assignedHalaqahIds.slice(0, 10)))
      );
      safeSub(
        'hifzLogs',
        setHifzLogs,
        query(collection(db, 'hifzLogs'), where('halaqahId', 'in', userProfile.assignedHalaqahIds.slice(0, 10)))
      );
    }

    if (isMgmt || ['accountant', 'registrar'].includes(role)) {
      safeSub('invoices', setInvoices);
    }
    if (isMgmt || role === 'accountant') {
      safeSub('payments', setPayments);
      safeSub('pledges', setPledges);
      safeSub('donations', setDonations);
    }
    if (isMgmt || ['kafalat_officer', 'accountant'].includes(role)) {
      safeSub('sponsors', setSponsors);
    }
    if (isMgmt || role === 'registrar') {
      safeSub('admissions', setAdmissions);
      safeSub('certificates', setCertificates);
    }
    if (isMgmt || ['librarian', 'registrar'].includes(role)) {
      safeSub('bookLoans', setBookLoans);
    }
    if (isMgmt) {
      safeSub('auditLogs', setAuditLogs, query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')));
    }

    return () => unsubs.forEach((fn) => fn());
  }, [userProfile?.uid, userProfile?.role]);

  const handleLanguageChange = (newLang: MarkazLanguage) => {
    setLang(newLang);
    if (userProfile) {
      void updateUserLanguagePreference(userProfile.uid, newLang);
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setSigningIn(false);
    }
  };

  const allowedNavs = useMemo(
    () => (userProfile ? ROLE_NAV_ACCESS[userProfile.role] || ['dashboard'] : []),
    [userProfile]
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F7F4] text-[#0B3D2E]">
        <MarkazCrest size={64} className="mb-3" />
        <p className="text-sm font-semibold">{t(lang, 'loading')}</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <>
        <OfflineIndicator lang={lang} />
        <PublicPortalView
          lang={lang}
          onChangeLang={handleLanguageChange}
          onSignInGoogle={handleGoogleSignIn}
          signingIn={signingIn}
          authError={authError}
        />
      </>
    );
  }

  const hijriToday = settings.hijriDisplayEnabled
    ? formatHijriSupplemental(todayISOEthiopia(), lang)
    : '';

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F7F4] text-[#0E2419]">
      <OfflineIndicator lang={lang} />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-[#1F4E37] bg-[#0B3D2E] text-white lg:flex">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
            <MarkazCrest size={42} />
            <div className="min-w-0">
              <p className="font-arabic truncate text-xs font-bold text-[#E6C573]" dir="rtl">
                {t(lang, 'brandArabic')}
              </p>
              <h1 className="font-display truncate text-xs font-bold text-white">
                AL-FURQAAN MARKAZ
              </h1>
              <p className="truncate text-[10px] text-[#C7DDD0]">Chiro • Oromia</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {allowedNavs.map((id) => {
              const Icon = NAV_ICONS[id] || LayoutDashboard;
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveNav(id)}
                  className={`flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-semibold transition ${
                    active
                      ? 'bg-[#145A32] text-[#F8E7BA] ring-1 ring-[#C49A45]/50'
                      : 'text-[#DCEBE1] hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(lang, `nav_${id}`)}</span>
                </button>
              );
            })}
          </nav>

          {/* Profile Card */}
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2.5 rounded-lg bg-white/5 p-2.5">
              <MarkazCrest size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{userProfile.displayName}</p>
                <p className="truncate text-[10px] text-[#E6C573]">
                  {t(lang, `role_${userProfile.role}`)}
                </p>
              </div>
              <button
                type="button"
                title={t(lang, 'signOut')}
                onClick={() => signOutFirebase()}
                className="rounded-lg p-1.5 text-[#DCEBE1] hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative z-10 flex w-72 flex-col bg-[#0B3D2E] text-white">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-2.5">
                  <MarkazCrest size={36} />
                  <span className="font-display text-xs font-bold">AL-FURQAAN MARKAZ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {allowedNavs.map((id) => {
                  const Icon = NAV_ICONS[id] || LayoutDashboard;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveNav(id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                        activeNav === id ? 'bg-[#145A32] text-[#F8E7BA]' : 'text-[#DCEBE1]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{t(lang, `nav_${id}`)}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 3-Zone Top Bar */}
          <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#D6E3DA] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#D6E3DA] text-[#0B3D2E] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <MarkazCrest size={32} className="lg:hidden" />
              <div>
                <div className="flex items-center gap-2 text-xs text-[#4A6355]">
                  <span className="font-semibold text-[#145A32]">Al-Furqaan</span>
                  <span>/</span>
                  <span className="font-bold text-[#0B3D2E]">{t(lang, `nav_${activeNav}`)}</span>
                </div>
                <p className="font-mono-tabular text-[11px] text-[#4A6355]">
                  {todayISOEthiopia()} {hijriToday ? `• ${hijriToday}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-[#D6E3DA] bg-[#F3F7F4] p-0.5">
                {(['om', 'ar', 'en'] as MarkazLanguage[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleLanguageChange(code)}
                    className={`min-h-[30px] rounded-md px-2 text-[11px] font-bold transition ${
                      lang === code
                        ? 'bg-[#145A32] text-white'
                        : 'text-[#334E3F] hover:text-[#0B3D2E]'
                    }`}
                  >
                    {code === 'om' ? 'OM' : code === 'ar' ? 'AR' : 'EN'}
                  </button>
                ))}
              </div>
              <PWAInstallButton lang={lang} />
              <div className="hidden items-center gap-2 rounded-lg border border-[#D6E3DA] bg-[#F9FBF9] px-2.5 py-1 sm:flex">
                <MarkazCrest size={24} />
                <span className="max-w-[140px] truncate text-xs font-semibold text-[#0B3D2E]">
                  {userProfile.displayName}
                </span>
              </div>
            </div>
          </header>

          {/* Module Content */}
          <main className="flex-1 p-4 pb-24 sm:p-6 lg:pb-8">
            {activeNav === 'dashboard' && (
              <DashboardView
                lang={lang}
                user={userProfile}
                students={students}
                halaqahs={halaqahs}
                attendance={attendance}
                hifzLogs={hifzLogs}
                exams={exams}
                payments={payments}
                sponsors={sponsors}
                campaigns={campaigns}
                pledges={pledges}
                donations={donations}
                admissions={admissions}
                staff={staff}
                onNavigate={setActiveNav}
              />
            )}

            {activeNav === 'students' && (
              <StudentsModule
                lang={lang}
                user={userProfile}
                students={students}
                halaqahs={halaqahs}
                hifzLogs={hifzLogs}
                attendance={attendance}
                exams={exams}
                invoices={invoices}
              />
            )}

            {activeNav === 'halaqahs' && (
              <HalaqahsModule
                lang={lang}
                user={userProfile}
                halaqahs={halaqahs}
                students={students}
                staff={staff}
              />
            )}

            {activeNav === 'hifz' && (
              <HifzModule lang={lang} user={userProfile} students={students} hifzLogs={hifzLogs} />
            )}

            {activeNav === 'attendance' && (
              <AttendanceModule
                lang={lang}
                user={userProfile}
                students={students}
                staff={staff}
                halaqahs={halaqahs}
                attendance={attendance}
              />
            )}

            {activeNav === 'exams' && (
              <ExamsModule
                lang={lang}
                user={userProfile}
                students={students}
                exams={exams}
                settings={settings}
              />
            )}

            {activeNav === 'staff' && (
              <StaffModule lang={lang} user={userProfile} staff={staff} />
            )}

            {activeNav === 'finance' && (
              <FinanceModule
                lang={lang}
                user={userProfile}
                students={students}
                feePlans={feePlans}
                invoices={invoices}
                payments={payments}
              />
            )}

            {activeNav === 'kafalat' && (
              <KafalatModule
                lang={lang}
                user={userProfile}
                students={students}
                sponsors={sponsors}
              />
            )}

            {activeNav === 'donations' && (
              <DonationsModule
                lang={lang}
                user={userProfile}
                campaigns={campaigns}
                pledges={pledges}
                donations={donations}
              />
            )}

            {activeNav === 'admissions' && (
              <AdmissionsModule
                lang={lang}
                user={userProfile}
                admissions={admissions}
                halaqahs={halaqahs}
              />
            )}

            {activeNav === 'guardian_portal' && (
              <GuardianPortalModule
                lang={lang}
                user={userProfile}
                students={students}
                hifzLogs={hifzLogs}
                attendance={attendance}
                exams={exams}
                invoices={invoices}
              />
            )}

            {activeNav === 'library' && (
              <LibraryModule
                lang={lang}
                user={userProfile}
                books={books}
                bookLoans={bookLoans}
                students={students}
              />
            )}

            {activeNav === 'certificates' && (
              <CertificatesModule
                lang={lang}
                user={userProfile}
                students={students}
                certificates={certificates}
              />
            )}

            {activeNav === 'notifications' && (
              <NotificationsModule
                lang={lang}
                user={userProfile}
                notifications={notifications}
              />
            )}

            {activeNav === 'reports_ai' && (
              <ReportsAndAiModule
                lang={lang}
                user={userProfile}
                students={students}
                attendance={attendance}
                hifzLogs={hifzLogs}
                payments={payments}
                sponsors={sponsors}
              />
            )}

            {activeNav === 'settings_audit' && (
              <SettingsAndAuditModule
                lang={lang}
                user={userProfile}
                settings={settings}
                allUsers={allUsers}
                halaqahs={halaqahs}
                students={students}
                auditLogs={auditLogs}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone, Compact) */}
      <nav className="no-print fixed right-0 bottom-0 left-0 z-40 grid grid-cols-4 border-t border-[#D6E3DA] bg-white/95 backdrop-blur lg:hidden">
        {allowedNavs.slice(0, 4).map((id) => {
          const Icon = NAV_ICONS[id] || LayoutDashboard;
          const active = activeNav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveNav(id)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-[#145A32]' : 'text-[#4A6355]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-[76px] truncate">{t(lang, `nav_${id}`)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <MarkazErrorBoundary>
      <MarkazWorkspace />
    </MarkazErrorBoundary>
  );
}
