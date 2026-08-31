/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MobileAuthBridgePage from './MobileAuthBridgePage';

afterEach(cleanup);

describe('MobileAuthBridgePage', () => {
  it('non apre né costruisce una navigazione prima del tap', () => {
    const openApp = vi.fn();
    render(<MobileAuthBridgePage
      callback={{ valid: true, tokenHash: 'secret-token', type: 'email' }}
      openApp={openApp}
    />);

    expect(openApp).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('secret-token');
  });

  it('apre il deep link soltanto dopo il tap esplicito', () => {
    const openApp = vi.fn();
    render(<MobileAuthBridgePage
      callback={{ valid: true, tokenHash: 'secret+token', type: 'signup' }}
      openApp={openApp}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Apri Funghi Tracker' }));

    expect(openApp).toHaveBeenCalledTimes(1);
    expect(openApp).toHaveBeenCalledWith(
      'funghitracker://auth/confirm?token_hash=secret%2Btoken&type=signup',
    );
  });

  it('mostra cold path invalido senza tentare di aprire l’app', () => {
    const openApp = vi.fn();
    render(<MobileAuthBridgePage
      callback={{ valid: false, message: 'Il link non è valido o è incompleto.' }}
      openApp={openApp}
    />);

    expect(screen.getByRole('alert').textContent).toMatch(/non è valido/);
    expect(screen.queryByRole('button', { name: 'Apri Funghi Tracker' })).toBeNull();
    expect(openApp).not.toHaveBeenCalled();
  });

  it('gestisce un errore sincrono di apertura senza esporre il token', () => {
    const openApp = vi.fn(() => { throw new Error('blocked'); });
    render(<MobileAuthBridgePage
      callback={{ valid: true, tokenHash: 'private-token', type: 'email' }}
      openApp={openApp}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Apri Funghi Tracker' }));

    expect(screen.getByRole('alert').textContent).toMatch(/Non è stato possibile aprire/);
    expect(document.body.textContent).not.toContain('private-token');
  });
});