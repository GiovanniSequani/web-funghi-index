/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from './AuthCallbackPage';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('AuthCallbackPage', () => {
  it('non verifica il token prima del click e lo rimuove poi dall’URL', async () => {
    window.history.replaceState(null, '', '/auth/confirm?type=signup&token_hash=token-segreto');
    const verify = vi.fn().mockResolvedValue(undefined);
    render(<AuthCallbackPage mode="confirm" verify={verify} />);

    expect(verify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma email' }));

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(window.location.search).toBe('');
    expect(await screen.findByText(/Email confermata/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla mappa' }).getAttribute('href')).toBe('/mappa/');
  });

  it('mostra un errore comprensibile per un token già usato', async () => {
    window.history.replaceState(null, '', '/auth/confirm?type=signup&token_hash=token-usato');
    const verify = vi.fn().mockRejectedValue({ code: 'otp_expired' });
    render(<AuthCallbackPage mode="confirm" verify={verify} />);

    fireEvent.click(screen.getByRole('button', { name: 'Conferma email' }));

    expect(await screen.findByText(/già stato usato oppure è scaduto/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla mappa' }).getAttribute('href')).toBe('/mappa/');
  });

  it('in recovery verifica al click e salva la nuova password', async () => {
    window.history.replaceState(null, '', '/auth/recovery?type=recovery&token_hash=token-recovery');
    const verify = vi.fn().mockResolvedValue(undefined);
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    render(<AuthCallbackPage mode="recovery" verify={verify} updatePassword={updatePassword} />);

    fireEvent.click(screen.getByRole('button', { name: 'Verifica link' }));
    await screen.findByLabelText('Nuova password');
    fireEvent.change(screen.getByLabelText('Nuova password'), { target: { value: 'password-nuova' } });
    fireEvent.change(screen.getByLabelText('Ripeti password'), { target: { value: 'password-nuova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva nuova password' }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('password-nuova'));
    expect(await screen.findByText(/Password aggiornata/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla mappa' }).getAttribute('href')).toBe('/mappa/');
  });
});