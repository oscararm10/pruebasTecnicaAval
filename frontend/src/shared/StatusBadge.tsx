import React from 'react';
import { AprobadorEstado, SolicitudEstado } from './types';

export function StatusBadge({
  estado,
}: {
  estado: SolicitudEstado | AprobadorEstado;
}) {
  const cls = `badge badge-${estado.toLowerCase()}`;
  return <span className={cls}>{estado}</span>;
}
