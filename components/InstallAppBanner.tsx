import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, Check, Share, ArrowRight } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallAppBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const dismissedAt = localStorage.getItem('hdu_pwa_install_banner_dismissed_at');
      if (dismissedAt) {
        // Show banner again after 3 days if dismissed
        const parsed = parseInt(dismissedAt, 10);
        if (!isNaN(parsed) && Date.now() - parsed < 3 * 24 * 60 * 60 * 1000) {
          return true;
        }
      }
    }
    return false;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if the app is already running in standalone/PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      window.location.search.includes('source=pwa');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for Chrome / Android / Edge install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem('hdu_pwa_install_banner_dismissed_at');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Error triggering PWA install prompt:', err);
      } finally {
        setIsInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      // Fallback for browsers that do not fire beforeinstallprompt automatically
      alert(
        'To install this clinical app on your device:\n\n' +
        '1. Tap your browser menu (three dots or share button)\n' +
        '2. Select "Install app" or "Add to Home Screen"'
      );
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hdu_pwa_install_banner_dismissed_at', Date.now().toString());
    }
  };

  // If already installed or explicitly dismissed for 3 days, do not render
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <div 
      id="pwa-install-app-banner"
      className="relative z-30 bg-gradient-to-r from-slate-900 via-slate-850 to-sky-950 text-white border-b border-sky-500/20 shadow-md no-print animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Icon & Description */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 p-0.5 shadow-md shrink-0 flex items-center justify-center">
            <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center overflow-hidden">
              <img 
                src="/icon-192.svg" 
                alt="App Icon" 
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  // Fallback icon if SVG not loaded yet
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <Smartphone className="w-5 h-5 text-sky-400" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                Install Kidney Centre Records App
              </h4>
              <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">
                Mobile & Desktop
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md md:max-w-xl font-medium">
              1-tap access from home screen with full offline capability, camera scanning & fast biometrics.
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end">
          <button
            id="pwa-install-app-btn"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black rounded-xl shadow-md hover:shadow-sky-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-75"
          >
            <Download className={`w-4 h-4 ${isInstalling ? 'animate-bounce' : ''}`} />
            <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
          </button>

          <button
            id="pwa-install-dismiss-btn"
            onClick={handleDismiss}
            title="Dismiss for 3 days"
            aria-label="Dismiss banner"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Step-by-Step Instructions Drawer */}
      {showIOSInstructions && (
        <div className="bg-slate-950/95 border-t border-sky-500/30 px-4 py-3 sm:px-6 animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                iOS
              </div>
              <p className="text-slate-200 font-medium">
                To install on iPhone / iPad: Tap the Safari <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> <strong>Share</strong> icon below, then scroll and select <strong>"Add to Home Screen"</strong> <ArrowRight className="w-3.5 h-3.5 inline mx-0.5 text-slate-400" />.
              </p>
            </div>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline self-end sm:self-center cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
