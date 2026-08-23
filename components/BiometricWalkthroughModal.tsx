import React, { useState } from 'react';
import { 
  Fingerprint, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Key, 
  Lock, 
  X, 
  HelpCircle,
  Laptop,
  Check,
  ChevronRight,
  Info,
  Radio,
  Zap,
  Shield,
  CircleDot
} from 'lucide-react';
import { WebAuthnSupport } from '../services/webAuthnService';

interface BiometricWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  support?: WebAuthnSupport | null;
  onStartEnrollment?: () => void;
}

export const BiometricWalkthroughModal: React.FC<BiometricWalkthroughModalProps> = ({
  isOpen,
  onClose,
  support,
  onStartEnrollment
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;

  const stepMeta = [
    { id: 1, label: 'Device & Hardware', subtitle: 'Moto G54 Side Sensor' },
    { id: 2, label: 'Capture Flow', subtitle: 'Native Android Prompt' },
    { id: 3, label: '1-Tap Sign-In', subtitle: 'Instant Clinical Access' },
    { id: 4, label: 'Security & Privacy', subtitle: 'Zero Biometric Leakage' }
  ];

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
      onStartEnrollment?.();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Moto G54 & Biometric Walkthrough
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Hardware Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                Interactive guide for fast clinician passkey registration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step-by-Step Progress Indicator Header */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {stepMeta.map((step) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`text-left p-2 rounded-xl transition-all duration-200 cursor-pointer border ${
                    isActive 
                      ? 'bg-white border-red-300 shadow-xs ring-1 ring-red-500/20' 
                      : isCompleted
                      ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
                      : 'bg-slate-100/60 border-transparent hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                      isActive 
                        ? 'bg-red-600 text-white' 
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}>
                      {isCompleted ? '✓' : step.id}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider truncate ${
                      isActive ? 'text-red-700' : isCompleted ? 'text-emerald-800' : 'text-slate-500'
                    }`}>
                      Step {step.id}
                    </span>
                  </div>
                  <p className={`text-[10px] font-bold truncate leading-tight hidden sm:block ${
                    isActive ? 'text-slate-900' : 'text-slate-600'
                  }`}>
                    {step.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Connected Linear Progress Bar */}
          <div className="mt-2.5 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-red-600 to-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 flex-1">
          {/* STEP 1: Hardware & Device Support (Moto G54 Visual Diagram) */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Moto G54 Hardware Layout & Sensor Position
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    The <strong>Motorola Moto G54</strong> features a capacitive fingerprint scanner embedded directly on the <strong>right side power key</strong>. It authenticates in under 0.3s without needing to turn on the full screen.
                  </p>
                </div>
              </div>

              {/* Interactive Phone Layout Visual Diagram */}
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 text-white relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Phone Graphic Representation */}
                  <div className="relative w-36 h-56 bg-slate-950 border-4 border-slate-700 rounded-[28px] p-2 flex flex-col justify-between shadow-2xl shrink-0">
                    {/* Speaker notch */}
                    <div className="w-10 h-1 bg-slate-800 rounded-full mx-auto" />
                    
                    {/* Screen simulation */}
                    <div className="bg-slate-900 rounded-[18px] h-36 flex flex-col items-center justify-center p-2 border border-slate-800 text-center">
                      <Fingerprint className="w-8 h-8 text-red-500 animate-bounce mb-1" />
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Touch Sensor</span>
                      <span className="text-[7px] text-emerald-400 font-mono">Moto G54 Ready</span>
                    </div>

                    {/* Right side power button callout */}
                    <div className="absolute -right-3.5 top-20 w-3 h-10 bg-red-500 rounded-r-md border border-red-300 shadow-md shadow-red-500/50 animate-pulse flex items-center justify-center">
                      <span className="text-[6px] font-black text-white -rotate-90">POWER</span>
                    </div>

                    {/* Left volume key simulation */}
                    <div className="absolute -left-2 top-14 w-1.5 h-12 bg-slate-700 rounded-l-md" />

                    {/* Bottom chin */}
                    <div className="w-6 h-0.5 bg-slate-800 rounded-full mx-auto" />
                  </div>

                  {/* Feature Breakdown List */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-start gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">Side Power Button Scanner</p>
                        <p className="text-[10px] text-slate-300">Natural thumb resting position for right-handed or index finger for left-handed grip.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">Android 13/14 FIDO2 Engine</p>
                        <p className="text-[10px] text-slate-300">Google Chrome communicates directly with the phone hardware security enclave.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-900">
                    Detected Hardware: {support?.deviceLabel || 'Biometric Sensor detected & ready'}
                  </span>
                </div>
                <span className="text-[9px] font-black bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                  Connected
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: How Enrollment Works */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-start gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-white">
                    Step-by-Step Sensor Capture Flow
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    When you tap <strong>"Enroll Sensor"</strong>, Android will pop up its official system prompt.
                  </p>
                </div>
              </div>

              {/* Visual Workflow Steps with Interactive Accents */}
              <div className="space-y-3">
                <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-red-300 transition-colors">
                  <div className="w-7 h-7 rounded-xl bg-red-100 text-red-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900">Choose Clinician Profile & Set Device Label</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select your name and enter a friendly name like <span className="font-mono text-red-700 bg-red-50 px-1 py-0.5 rounded">Adil Moto G54</span> so administrators can identify the device.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border-2 border-red-400 bg-red-50/20 shadow-xs">
                  <div className="w-7 h-7 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-black text-red-950 flex items-center gap-1.5">
                      Touch the Moto G54 Power Key
                      <span className="text-[8px] bg-red-200 text-red-800 font-bold px-1.5 py-0.2 rounded uppercase">Critical Step</span>
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Android will display a bottom-sheet: <strong>"Verify it's you to create a passkey"</strong>. Rest your thumb gently on the side power button for 1 second until it vibrates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900">Cryptographic Key Paired</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      A green checkmark appears. The public passkey is securely linked to your medical portal account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 1-Tap Daily Sign In */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-emerald-950">
                    High-Speed Clinical Access (1-Tap Login)
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Designed for fast HDU bedside logs, rapid endoscopy entries, and zero password fatigue.
                  </p>
                </div>
              </div>

              {/* Visual Demo Box of the Login screen button */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                  Next Time You Open The Login Screen:
                </span>
                
                <div className="p-4 bg-white rounded-2xl border-2 border-red-500 shadow-md flex items-center justify-between group hover:bg-red-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase text-slate-900">Sign In With Biometrics</span>
                      <p className="text-[10px] text-slate-400 font-bold">Moto G54 Touch Key Sensor</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    1-Tap
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-600 font-medium">
                    Tap the red button on your screen ➔ Rest thumb on the Moto G54 power button ➔ <strong className="text-slate-900">Instantly signed in!</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Privacy & Zero Risk */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-start gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-white">
                    Zero Biometric Leakage & HIPAA/Hospital Safety
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Your actual fingerprint image or raw biometric scan is NEVER sent to any server.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-900 font-black mb-1">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>On-Device Enclave</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    The Moto G54 matches the fingerprint locally inside its protected hardware security module.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-900 font-black mb-1">
                    <Key className="w-4 h-4 text-red-600" />
                    <span>Revoke Anytime</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    If you change or lose your phone, remove the passkey with 1 click in User Management.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                  Your regular email & password remains 100% active as a backup login method.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
              currentStep === 1
                ? 'opacity-0 pointer-events-none'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-md shadow-red-600/20 transition-all cursor-pointer"
            >
              <span>{currentStep === totalSteps ? 'Start Registration' : 'Next Step'}</span>
              {currentStep === totalSteps ? (
                <Check className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricWalkthroughModal;
