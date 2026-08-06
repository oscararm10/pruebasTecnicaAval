import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolicitudesListPage } from './SolicitudesListPage';
import * as api from '@shared/api';

jest.mock('@shared/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('SolicitudesListPage', () => {
  it('lista solicitudes', async () => {
    mockedApi.formatMoney.mockReturnValue('$1');
    mockedApi.formatDate.mockReturnValue('fecha');
    mockedApi.getErrorMessage.mockReturnValue('err');
    mockedApi.listSolicitudes.mockResolvedValue([
      {
        id: '1',
        titulo: 'Laptops',
        descripcion: 'x',
        monto: 100,
        solicitante: 'Ana',
        estado: 'Pendiente',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        aprobadores: [],
      },
    ]);

    render(
      <MemoryRouter>
        <SolicitudesListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Laptops')).toBeInTheDocument();
    });
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });
});
