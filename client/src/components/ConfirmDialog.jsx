import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Eliminar' }) {
  return (
    <Modal open={open} onClose={onClose} title={title || '¿Confirmar?'}>
      <p className="text-ink/70 mb-6">{message || 'Esta acción no se puede deshacer.'}</p>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn-danger flex-1"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
