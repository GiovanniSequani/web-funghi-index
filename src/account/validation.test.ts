import { describe, expect, it } from 'vitest';
import { AccountArchiveError } from './types';
import { normalizeUsername, safeDownloadName, toAccountError, validateUsername } from './validation';

describe('account validation', () => {
  it('normalizza e valida lo username secondo il contratto', () => {
    expect(normalizeUsername('  Mario_Rossi ')).toBe('mario_rossi');
    expect(validateUsername('mario_rossi')).toBeNull();
    expect(validateUsername('Mario-Rossi')).toMatch(/3-24 caratteri/);
    expect(validateUsername('ab')).toMatch(/3-24 caratteri/);
  });

  it('rende espliciti username duplicato, quota e sessione scaduta', () => {
    expect(toAccountError({ message: 'Database error saving new user' }).code).toBe('duplicate_username');
    expect(toAccountError({ message: 'GPX track quota exceeded (50 tracks)' }).code).toBe('quota_exceeded');
    expect(toAccountError({ message: 'JWT expired', status: 401 }).code).toBe('session_expired');
  });

  it('preserva gli errori di cancellazione parziale', () => {
    const error = new AccountArchiveError('partial_delete', 'retry', { partial: true });
    expect(toAccountError(error)).toBe(error);
    expect(error.partial).toBe(true);
  });

  it('genera sempre un nome download gzip sicuro', () => {
    expect(safeDownloadName('bosco.gpx')).toBe('bosco.gpx.gz');
    expect(safeDownloadName('bosco.gpx.gz')).toBe('bosco.gpx.gz');
    expect(safeDownloadName('../bosco')).toBe('..-bosco.gpx.gz');
  });
});
