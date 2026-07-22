import { useToastStore } from '../store/toast';
import type { ToastKind } from '../store/toast';

const KIND_STYLES: Record<ToastKind, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

const KIND_ICON: Record<ToastKind, string> = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md ${KIND_STYLES[t.kind]}`}
        >
          <span aria-hidden className="mt-0.5 shrink-0">
            {KIND_ICON[t.kind]}
          </span>
          <span className="flex-1 break-words">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-current/60 transition-opacity hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
