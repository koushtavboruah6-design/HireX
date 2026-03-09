/**
 * components/AudioWaveform.jsx
 * Visual microphone activity indicator.
 * Shows animated bars when audio is active.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function AudioWaveform({ active = false, stream = null, className = '' }) {
  const [bars, setBars] = useState(Array(12).fill(0.3));
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!active || !stream) {
      setBars(Array(12).fill(0.3));
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const barCount = 12;
        const step = Math.floor(dataArray.length / barCount);
        const newBars = Array.from({ length: barCount }, (_, i) => {
          const val = dataArray[i * step] / 255;
          return Math.max(0.08, val);
        });
        setBars(newBars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Fallback: animated bars without real audio data
      let t = 0;
      const fallback = setInterval(() => {
        t += 0.2;
        setBars(Array(12).fill(0).map((_, i) =>
          0.2 + 0.5 * Math.abs(Math.sin(t + i * 0.6))
        ));
      }, 80);
      return () => clearInterval(fallback);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, [active, stream]);

  return (
    <div className={`flex items-center gap-2.5 group ${className}`}>
      {active
        ? <Mic size={14} className="text-ink-900 shrink-0 transition-transform group-hover:scale-110 duration-300" />
        : <MicOff size={14} className="text-ink-400 shrink-0" />
      }
      <div className="flex items-end gap-[3px] h-6 bg-paper-50 px-2 py-1 rounded-lg border border-paper-200">
        {bars.map((height, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-100 ease-out"
            style={{
              height: `${height * 100}%`,
              minHeight: 3,
              backgroundColor: active ? '#0a0a0a' : '#d4d4d8',
              opacity: active ? 0.7 + height * 0.3 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}
