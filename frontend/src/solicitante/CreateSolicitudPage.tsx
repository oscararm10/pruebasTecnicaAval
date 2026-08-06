import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSolicitud, getErrorMessage } from '@shared/api';
import { AprobadorInput } from '@shared/types';

const ROLES = ['Gerente', 'Finanzas', 'Compras', 'Legal', 'TI', 'Operaciones'];

const emptyApprover = (): AprobadorInput => ({
  nombre: '',
  email: '',
  rol: '',
});

export function CreateSolicitudPage() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [aprobadores, setAprobadores] = useState<AprobadorInput[]>([
    emptyApprover(),
    emptyApprover(),
    emptyApprover(),
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateApprover(index: number, patch: Partial<AprobadorInput>) {
    setAprobadores((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { solicitud } = await createSolicitud({
        titulo,
        descripcion,
        monto: Number(monto),
        solicitante,
        aprobadores,
      });
      navigate(`/solicitudes/${solicitud.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h1>Nueva solicitud de compra</h1>
      <p className="lead">
        Defina la compra y seleccione tres roles distintos que deberán firmar.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="panel form" onSubmit={onSubmit}>
        <label>
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            placeholder="Ej. Laptops equipo desarrollo"
          />
        </label>
        <label>
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            placeholder="Detalle de la necesidad y justificación"
          />
        </label>
        <div className="row">
          <label>
            Monto
            <input
              type="number"
              min="1"
              step="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              placeholder="25000000"
            />
          </label>
          <label>
            Solicitante
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              required
              placeholder="Nombre del solicitante"
            />
          </label>
        </div>

        {aprobadores.map((aprobador, index) => (
          <div className="approver-block" key={index}>
            <h3>Aprobador {index + 1}</h3>
            <div className="row">
              <label>
                Nombre
                <input
                  value={aprobador.nombre}
                  onChange={(e) => updateApprover(index, { nombre: e.target.value })}
                  required
                />
              </label>
              <label>
                Rol
                <select
                  value={aprobador.rol}
                  onChange={(e) => updateApprover(index, { rol: e.target.value })}
                  required
                >
                  <option value="">Seleccione rol</option>
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Correo
              <input
                type="email"
                value={aprobador.email}
                onChange={(e) => updateApprover(index, { email: e.target.value })}
                required
              />
            </label>
          </div>
        ))}

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Crear solicitud'}
          </button>
        </div>
      </form>
    </section>
  );
}
