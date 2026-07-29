import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  size?: 'sm' | 'md';
  lightTheme?: boolean;
  context?: 'search' | 'inventory' | 'dictation' | 'general';
  showPulsePrompt?: boolean;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  size = 'sm',
  lightTheme = false,
  showPulsePrompt = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        // Gracefully ignore 'aborted' error which occurs when recognition is stopped or component re-renders
        if (event.error === 'aborted') {
          setIsListening(false);
          return;
        }

        if (event.error === 'no-speech') {
          setIsListening(false);
          setErrorMessage('No speech detected');
          const timer = setTimeout(() => setErrorMessage(null), 2000);
          return () => clearTimeout(timer);
        }

        let errorMsg = `Error: ${event.error}`;
        let duration = 3000;
        if (event.error === 'not-allowed') {
          errorMsg = 'Mic blocked';
          duration = 4000;
        } else if (event.error === 'network') {
          errorMsg = 'Network error';
        }
        setErrorMessage(errorMsg);
        setIsListening(false);
        const timer = setTimeout(() => setErrorMessage(null), duration);
        return () => clearTimeout(timer);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          const trimmed = transcript.trim();
          
          // Handle voice shortcuts like "clear" or "clear search"
          if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'clear search' || trimmed.toLowerCase() === 'reset') {
            onTranscriptRef.current('');
          } else {
            onTranscriptRef.current(trimmed);
          }
        }
      };

      recognitionRef.current = rec;
    } catch (e) {
      console.warn('Failed to initialize Speech Recognition', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      setErrorMessage('Speech not supported');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition', err);
        try {
          recognitionRef.current.abort();
          setTimeout(() => recognitionRef.current.start(), 100);
        } catch (e) {
          // ignore
        }
      }
    }
  };

  if (!isSupported) {
    return null; // Don't render if browser doesn't support Web Speech API
  }

  // Choose styling classes based on theme, listening state, and size
  const themeClasses = lightTheme
    ? isListening
      ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 shadow-md shadow-red-100'
      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    : isListening
    ? 'bg-red-950/60 border-red-500/80 text-red-300 hover:bg-red-950/80'
    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white';

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]';

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggleListening}
        className={`relative flex items-center gap-1.5 border rounded-lg font-black uppercase tracking-wider transition-all duration-200 active:scale-95 ${themeClasses} ${sizeClasses} shadow-sm cursor-pointer`}
        title={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>Listening...</span>
          </>
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <Mic className={size === 'sm' ? 'w-3 h-3 text-red-500' : 'w-3.5 h-3.5 text-red-500'} />
              {showPulsePrompt && (
                <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <span>Voice</span>
          </>
        )}
      </button>

      {/* Tiny inline error pill if mic error occurs */}
      {errorMessage && (
        <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200 animate-in fade-in">
          {errorMessage}
        </span>
      )}
    </div>
  );
};


