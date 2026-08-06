import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AprobadorApp } from './AprobadorApp';
import * as api from '@shared/api';

jest.mock('@shared/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('AprobadorApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.formatMoney.mockImplementation((n) => `$${n}`);
    mockedApi.formatDate.mockImplementation((d) => d);
    mockedApi.getErrorMessage.mockImplementation((e) =>
      e instanceof Error ? e.message : 'error'
    );
  });

  it('valida OTP y muestra detalle para firmar', async () => {
    const user = userEvent.setup();
    mockedApi.getApproveChallenge.mockResolvedValue({
      solicitudId: 's1',
      aprobadorNombre: 'Carlos',
      aprobadorRol: 'Gerente',
      requiresOtp: true,
      otpHint: 'OTP enviado',
    });
    mockedApi.validateOtp.mockResolvedValue({
      sessionValidUntil: new Date(Date.now() + 60_000).toISOString(),
      solicitud: {
        id: 's1',
        titulo: 'Compra',
        descripcion: 'Desc',
        monto: 1000,
        solicitante: 'Ana',
        estado: 'Pendiente',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        aprobadores: [
          {
            id: 'a1',
            nombre: 'Carlos',
            email: 'c@e.com',
            rol: 'Gerente',
            token: 'tok-1',
            estado: 'Pendiente',
          },
        ],
      },
    });
    mockedApi.decideAprobacion.mockResolvedValue({
      id: 's1',
      titulo: 'Compra',
      descripcion: 'Desc',
      monto: 1000,
      solicitante: 'Ana',
      estado: 'Pendiente',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      aprobadores: [
        {
          id: 'a1',
          nombre: 'Carlos',
          email: 'c@e.com',
          rol: 'Gerente',
          token: 'tok-1',
          estado: 'Firmado',
          firma: { nombre: 'Carlos', fecha: '2026-01-01T00:00:00.000Z' },
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/approve?approver_token=tok-1&solicitud_id=s1']}>
        <Routes>
          <Route path="/approve" element={<AprobadorApp />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Hola/);
    await user.type(screen.getByPlaceholderText('------'), '123456');
    await user.click(screen.getByRole('button', { name: /Validar OTP/i }));

    await screen.findByText('Compra');
    await user.click(screen.getByRole('button', { name: /Aprobar y firmar/i }));

    await waitFor(() => {
      expect(mockedApi.decideAprobacion).toHaveBeenCalledWith('tok-1', 'aprobar');
    });
    expect(await screen.findByText(/Firma registrada/i)).toBeInTheDocument();
  });

  it('muestra error sin token', async () => {
    render(
      <MemoryRouter initialEntries={['/approve']}>
        <Routes>
          <Route path="/approve" element={<AprobadorApp />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Falta approver_token/i)).toBeInTheDocument();
  });
});
