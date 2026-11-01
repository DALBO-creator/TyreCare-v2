import { describe, expect, it } from 'vitest';
import { chiaveSessione } from './supabase';

describe('chiaveSessione', () => {
  it('usa il primo pezzo del dominio', () => {
    expect(chiaveSessione('https://abcd.supabase.co')).toBe('sb-abcd-auth-token');
  });

  it('funziona con il Supabase locale', () => {
    expect(chiaveSessione('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });
});
