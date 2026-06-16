// Botón flotante de acción rápida "+ Añadir".
export default function Fab({ onClick, label = 'Añadir' }) {
  return (
    <button
      onClick={onClick}
      className="fixed right-5 bottom-24 z-40 btn-primary h-14 pl-5 pr-6 text-base shadow-soft animate-pop"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <span className="text-2xl leading-none -mt-0.5">＋</span>
      {label}
    </button>
  );
}
