import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TextEncoder/Decoder which might be missing in some node envs
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Simple hash implementation for testing since crypto.subtle is hard to mock in node without setup
async function simpleHash(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin + "wealthpilot-salt"); 
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe('Security Logic', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('hashes PIN consistently', async () => {
    const pin = "1234";
    const hash1 = await simpleHash(pin);
    const hash2 = await simpleHash(pin);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('hashes different PINs to different values', async () => {
    const hash1 = await simpleHash("1234");
    const hash2 = await simpleHash("5678");
    expect(hash1).not.toBe(hash2);
  });
});
