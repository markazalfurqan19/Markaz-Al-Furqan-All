import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../shared/i18n.ts';
import {
  AttendanceRecord,
  MarkazLanguage,
  NotificationRecord,
  Student,
  UserProfile,
} from '../shared/types.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import { logAuditEvent } from './markazDb.ts';

export interface ConsecutiveAbsenceAlert {
  alertKey: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  halaqahId: string;
  halaqahGroup: string;
  consecutiveDays: number;
  dates: [string, string, string];
  endDate: string;
}

export interface AbsenceToastItem {
  id: string;
  title: string;
  message: string;
  studentCode?: string;
  studentName?: string;
  dates?: [string, string, string];
  createdAt: string;
}

export type BrowserPushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const SEEN_TOASTS_STORAGE_KEY = 'alfurqaan_seen_absence_toasts_v1';
const SWEEP_INTERVAL_MS = 30_000;
const REALTIME_FRESHNESS_WINDOW_MS = 15 * 60 * 1000;

export function parseUtcDateMs(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function buildAbsenceAlertKey(studentId: string, endDate: string): string {
  const cleanId = (studentId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const cleanDate = (endDate || '').replace(/[^0-9-]/g, '').slice(0, 20);
  return `abs3_${cleanId}_${cleanDate}`;
}

/**
 * Pure domain detector: flags every active student whose attendance records show
 * purely 'Absent' status (no Present/Late/Excused on that date) across 3 or more
 * consecutive calendar days.
 */
export function detectThreeDayConsecutiveAbsences(
  attendance: AttendanceRecord[],
  students: Student[]
): ConsecutiveAbsenceAlert[] {
  const studentMap = new Map<string, Student>();
  for (const s of students) {
    studentMap.set(s.id, s);
  }

  // Group student records by targetId -> date -> statuses
  const byStudentDate = new Map<
    string,
    Map<
      string,
      {
        hasNonAbsent: boolean;
        hasAbsent: boolean;
        targetName: string;
        targetCode: string;
        halaqahId: string;
      }
    >
  >();

  for (const rec of attendance) {
    if (rec.recordType !== 'student') continue;
    if (!rec.targetId || !parseUtcDateMs(rec.date)) continue;

    // If student directory is loaded and student exists but is not active, skip alert
    const directoryStudent = studentMap.get(rec.targetId);
    if (directoryStudent && directoryStudent.status !== 'active') {
      continue;
    }

    let dateMap = byStudentDate.get(rec.targetId);
    if (!dateMap) {
      dateMap = new Map();
      byStudentDate.set(rec.targetId, dateMap);
    }

    const existing = dateMap.get(rec.date) || {
      hasNonAbsent: false,
      hasAbsent: false,
      targetName: directoryStudent?.fullName || rec.targetName || 'Student',
      targetCode: directoryStudent?.code || rec.targetCode || '',
      halaqahId: directoryStudent?.halaqahId || rec.halaqahId || '',
    };

    if (rec.status === 'Absent') {
      existing.hasAbsent = true;
    } else {
      existing.hasNonAbsent = true;
    }

    dateMap.set(rec.date, existing);
  }

  const alerts: ConsecutiveAbsenceAlert[] = [];

  for (const [studentId, dateMap] of byStudentDate.entries()) {
    const absentDates: string[] = [];
    let metaName = 'Student';
    let metaCode = '';
    let metaHalaqahId = '';

    for (const [dateStr, daySummary] of dateMap.entries()) {
      metaName = daySummary.targetName;
      metaCode = daySummary.targetCode;
      metaHalaqahId = daySummary.halaqahId;
      if (daySummary.hasAbsent && !daySummary.hasNonAbsent) {
        absentDates.push(dateStr);
      }
    }

    if (absentDates.length < 3) continue;

    absentDates.sort();

    // Find streaks of consecutive calendar days
    let currentRun: string[] = [absentDates[0]];
    let latestThreePlusRun: string[] | null = null;

    for (let i = 1; i < absentDates.length; i++) {
      const prevMs = parseUtcDateMs(absentDates[i - 1]);
      const currMs = parseUtcDateMs(absentDates[i]);
      if (prevMs !== null && currMs !== null && currMs - prevMs === 86_400_000) {
        currentRun.push(absentDates[i]);
      } else {
        if (currentRun.length >= 3) {
          latestThreePlusRun = [...currentRun];
        }
        currentRun = [absentDates[i]];
      }
    }
    if (currentRun.length >= 3) {
      latestThreePlusRun = [...currentRun];
    }

    if (latestThreePlusRun && latestThreePlusRun.length >= 3) {
      const len = latestThreePlusRun.length;
      const dates: [string, string, string] = [
        latestThreePlusRun[len - 3],
        latestThreePlusRun[len - 2],
        latestThreePlusRun[len - 1],
      ];
      const endDate = dates[2];
      const studentObj = studentMap.get(studentId);
      alerts.push({
        alertKey: buildAbsenceAlertKey(studentId, endDate),
        studentId,
        studentName: studentObj?.fullName || metaName,
        studentCode: studentObj?.code || metaCode,
        halaqahId: studentObj?.halaqahId || metaHalaqahId,
        halaqahGroup: studentObj?.halaqahGroup || '',
        consecutiveDays: len,
        dates,
        endDate,
      });
    }
  }

  return alerts.sort((a, b) => b.endDate.localeCompare(a.endDate));
}

export function getBrowserPushPermission(): BrowserPushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserPushPermission(): Promise<BrowserPushPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function triggerBrowserPushNotification(params: {
  title: string;
  body: string;
  tag: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body: params.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: params.tag,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, options);
        return true;
      }
    }
    new Notification(params.title, options);
    return true;
  } catch {
    return false;
  }
}

function loadSeenAlertKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_TOASTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenAlertKeys(keys: Set<string>): void {
  try {
    const trimmed = Array.from(keys).slice(-250);
    localStorage.setItem(SEEN_TOASTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota issues
  }
}

function formatAlertCopy(alert: ConsecutiveAbsenceAlert, lang: MarkazLanguage) {
  const titleTemplate = t(lang, 'absenceStreakAlertTitle');
  const studentLabel = alert.studentCode
    ? `${alert.studentName} (${alert.studentCode})`
    : alert.studentName;
  const dateRange = `${alert.dates[0]} – ${alert.dates[2]}`;
  const rawTitle = `${titleTemplate}: ${studentLabel}`;
  const title = rawTitle.slice(0, 155);

  const rawBody = t(lang, 'absenceStreakAlertBody')
    .replace('{student}', studentLabel)
    .replace('{days}', String(alert.consecutiveDays))
    .replace('{dates}', dateRange);

  return {
    title,
    message: rawBody.slice(0, 980),
  };
}

/**
 * Background monitoring service hook:
 * - Periodically & reactively evaluates attendance records for 3-consecutive-day absences
 * - Persists deduplicated in-app notifications in Firestore (`notifications/abs3_*`)
 * - Surfaces real-time dashboard toasts & PWA/browser push notifications across sessions
 */
export function useAbsenceAlertBackgroundService(params: {
  userProfile: UserProfile | null;
  lang: MarkazLanguage;
  students: Student[];
  attendance: AttendanceRecord[];
  notifications: NotificationRecord[];
}) {
  const { userProfile, lang, students, attendance, notifications } = params;

  const [toasts, setToasts] = useState<AbsenceToastItem[]>([]);
  const [pushPermission, setPushPermission] = useState<BrowserPushPermission>(() =>
    getBrowserPushPermission()
  );
  const [lastSweepAt, setLastSweepAt] = useState<string | null>(null);

  const seenToastKeysRef = useRef<Set<string>>(loadSeenAlertKeys());
  const inFlightWritesRef = useRef<Set<string>>(new Set());
  const notificationsRef = useRef<NotificationRecord[]>(notifications);
  notificationsRef.current = notifications;

  const consecutiveAlerts = useMemo(
    () => detectThreeDayConsecutiveAbsences(attendance, students),
    [attendance, students]
  );

  const enqueueToastAndPush = useCallback(
    (item: AbsenceToastItem) => {
      if (seenToastKeysRef.current.has(item.id)) return;
      seenToastKeysRef.current.add(item.id);
      saveSeenAlertKeys(seenToastKeysRef.current);

      setToasts((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev].slice(0, 5);
      });

      void triggerBrowserPushNotification({
        title: item.title,
        body: item.message,
        tag: item.id,
      });
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const handleRequestPushPermission = useCallback(async () => {
    const next = await requestBrowserPushPermission();
    setPushPermission(next);
    return next;
  }, []);

  const runBackgroundSweep = useCallback(async () => {
    if (!userProfile) return;

    const canReadAttendanceAndWriteNotif = [
      'super_admin',
      'director',
      'registrar',
      'muallim',
      'examiner',
    ].includes(userProfile.role);

    setLastSweepAt(new Date().toISOString());

    if (!canReadAttendanceAndWriteNotif) return;

    const existingIds = new Set(notificationsRef.current.map((n) => n.id));

    for (const alert of consecutiveAlerts) {
      const { title, message } = formatAlertCopy(alert, lang);

      enqueueToastAndPush({
        id: alert.alertKey,
        title,
        message,
        studentCode: alert.studentCode,
        studentName: alert.studentName,
        dates: alert.dates,
        createdAt: new Date().toISOString(),
      });

      if (
        !existingIds.has(alert.alertKey) &&
        !inFlightWritesRef.current.has(alert.alertKey)
      ) {
        inFlightWritesRef.current.add(alert.alertKey);
        const notifRef = doc(db, 'notifications', alert.alertKey);
        try {
          const snap = await getDoc(notifRef);
          if (!snap.exists()) {
            const now = new Date().toISOString();
            await setDoc(notifRef, {
              recipientRole: 'director',
              recipientUid: '',
              title,
              message,
              channel: 'in_app',
              language: lang,
              deliveryStatus: 'sent',
              consentVerified: true,
              createdAt: now,
            });
            await logAuditEvent({
              actorRole: userProfile.role,
              action: 'ABSENCE_STREAK_ALERT',
              entity: 'notifications',
              entityId: alert.alertKey,
              summary: `Triggered 3-day consecutive absence alert for ${alert.studentCode || alert.studentName} (${alert.dates.join(', ')})`,
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `notifications/${alert.alertKey}`);
        } finally {
          inFlightWritesRef.current.delete(alert.alertKey);
        }
      }
    }
  }, [userProfile, consecutiveAlerts, lang, enqueueToastAndPush]);

  // Immediate sweep whenever attendance/students update
  useEffect(() => {
    if (!userProfile) return;
    void runBackgroundSweep().catch((err) => {
      console.warn('Background absence monitor sweep notice:', err);
    });
  }, [userProfile?.uid, runBackgroundSweep]);

  // Background periodic sweep & visibility resume check
  useEffect(() => {
    if (!userProfile) return;
    const timer = window.setInterval(() => {
      void runBackgroundSweep().catch((err) => {
        console.warn('Background absence monitor sweep notice:', err);
      });
    }, SWEEP_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setPushPermission(getBrowserPushPermission());
        void runBackgroundSweep().catch((err) => {
          console.warn('Background absence monitor sweep notice:', err);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userProfile?.uid, runBackgroundSweep]);

  // Remote Firestore listener path: if another staff member records an abs3_ alert,
  // surface dashboard toast + browser push for freshly created notifications.
  useEffect(() => {
    if (!userProfile) return;
    const nowMs = Date.now();
    for (const n of notifications) {
      if (!n.id.startsWith('abs3_')) continue;
      const createdMs = Date.parse(n.createdAt || '');
      if (!Number.isNaN(createdMs) && nowMs - createdMs <= REALTIME_FRESHNESS_WINDOW_MS) {
        enqueueToastAndPush({
          id: n.id,
          title: n.title,
          message: n.message,
          createdAt: n.createdAt,
        });
      }
    }
  }, [userProfile?.uid, notifications, enqueueToastAndPush]);

  return {
    consecutiveAlerts,
    toasts,
    dismissToast,
    clearAllToasts,
    pushPermission,
    requestPushPermission: handleRequestPushPermission,
    runBackgroundSweep,
    lastSweepAt,
  };
}
