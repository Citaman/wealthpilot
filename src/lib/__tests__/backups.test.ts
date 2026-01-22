import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from '../backups';

describe('Backup Encryption (AES-GCM)', () => {
  const passphrase = "correct-horse-battery-staple";
  const rawData = JSON.stringify({ test: "data", secret: 123 });

  it('encrypts and decrypts data correctly', async () => {
    const encrypted = await encryptData(rawData, passphrase);
    expect(encrypted).toContain('AES-GCM');
    
    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toBe(rawData);
    expect(JSON.parse(decrypted).secret).toBe(123);
  });

  it('fails to decrypt with wrong passphrase', async () => {
    const encrypted = await encryptData(rawData, passphrase);
    await expect(decryptData(encrypted, "wrong-pass")).rejects.toThrow();
  });

  it('generates unique salt and iv for each encryption', async () => {
    const encrypted1 = JSON.parse(await encryptData(rawData, passphrase));
    const encrypted2 = JSON.parse(await encryptData(rawData, passphrase));
    
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);
    expect(encrypted1.data).not.toBe(encrypted2.data);
  });
});
