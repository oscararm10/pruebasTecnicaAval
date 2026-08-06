import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renderiza estado Pendiente', () => {
    render(<StatusBadge estado="Pendiente" />);
    expect(screen.getByText('Pendiente')).toHaveClass('badge-pendiente');
  });

  it('renderiza estado Completada', () => {
    render(<StatusBadge estado="Completada" />);
    expect(screen.getByText('Completada')).toHaveClass('badge-completada');
  });
});
