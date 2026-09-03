import { describe, expect, it, vi } from 'vitest';
import { consumeDeletionToken } from './deletionToken';

describe('deletion token fragment', () => {
  it('legge un token valido dal fragment e ripulisce subito la URL', () => {
    const replace = vi.fn();
    const token = 'a'.repeat(64);
    const result = consumeDeletionToken('/elimina-account', '?source=email', '#token=' + token, replace);

    expect(result).toEqual({ token, invalid: false });
    expect(replace).toHaveBeenCalledWith('/elimina-account?source=email');
  });

  it('rimuove anche fragment non validi senza inoltrarli', () => {
    const replace = vi.fn();
    expect(consumeDeletionToken('/elimina-account', '', '#token=non-valido', replace))
      .toEqual({ token: null, invalid: true });
    expect(replace).toHaveBeenCalledWith('/elimina-account');
  });

  it('ignora fragment su route diverse', () => {
    const replace = vi.fn();
    expect(consumeDeletionToken('/', '', '#token=' + 'a'.repeat(64), replace)).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});