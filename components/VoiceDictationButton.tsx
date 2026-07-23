import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  size?: 'sm' | 'md';
  lightTheme?: boolean;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  size = 'sm',
  lightTheme = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const recognitionRef = useRef<any>(null);

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
        setShowFeedback(true);
      };

      rec.onend = () => {
        setIsListening(false);
        // Hide feedback after 2 seconds
        const timer = setTimeout(() => setShowFeedback(false), 2000);
        return () => clearTimeout(timer);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        let errorMsg = `Error: ${event.error}`;
        let duration = 3000;
        if (event.error === 'not-allowed') {
          errorMsg = 'Microphone blocked. Please check browser permissions or open in a new tab.';
          duration = 6000;
        } else if (event.error === 'no-speech') {
          errorMsg = 'No speech detected';
        } else if (event.error === 'network') {
          errorMsg = 'Network error during speech recognition';
        }
        setErrorMessage(errorMsg);
        setIsListening(false);
        setShowFeedback(true);
        const timer = setTimeout(() => setShowFeedback(false), duration);
        return () => clearTimeout(timer);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          onTranscript(transcript);
        }
      };

      recognitionRef.current = rec;
    } catch (e) {
      console.error('Failed to initialize Speech Recognition', e);
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
  }, [onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      setErrorMessage('Speech not supported in this browser');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
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
        // Force reset
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
      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
    : isListening
    ? 'bg-red-950/40 border-red-500/50 text-red-400 hover:bg-red-950/60'
    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white';

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        className={`flex items-center gap-1.5 border rounded-lg font-black uppercase tracking-wider transition-all duration-200 active:scale-95 ${themeClasses} ${sizeClasses} shadow-sm cursor-pointer`}
        title={isListening ? 'Stop dictation' : 'Start voice-to-text dictation'}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>Listening</span>
          </>
        ) : (
          <>
            <Mic className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>Dictate</span>
          </>
        )}
      </button>

      {showFeedback && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-md border whitespace-nowrap flex items-center gap-1.5 ${
            errorMessage 
              ? 'bg-red-500 border-red-600 text-white' 
              : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            {errorMessage ? (
              <>
                <MicOff className="w-3 h-3 text-red-200" />
                <span>{errorMessage}</span>
              </>
            ) : isListening ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                <span>Speak now...</span>
              </>
            ) : (
              <span>Dictation added</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
