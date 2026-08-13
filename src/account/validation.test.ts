import { describe, expect, it } from 'vitest';
import { AccountArchiveError } from './types';
import { normalizeTrackName, normalizeUsername, safeDownloadName, toAccountError, validateTrackName, validateUsername } from './validation';

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
  it('valida e normalizza i nomi traccia come il backend', () => {
    expect(normalizeTrackName('  Bosco d’estate  ')).toBe('Bosco d’estate');
    expect(validateTrackName('Bosco d’estate')).toBeNull();
    expect(validateTrackName('')).toMatch(/1 a 120/);
    expect(validateTrackName('bosco/sera')).toMatch(/non può contenere/);
    expect(validateTrackName('a'.repeat(121))).toMatch(/1 a 120/);
  });

  it('mappa traccia non trovata e nome RPC non valido', () => {
    expect(toAccountError({ message: 'track not found' }).code).toBe('track_not_found');
    expect(toAccountError({ message: 'invalid display_name' }).code).toBe('invalid_track_name');
  });
});
