import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateSolicitudPage } from './CreateSolicitudPage';
import * as api from '@shared/api';

jest.mock('@shared/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('CreateSolicitudPage', () => {
  it('envía el formulario de creación', async () => {
    const user = userEvent.setup();
    mockedApi.getErrorMessage.mockReturnValue('err');
    mockedApi.createSolicitud.mockResolvedValue({
      solicitud: {
        id: 'new-1',
        titulo: 'Test',
        descripcion: 'Desc',
        monto: 10,
        solicitante: 'Ana',
        estado: 'Pendiente',
        createdAt: '',
        updatedAt: '',
        aprobadores: [],
      },
      mails: [],
    });

    render(
      <MemoryRouter>
        <CreateSolicitudPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText(/Laptops equipo/i), 'Compra test');
    await user.type(
      screen.getByPlaceholderText(/Detalle de la necesidad/i),
      'Descripcion completa'
    );
    await user.type(screen.getByPlaceholderText('25000000'), '5000');
    await user.type(screen.getByPlaceholderText(/Nombre del solicitante/i), 'Ana');

    const nombreInputs = screen.getAllByLabelText('Nombre');
    const emailInputs = screen.getAllByLabelText('Correo');
    const rolSelects = screen.getAllByLabelText('Rol');

    await user.type(nombreInputs[0], 'A');
    await user.type(nombreInputs[1], 'B');
    await user.type(nombreInputs[2], 'C');
    await user.type(emailInputs[0], 'a@e.com');
    await user.type(emailInputs[1], 'b@e.com');
    await user.type(emailInputs[2], 'c@e.com');
    await user.selectOptions(rolSelects[0], 'Gerente');
    await user.selectOptions(rolSelects[1], 'Finanzas');
    await user.selectOptions(rolSelects[2], 'Compras');

    await user.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(mockedApi.createSolicitud).toHaveBeenCalled();
  });
});
