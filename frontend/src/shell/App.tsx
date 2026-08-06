import React from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { SolicitanteApp } from '../solicitante/SolicitanteApp';
import { AprobadorApp } from '../aprobador/AprobadorApp';
import { MockMailPage } from '../solicitante/MockMailPage';

/**
 * Shell (host MFE): orquesta rutas y monta micro-frontends Solicitante / Aprobador.
 * Los MFEs también se exponen vía Module Federation (`./SolicitanteApp`, `./AprobadorApp`).
 */
export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
          Aval<span>.</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Solicitudes
          </NavLink>
          <NavLink to="/nueva">Nueva solicitud</NavLink>
          <NavLink to="/mock-mail">Mock mail</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/approve" element={<AprobadorApp />} />
        <Route path="/mock-mail" element={<MockMailPage />} />
        <Route path="/*" element={<SolicitanteApp />} />
      </Routes>
    </div>
  );
}
