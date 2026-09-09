import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('hardening sessione Auth web', () => {
  it('disabilita il rilevamento globale di sessioni presenti negli URL', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'client.ts'), 'utf8');
    expect(source).toContain('detectSessionInUrl: false');
    expect(source).not.toContain('detectSessionInUrl: true');
  });

  it('non contiene bridge verso custom URI con credenziali Auth', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '../main.tsx'), 'utf8');
    expect(main).not.toMatch(/funghitracker:\/\/auth|MobileAuthBridge/);
  });
});
