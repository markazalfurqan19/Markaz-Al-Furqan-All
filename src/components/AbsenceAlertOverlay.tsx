import React from 'react';
import { AlertTriangle, BellRing, CalendarCheck, X } from 'lucide-react';
import {
  AbsenceToastItem,
  BrowserPushPermission,
} from '../lib/attendanceMonitorService.ts';
import { t } from '../shared/i18n.ts';
import { MarkazLanguage, NavSectionId } from '../shared/types.ts';

interface AbsenceAlertOverlayProps {
  lang: MarkazLanguage;
  toasts: AbsenceToastItem[];
  pushPermission: BrowserPushPermission;
  canViewAttendance: boolean;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onNavigate: (tab: NavSectionId) => void;
  onEnablePush: () => void;
}

export const AbsenceAlertOverlay: React.FC<AbsenceAlertOverlayProps> = ({
  lang,
  toasts,
  pushPermission,
  canViewAttendance,
  onDismiss,
  onClearAll,
  onNavigate,
  onEnablePush,
}) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label={t(lang, 'absenceStreakAlertTitle')}
      className="no-print fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 sm:right-6 sm:bottom-6 rtl:right-auto rtl:left-4 sm:rtl:left-6"
    >
      {toasts.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-[#D6E3DA] bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#334E3F] shadow-sm backdrop-blur hover:bg-[#EAF3ED]"
          >
            {t(lang, 'dismissAllAlerts')} ({toasts.length})
          </button>
        </div>
      )}

      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="rounded-xl border-2 border-[#C49A45] bg-white p-4 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#B45309]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-[#0B3D2E] leading-snug">
                  {toast.title}
                </h4>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Dismiss alert"
                  className="rounded p-0.5 text-[#4A6355] hover:bg-[#EAF3ED] hover:text-[#0B3D2E]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#334E3F]">
                {toast.message}
              </p>
              {toast.dates && (
                <p className="mt-1.5 font-mono-tabular text-[10px] font-semibold text-[#B45309]">
                  {toast.dates.join(' • ')}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {canViewAttendance && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('attendance');
                      onDismiss(toast.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#145A32] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0B3D2E]"
                  >
                    <CalendarCheck className="h-3 w-3" />
                    <span>{t(lang, 'reviewAttendance')}</span>
                  </button>
                )}
                {pushPermission === 'default' && (
                  <button
                    type="button"
                    onClick={onEnablePush}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#C49A45]/60 bg-[#FBF8EE] px-2.5 py-1 text-[11px] font-semibold text-[#7A5915] hover:bg-[#F7EED6]"
                  >
                    <BellRing className="h-3 w-3" />
                    <span>{t(lang, 'enablePushAlerts')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
};
