import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface RouteCelebrationProps {
  show: boolean;
  /** Total route distance in km — shown in the reveal banner. */
  distance?: number;
  /** How many stops could not be placed (shown as footnote). */
  unresolvableCount?: number;
  /** Called when the full celebration (car + reveal) is done. */
  onComplete: () => void;
}

/** Inline SVG "חיפושית" — cute VW Beetle-style silhouette. */
function Beetle() {
  return (
    <svg
      viewBox="0 0 130 80"
      className="h-24 w-40 drop-shadow-lg"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bottom chassis */}
      <ellipse cx="65" cy="55" rx="55" ry="12" fill="#be123c" />
      {/* Rounded top dome */}
      <path
        d="M 15 55 Q 20 15 65 12 Q 110 15 115 55 Z"
        fill="#f43f5e"
      />
      {/* Shine highlight */}
      <path
        d="M 30 30 Q 50 15 70 20"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Front window */}
      <path
        d="M 68 20 Q 95 25 100 48 L 72 48 Z"
        fill="#dbeafe"
        opacity="0.95"
      />
      {/* Back window */}
      <path
        d="M 62 20 Q 35 25 30 48 L 58 48 Z"
        fill="#dbeafe"
        opacity="0.95"
      />
      {/* Window divider */}
      <rect x="63" y="20" width="4" height="28" fill="#64748b" />
      {/* Headlight (front, to the right in RTL driving) */}
      <circle cx="112" cy="45" r="4" fill="#fef3c7" stroke="#facc15" strokeWidth="1" />
      {/* Tail light (left) */}
      <circle cx="18" cy="45" r="3" fill="#ef4444" />
      {/* Wheel wells */}
      <circle cx="35" cy="60" r="13" fill="#1f2937" />
      <circle cx="95" cy="60" r="13" fill="#1f2937" />
      {/* Tire treads */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.35, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '35px 60px' }}
      >
        <circle cx="35" cy="60" r="7" fill="#94a3b8" />
        <line x1="35" y1="53" x2="35" y2="67" stroke="#1f2937" strokeWidth="1.5" />
        <line x1="28" y1="60" x2="42" y2="60" stroke="#1f2937" strokeWidth="1.5" />
      </motion.g>
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.35, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '95px 60px' }}
      >
        <circle cx="95" cy="60" r="7" fill="#94a3b8" />
        <line x1="95" y1="53" x2="95" y2="67" stroke="#1f2937" strokeWidth="1.5" />
        <line x1="88" y1="60" x2="102" y2="60" stroke="#1f2937" strokeWidth="1.5" />
      </motion.g>
      {/* Antenna with flag */}
      <line x1="55" y1="14" x2="55" y2="6" stroke="#334155" strokeWidth="1.5" />
      <circle cx="55" cy="5" r="2" fill="#3b82f6" />
    </svg>
  );
}

function fireConfetti() {
  const defaults = {
    startVelocity: 32,
    spread: 360,
    ticks: 80,
    zIndex: 2100,
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444'],
  };
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.25, y: 0.65 } });
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.75, y: 0.65 } });
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 120, origin: { x: 0.5, y: 0.55 } });
  }, 250);
}

export function RouteCelebration({
  show,
  distance,
  unresolvableCount = 0,
  onComplete,
}: RouteCelebrationProps) {
  const [phase, setPhase] = useState<'idle' | 'driving' | 'reveal'>('idle');

  useEffect(() => {
    if (!show) {
      setPhase('idle');
      return;
    }
    setPhase('driving');
    const revealAt = window.setTimeout(() => {
      setPhase('reveal');
      fireConfetti();
    }, 4000);
    const endAt = window.setTimeout(() => {
      setPhase('idle');
      onComplete();
    }, 6500);
    return () => {
      window.clearTimeout(revealAt);
      window.clearTimeout(endAt);
    };
  }, [show, onComplete]);

  if (phase === 'idle') return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[2000] overflow-hidden"
      aria-hidden="true"
    >
      {/* Beetle driving across — right → left (matches Hebrew reading direction) */}
      <AnimatePresence>
        {phase === 'driving' && (
          <motion.div
            key="beetle"
            initial={{ x: '110vw' }}
            animate={{ x: '-25vw' }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 4, ease: 'linear' }}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ transform: 'scaleX(-1)' }}
          >
            <motion.div
              animate={{ y: [0, -4, 0, -6, 0, -3, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <Beetle />
              {/* Dust puffs trailing behind */}
              <div className="absolute left-0 top-full mt-1 flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="h-2 w-2 rounded-full bg-slate-400/50"
                    animate={{
                      opacity: [0, 0.7, 0],
                      scale: [0.3, 1.6, 0.3],
                      x: [0, -8, -16],
                    }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.12,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal banner */}
      <AnimatePresence>
        {phase === 'reveal' && (
          <motion.div
            key="reveal"
            initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="rounded-3xl bg-gradient-to-br from-emerald-500 via-sky-500 to-violet-500 px-10 py-8 text-center text-white shadow-2xl ring-4 ring-white/30"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-2 text-6xl"
              >
                🎉
              </motion.div>
              <div className="text-4xl font-black tracking-tight drop-shadow-sm md:text-5xl">
                יש לנו מסלול חדש!
              </div>
              {distance != null && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-3 text-lg font-medium opacity-95"
                >
                  מרחק משוער ~{distance} ק"מ
                </motion.div>
              )}
              {unresolvableCount > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-1 text-xs opacity-75"
                >
                  {unresolvableCount} עצירות ללא עיר מוכרת הועברו לסוף
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
