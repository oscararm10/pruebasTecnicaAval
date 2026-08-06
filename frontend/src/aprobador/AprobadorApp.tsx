import React, { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  decideAprobacion,
  formatDate,
  formatMoney,
  getApproveChallenge,
  getErrorMessage,
  validateOtp,
} from '@shared/api';
import { StatusBadge } from '@shared/StatusBadge';
import { ApproveChallenge, Solicitud } from '@shared/types';

type Step = 'loading' | 'otp' | 'detail' | 'done' | 'error';

/** Micro-frontend Aprobador: acceso por link + OTP + firmar/rechazar. */
export function AprobadorApp() {
  const [params] = useSearchParams();
  const token = params.get('approver_token') || '';
  const solicitudId = params.get('solicitud_id') || '';

  const [step, setStep] = useState<Step>('loading');
  const [challenge, setChallenge] = useState<ApproveChallenge | null>(null);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setError('Falta approver_token en el link');
        setStep('error');
        return;
      }
      try {
        const data = await getApproveChallenge(token);
        if (!active) return;
        setChallenge(data);
        if (!data.requiresOtp) {
          setMessage(data.otpHint);
          setStep('done');
          return;
        }
        setStep('otp');
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err));
        setStep('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function onValidateOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await validateOtp(token, otp.trim());
      setSolicitud(result.solicitud);
      setStep('detail');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(decision: 'aprobar' | 'rechazar') {
    setBusy(true);
    setError('');
    try {
      const updated = await decideAprobacion(token, decision);
      setSolicitud(updated);
      setMessage(
        decision === 'aprobar'
          ? 'Firma registrada correctamente.'
          : 'Solicitud rechazada.'
      );
      setStep('done');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const aprobador = solicitud?.aprobadores.find((a) => a.token === token);

  return (
    <section>
      <h1>Aprobación de compra</h1>
      <p className="lead">
        Valide su identidad con OTP y registre su decisión sobre la solicitud.
      </p>

      {solicitudId && (
        <p className="meta">Solicitud: {solicitudId}</p>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {message && step === 'done' && (
        <div className="alert alert-ok">{message}</div>
      )}

      {step === 'loading' && <p className="meta">Preparando desafío OTP…</p>}

      {step === 'otp' && challenge && (
        <form className="panel form" onSubmit={onValidateOtp}>
          <div className="alert alert-info">
            Hola <strong>{challenge.aprobadorNombre}</strong> ({challenge.aprobadorRol}).
            <br />
            {challenge.otpHint}
          </div>
          <label>
            Código OTP
            <input
              className="otp-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="------"
              autoFocus
            />
          </label>
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Validando…' : 'Validar OTP'}
            </button>
          </div>
        </form>
      )}

      {step === 'detail' && solicitud && (
        <div className="panel">
          <h2>{solicitud.titulo}</h2>
          <p>{solicitud.descripcion}</p>
          <p className="meta">
            Monto: <strong>{formatMoney(solicitud.monto)}</strong>
            <br />
            Solicitante: {solicitud.solicitante}
            <br />
            Creada: {formatDate(solicitud.createdAt)}
          </p>
          {aprobador && (
            <p className="meta">
              Usted firma como <strong>{aprobador.rol}</strong> — {aprobador.nombre}
            </p>
          )}
          <div className="actions">
            <button
              className="btn btn-ok"
              type="button"
              disabled={busy}
              onClick={() => void onDecide('aprobar')}
            >
              Aprobar y firmar
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={busy}
              onClick={() => void onDecide('rechazar')}
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      {step === 'done' && solicitud && (
        <div className="panel">
          <div className="actions" style={{ marginBottom: '1rem' }}>
            <StatusBadge estado={solicitud.estado} />
          </div>
          <h2>{solicitud.titulo}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Estado</th>
                <th>Firma</th>
              </tr>
            </thead>
            <tbody>
              {solicitud.aprobadores.map((a) => (
                <tr key={a.id}>
                  <td>{a.rol}</td>
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
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AprobadorApp;
