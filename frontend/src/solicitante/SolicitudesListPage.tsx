import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney, getErrorMessage, listSolicitudes } from '@shared/api';
import { StatusBadge } from '@shared/StatusBadge';
import { Solicitud } from '@shared/types';

export function SolicitudesListPage() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listSolicitudes();
        if (active) setItems(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h1>Panel del solicitante</h1>
      <p className="lead">
        Consulte el avance de cada solicitud y el estado de las firmas.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="meta">Cargando solicitudes…</p>}

      {!loading && items.length === 0 && (
        <div className="panel empty">
          No hay solicitudes todavía.{' '}
          <Link to="/nueva">Crear la primera</Link>
        </div>
      )}

      <div className="list">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/solicitudes/${item.id}`}
            className="list-item"
          >
            <div>
              <strong>{item.titulo}</strong>
              <div className="meta">
                {formatMoney(item.monto)} · {item.solicitante} ·{' '}
                {formatDate(item.createdAt)}
              </div>
            </div>
            <StatusBadge estado={item.estado} />
          </Link>
        ))}
      </div>
    </section>
  );
}
