export type MarkazLanguage = 'om' | 'ar' | 'en';

export type UserRole =
  | 'super_admin'
  | 'director'
  | 'registrar'
  | 'muallim'
  | 'examiner'
  | 'accountant'
  | 'kafalat_officer'
  | 'librarian'
  | 'guardian'
  | 'auditor';

export type StudyTrack =
  | 'full_hifz'
  | 'part_time_hifz'
  | 'nazirah_tajweed'
  | 'islamic_studies';

export type StudentStatus =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'withdrawn'
  | 'graduated'
  | 'archived';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export type HifzGrade =
  | 'Mumtaz'
  | 'Jayyid Jiddan'
  | 'Jayyid'
  | 'Maqbul'
  | 'Needs Revision';

export type PaymentMethod = 'cash' | 'bank' | 'mobile';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: UserRole;
  institutionId: string;
  assignedHalaqahIds: string[];
  linkedStudentIds: string[];
  preferredLanguage: MarkazLanguage;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  code: string;
  fullName: string;
  dob: string;
  age: number;
  gender: 'male' | 'female';
  guardianIds: string[];
  guardianName: string;
  guardianPhone: string;
  address: string;
  track: StudyTrack;
  currentSurah: string;
  juzLevel: number;
  halaqahId: string;
  halaqahGroup: string;
  status: StudentStatus;
  kafalatEligible: boolean;
  sponsorId?: string;
  enrollmentDate: string;
  admissionSource: string;
  notes?: string;
  institutionId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  fullName: string;
  verifiedPhone: string;
  email?: string;
  relationship: string;
  linkedStudentIds: string[];
  consentStatus: 'granted' | 'pending' | 'revoked';
  preferredLanguage: MarkazLanguage;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  staffCode: string;
  fullName: string;
  role: UserRole;
  phone: string;
  email?: string;
  qualification: string;
  employmentStatus: 'active' | 'on_leave' | 'inactive' | 'archived';
  contractType: 'full_time' | 'part_time' | 'volunteer';
  assignedHalaqahIds: string[];
  joinDate: string;
  active: boolean;
  createdAt: string;
}

export interface Halaqah {
  id: string;
  name: string;
  level: string;
  track: StudyTrack;
  muallimId: string;
  muallimName: string;
  schedule: string;
  shift: 'morning' | 'afternoon' | 'evening' | 'weekend';
  classroom: string;
  capacity: number;
  active: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  recordType: 'student' | 'staff';
  targetId: string;
  targetName: string;
  targetCode: string;
  halaqahId: string;
  date: string;
  session: 'fajr' | 'morning' | 'afternoon' | 'maghrib' | 'full_day';
  status: AttendanceStatus;
  reason?: string;
  qrVerified?: boolean;
  recordedBy: string;
  createdAt: string;
}

export interface HifzLog {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  halaqahId: string;
  date: string;
  sabaqRange: string;
  sabaqPages: number;
  currentSurah: string;
  sabqiJuz: string;
  manzilJuz: string;
  grade: HifzGrade;
  muallimId: string;
  muallimName: string;
  remarks?: string;
  reviewStatus: 'draft' | 'submitted' | 'reviewed';
  createdAt: string;
}

export interface ExamRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  halaqahId?: string;
  examDate: string;
  examType: 'hifz_oral' | 'tajweed' | 'revision' | 'written';
  juzTested: string;
  totalScore: number;
  maximumScore: number;
  grade: string;
  examinerId: string;
  examinerName: string;
  approvalStatus: 'scheduled' | 'marked' | 'approved' | 'published';
  comments?: string;
  createdAt: string;
}

export interface FeePlan {
  id: string;
  name: string;
  track: StudyTrack;
  amountETB: number;
  frequency: 'monthly' | 'term' | 'annual' | 'one_time';
  effectiveFrom: string;
  active: boolean;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  feePlanId?: string;
  period: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'waived';
  dueDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNo: string;
  invoiceId?: string;
  studentId: string;
  studentName: string;
  payerName: string;
  amountETB: number;
  method: PaymentMethod;
  transactionDate: string;
  recordedBy: string;
  reversalStatus: 'active' | 'reversed';
  reversalReason?: string;
  reversedBy?: string;
  reversedAt?: string;
  createdAt: string;
}

export interface Sponsor {
  id: string;
  fullName: string;
  organization?: string;
  phone: string;
  email?: string;
  commitmentETB: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  beneficiaryStudentId?: string;
  beneficiaryStudentName?: string;
  startDate: string;
  monthsPaid: number;
  status: 'active' | 'paused' | 'completed';
  anonymousReporting: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  targetETB: number;
  pledgedETB: number;
  raisedETB: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface Donor {
  id: string;
  fullName: string;
  isAnonymous: boolean;
  phone?: string;
  email?: string;
  preferredLanguage: MarkazLanguage;
  consentToContact: boolean;
  createdAt: string;
}

export interface Pledge {
  id: string;
  donorId?: string;
  donorName: string;
  donorPhone?: string;
  campaignId: string;
  campaignTitle: string;
  amountETB: number;
  tier: string;
  status: 'pledged' | 'partial' | 'fulfilled' | 'cancelled';
  pledgedAt: string;
}

export interface Donation {
  id: string;
  donorId?: string;
  donorName: string;
  isAnonymous: boolean;
  campaignId: string;
  campaignTitle: string;
  pledgeId?: string;
  amountETB: number;
  method: PaymentMethod;
  receiptNo: string;
  receivedAt: string;
  recordedBy: string;
}

export interface AdmissionApplication {
  id: string;
  referenceNo: string;
  fullName: string;
  dob: string;
  age: number;
  gender: 'male' | 'female';
  phone: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  track: StudyTrack;
  priorHifzJuz: number;
  consentAccepted: boolean;
  status: 'submitted' | 'under_review' | 'accepted' | 'waitlisted' | 'rejected' | 'enrolled';
  reviewNotes?: string;
  reviewedBy?: string;
  linkedStudentId?: string;
  submittedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  language: MarkazLanguage;
  accessionCode: string;
  totalCopies: number;
  availableCopies: number;
  shelfLocation?: string;
}

export interface BookLoan {
  id: string;
  bookId: string;
  bookTitle: string;
  accessionCode: string;
  borrowerId: string;
  borrowerName: string;
  borrowerType: 'student' | 'staff';
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: 'borrowed' | 'returned' | 'overdue' | 'lost';
  issuedBy: string;
}

export interface Certificate {
  id: string;
  certificateNo: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  graduationBatch: string;
  track: StudyTrack;
  totalJuzCompleted: number;
  finalGrade: string;
  issuedAt: string;
  verificationToken: string;
  status: 'active' | 'revoked';
  revocationReason?: string;
  approvedBy: string;
}

export interface PublicCertificateSummary {
  certificateNo: string;
  studentInitials: string;
  track: StudyTrack;
  graduationBatch: string;
  totalJuzCompleted: number;
  issuedAt: string;
  status: 'active' | 'revoked';
}

export interface NotificationRecord {
  id: string;
  recipientUid?: string;
  recipientRole: string;
  title: string;
  message: string;
  channel: 'in_app' | 'sms' | 'email' | 'whatsapp';
  language: MarkazLanguage;
  deliveryStatus: 'queued' | 'sent' | 'failed';
  consentVerified: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  reason?: string;
  timestamp: string;
}

export interface InstitutionSettings {
  institutionNameOm: string;
  institutionNameAr: string;
  institutionNameEn: string;
  location: string;
  defaultLanguage: MarkazLanguage;
  hijriDisplayEnabled: boolean;
  activeAcademicYear: string;
  gradingScale: {
    mumtazMin: number;
    jayyidJiddanMin: number;
    jayyidMin: number;
    maqbulMin: number;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export type NavSectionId =
  | 'dashboard'
  | 'students'
  | 'halaqahs'
  | 'hifz'
  | 'attendance'
  | 'exams'
  | 'staff'
  | 'finance'
  | 'kafalat'
  | 'donations'
  | 'admissions'
  | 'guardian_portal'
  | 'library'
  | 'certificates'
  | 'notifications'
  | 'reports_ai'
  | 'settings_audit'
  | 'public_portal';

export const ROLE_NAV_ACCESS: Record<UserRole, NavSectionId[]> = {
  super_admin: [
    'dashboard',
    'students',
    'halaqahs',
    'hifz',
    'attendance',
    'exams',
    'staff',
    'finance',
    'kafalat',
    'donations',
    'admissions',
    'library',
    'certificates',
    'notifications',
    'reports_ai',
    'settings_audit',
  ],
  director: [
    'dashboard',
    'students',
    'halaqahs',
    'hifz',
    'attendance',
    'exams',
    'staff',
    'finance',
    'kafalat',
    'donations',
    'admissions',
    'library',
    'certificates',
    'notifications',
    'reports_ai',
    'settings_audit',
  ],
  registrar: [
    'dashboard',
    'students',
    'halaqahs',
    'attendance',
    'admissions',
    'certificates',
    'notifications',
    'reports_ai',
  ],
  muallim: ['dashboard', 'students', 'halaqahs', 'hifz', 'attendance', 'notifications'],
  examiner: ['dashboard', 'students', 'hifz', 'exams', 'certificates', 'reports_ai'],
  accountant: ['dashboard', 'finance', 'kafalat', 'donations', 'reports_ai'],
  kafalat_officer: ['dashboard', 'students', 'kafalat', 'donations', 'reports_ai'],
  librarian: ['dashboard', 'library', 'notifications'],
  guardian: ['guardian_portal', 'notifications'],
  auditor: [
    'dashboard',
    'students',
    'hifz',
    'attendance',
    'exams',
    'finance',
    'kafalat',
    'donations',
    'admissions',
    'certificates',
    'reports_ai',
    'settings_audit',
  ],
};
