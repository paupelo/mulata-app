import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-soft animate-slide-up max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-mulata-50 px-5 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl text-mulata-800">{title}</h2>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full bg-mulata-50 text-mulata-700 active:scale-90 transition"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
