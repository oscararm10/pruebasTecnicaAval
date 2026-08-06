import React, { useEffect, useState } from 'react';
import { formatDate, getErrorMessage, listMockMails } from '@shared/api';
import { MockMail } from '@shared/types';

export function MockMailPage() {
  const [items, setItems] = useState<MockMail[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listMockMails();
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
      <h1>Mock mail</h1>
      <p className="lead">
        Simulación de correos enviados por el backend (`GET /api/mock-mail`).
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="meta">Cargando…</p>}
      {!loading && items.length === 0 && (
        <div className="panel empty">No hay correos simulados todavía.</div>
      )}

      <div className="list">
        {items.map((mail) => (
          <article className="mail-card" key={mail.id}>
            <div className="meta">{formatDate(mail.createdAt)}</div>
            <strong>Para: {mail.to}</strong>
            <div>{mail.subject}</div>
            {mail.link && (
              <a href={mail.link} target="_blank" rel="noreferrer">
                {mail.link}
              </a>
            )}
            <div className="meta">OTP: {mail.otp}</div>
            <pre>{mail.body}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
