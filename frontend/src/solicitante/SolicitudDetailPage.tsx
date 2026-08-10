import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadEvidencia,
  formatDate,
  formatMoney,
  getErrorMessage,
  getSolicitud,
  listMockMails,
} from '@shared/api';
import { StatusBadge } from '@shared/StatusBadge';
import { MockMail, Solicitud } from '@shared/types';

export function SolicitudDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [mails, setMails] = useState<MockMail[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [sol, mailItems] = await Promise.all([
        getSolicitud(id),
        listMockMails(id),
      ]);
      setSolicitud(sol);
      setMails(mailItems.filter((m) => m.link));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownloadPdf() {
    if (!solicitud) return;
    setDownloading(true);
    setError('');
    try {
      await downloadEvidencia(solicitud.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <p className="meta">Cargando detalle…</p>;
  if (error && !solicitud) return <div className="alert alert-error">{error}</div>;
  if (!solicitud) return <p className="empty">Solicitud no encontrada</p>;

  return (
    <section>
      <p className="meta">
        <Link to="/">← Volver</Link>
      </p>
      <h1>{solicitud.titulo}</h1>
      <p className="lead">{solicitud.descripcion}</p>

      <div className="panel">
        <div className="actions" style={{ marginBottom: '1rem' }}>
          <StatusBadge estado={solicitud.estado} />
          <button className="btn btn-ghost" type="button" onClick={() => void load()}>
            Actualizar
          </button>
          {solicitud.estado === 'Completada' && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={downloading}
              onClick={() => void onDownloadPdf()}
            >
              {downloading ? 'Descargando…' : 'Descargar PDF'}
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="meta">
          Monto: <strong>{formatMoney(solicitud.monto)}</strong>
          <br />
          Solicitante: {solicitud.solicitante}
          <br />
          Creada: {formatDate(solicitud.createdAt)}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Aprobador</th>
              <th>Estado</th>
              <th>Firma</th>
            </tr>
          </thead>
          <tbody>
            {solicitud.aprobadores.map((a) => (
              <tr key={a.id}>
                <td>{a.rol}</td>
                <td>
                  {a.nombre}
                  <div className="meta">{a.email}</div>
                </td>
                <td>
                  <StatusBadge estado={a.estado} />
                </td>
                <td>
                  {a.firma ? (
                    <>
                      {a.firma.nombre}
                      <div className="meta">{formatDate(a.firma.fecha)}</div>
                    </>
                  ) : (
                    <span className="meta">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: '1.5rem' }}>Links de aprobación (simulación email)</h2>
      <div className="list" style={{ marginTop: '0.75rem' }}>
        {mails.map((mail) => (
          <div className="mail-card" key={mail.id}>
            <strong>{mail.to}</strong>
            <div className="meta">{mail.subject}</div>
            <a href={mail.link} target="_blank" rel="noreferrer">
              Abrir link de aprobación
            </a>
            <div className="meta">OTP inicial: {mail.otp}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
