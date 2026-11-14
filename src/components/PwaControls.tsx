import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { t } from '../shared/i18n.ts';
import { MarkazLanguage } from '../shared/types.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const MarkazCrest: React.FC<{ size?: number; className?: string; alt?: string }> = ({
  size = 40,
  className = '',
  alt = 'Al-Furqaan Qur’an Memorization Center Logo',
}) => (
  <img
    src="/markaz-logo.svg"
    width={size}
    height={size}
    alt={alt}
    style={{ width: size, height: size }}
    className={`rounded-full object-cover bg-white ring-2 ring-[#C49A45]/60 shrink-0 ${className}`}
  />
);

export const PWAInstallButton: React.FC<{ lang: MarkazLanguage }> = ({ lang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#C49A45]/60 bg-[#0B3D2E] px-3 py-1.5 text-xs font-semibold text-[#F7E7BE] transition hover:bg-[#145A32] whitespace-nowrap shrink-0"
    >
      <Download className="h-3.5 w-3.5" />
      <span>{t(lang, 'installApp')}</span>
    </button>
  );
};

export const OfflineIndicator: React.FC<{ lang: MarkazLanguage }> = ({ lang }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-[#C49A45] bg-[#FEF3C7] px-4 py-2 text-xs font-medium text-[#78350F]"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{t(lang, 'offlineBanner')}</span>
    </div>
  );
};
