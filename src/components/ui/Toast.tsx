'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type ToastMessage = { id: number; text: string };

export function toast(text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('layali:toast', { detail: { text } }));
}

export function ToastViewport() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onToast = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      const id = Date.now() + Math.random();
      setMessages((prev) => [...prev.slice(-2), { id, text }]);
      window.setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 2800);
    };
    window.addEventListener('layali:toast', onToast);
    return () => window.removeEventListener('layali:toast', onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-24 inset-x-0 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-8">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.p
            key={message.id}
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            className="pointer-events-auto max-w-sm rounded-full border border-white/10 bg-black/80 px-4 py-2 text-sm text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur"
          >
            {message.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
