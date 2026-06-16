import { money, formatDate } from '../lib/format';

/**
 * Lista de registros (ventas o gastos) con acciones de editar/eliminar.
 * props:
 *  - records: array
 *  - type: 'sale' | 'expense'
 *  - onEdit(record), onDelete(record)
 *  - emptyText
 */
export default function RecordList({ records, type, onEdit, onDelete, emptyText }) {
  if (!records || records.length === 0) {
    return (
      <div className="card text-center text-ink/50 py-10">
        <p className="text-3xl mb-2">🧾</p>
        <p>{emptyText || 'Aún no hay registros en este periodo.'}</p>
      </div>
    );
  }

  const isSale = type === 'sale';

  return (
    <ul className="space-y-2">
      {records.map((r) => {
        const title = isSale
          ? r.client_name || r.unit_name || 'Venta'
          : r.category_name || r.concept || 'Gasto';
        const subtitle = isSale
          ? r.note
          : [r.concept, r.supplier].filter(Boolean).join(' · ') || r.note;
        return (
          <li
            key={r.id}
            className="card flex items-center gap-3 py-3 animate-fade-in hover:shadow-soft transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{title}</p>
                {!isSale && r.kind && (
                  <span
                    className={`chip text-[10px] px-2 py-0.5 ${
                      r.kind === 'fijo'
                        ? 'bg-blue-50 text-blue-600'
                        : r.kind === 'general'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-purple-50 text-purple-600'
                    }`}
                  >
                    {r.kind}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink/50 truncate">
                {formatDate(r.sale_date || r.expense_date)}
                {subtitle ? ` · ${subtitle}` : ''}
              </p>
            </div>

            <p className={`font-semibold tabular-nums ${isSale ? 'text-green-700' : 'text-mulata-700'}`}>
              {isSale ? '' : '−'}
              {money(r.amount)}
            </p>

            <div className="flex gap-1">
              <button
                onClick={() => onEdit(r)}
                className="h-8 w-8 grid place-items-center rounded-full bg-mulata-50 text-mulata-700 active:scale-90 transition"
                aria-label="Editar"
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(r)}
                className="h-8 w-8 grid place-items-center rounded-full bg-red-50 text-red-500 active:scale-90 transition"
                aria-label="Eliminar"
              >
                🗑
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
