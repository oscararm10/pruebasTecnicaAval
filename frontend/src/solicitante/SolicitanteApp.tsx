import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { CreateSolicitudPage } from './CreateSolicitudPage';
import { SolicitudDetailPage } from './SolicitudDetailPage';
import { SolicitudesListPage } from './SolicitudesListPage';

/** Micro-frontend Solicitante: crear y consultar solicitudes. */
export function SolicitanteApp() {
  return (
    <Routes>
      <Route index element={<SolicitudesListPage />} />
      <Route path="nueva" element={<CreateSolicitudPage />} />
      <Route path="solicitudes/:id" element={<SolicitudDetailPage />} />
    </Routes>
  );
}

export default SolicitanteApp;
