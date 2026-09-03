/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountDeletionPage from './AccountDeletionPage';

const callback = { token: 'a'.repeat(64), invalid: false };

afterEach(cleanup);

describe('AccountDeletionPage', () => {
  it('richiede un click esplicito, conferma una sola volta e chiude la sessione locale', async () => {
    const confirmDeletion = vi.fn().mockResolvedValue({ confirmed: true, job_id: 'job-1' });
    const clearSession = vi.fn().mockResolvedValue(undefined);
    render(<AccountDeletionPage callback={callback} confirmDeletion={confirmDeletion} clearSession={clearSession} />);

    expect(confirmDeletion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma eliminazione definitiva' }));

    await screen.findByText('Richiesta confermata');
    expect(confirmDeletion).toHaveBeenCalledTimes(1);
    expect(confirmDeletion).toHaveBeenCalledWith(callback.token);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it.each(['token scaduto', 'token già usato'])('gestisce %s senza promettere una distinzione che il backend non fornisce', async () => {
    const confirmDeletion = vi.fn().mockRejectedValue({ message: 'verification token is invalid or expired' });
    render(<AccountDeletionPage callback={callback} confirmDeletion={confirmDeletion} clearSession={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma eliminazione definitiva' }));

    expect((await screen.findByRole('alert')).textContent).toContain('non è valido, è scaduto oppure è già stato usato');
    expect(screen.getByRole('link', { name: 'Richiedi un nuovo link' })).toBeTruthy();
  });

  it('permette di ritentare un errore di rete senza riutilizzare automaticamente il token', async () => {
    const confirmDeletion = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ confirmed: true, job_id: 'job-1' });
    render(<AccountDeletionPage callback={callback} confirmDeletion={confirmDeletion} clearSession={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole('checkbox'));
    const button = screen.getByRole('button', { name: 'Conferma eliminazione definitiva' });
    fireEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toContain('Errore di rete');
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await screen.findByText('Richiesta confermata');
    expect(confirmDeletion).toHaveBeenCalledTimes(2);
  });

  it('mostra sempre la stessa risposta per la richiesta pubblica', async () => {
    const requestDeletion = vi.fn().mockResolvedValue(undefined);
    render(<AccountDeletionPage callback={null} requestDeletion={requestDeletion} />);
    fireEvent.change(screen.getByLabelText('Email account'), { target: { value: 'unknown@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia richiesta' }));
    expect((await screen.findByRole('status')).textContent).toContain('Se la richiesta può essere elaborata');
    expect(requestDeletion).toHaveBeenCalledWith('unknown@example.test');
  });
});