import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialManager } from '../src/services/credentialManager.js';

describe('CredentialManager', () => {
    let manager: CredentialManager;
    const masterKey = 'test-master-key-at-least-32-characters-long!';

    beforeEach(() => {
        manager = new CredentialManager(masterKey);
    });

    describe('encrypt/decrypt', () => {
        it('should encrypt and decrypt a credential', () => {
            const plaintext = 'my-api-token-12345';
            const encrypted = manager.encrypt(plaintext);

            expect(encrypted).not.toBe(plaintext);
            expect(encrypted.split(':')).toHaveLength(3);

            const decrypted = manager.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertext for same plaintext', () => {
            const plaintext = 'same-token';
            const encrypted1 = manager.encrypt(plaintext);
            const encrypted2 = manager.encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should handle special characters', () => {
            const specialChars = 'token=abc&secret=xyz!@#$%^&*()_+-=[]{}|;\':",./<>?';
            const encrypted = manager.encrypt(specialChars);
            const decrypted = manager.decrypt(encrypted);

            expect(decrypted).toBe(specialChars);
        });

        it('should handle long credentials', () => {
            const longCredential = 'a'.repeat(10000);
            const encrypted = manager.encrypt(longCredential);
            const decrypted = manager.decrypt(encrypted);

            expect(decrypted).toBe(longCredential);
        });

        it('should throw on invalid encrypted data', () => {
            expect(() => manager.decrypt('invalid-data')).toThrow();
        });

        it('should throw on tampered ciphertext', () => {
            const encrypted = manager.encrypt('my-token');
            const [iv, tag, ciphertext] = encrypted.split(':');
            const tampered = iv + ':' + tag + ':' + ciphertext.slice(0, -1) + 'x';

            expect(() => manager.decrypt(tampered)).toThrow();
        });
    });

    describe('constructor', () => {
        it('should accept 32+ character key', () => {
            expect(() => new CredentialManager('a'.repeat(32))).not.toThrow();
        });

        it('should accept longer key', () => {
            expect(() => new CredentialManager('b'.repeat(64))).not.toThrow();
        });

        it('should throw on key shorter than 32 characters', () => {
            expect(() => new CredentialManager('short')).toThrow('Master key must be at least 32 characters');
        });
    });

    describe('generateMasterKey', () => {
        it('should generate key of specified length', () => {
            const key64 = CredentialManager.generateMasterKey(64);
            expect(key64.length).toBe(128);
        });

        it('should generate unique keys', () => {
            const key1 = CredentialManager.generateMasterKey();
            const key2 = CredentialManager.generateMasterKey();
            expect(key1).not.toBe(key2);
        });
    });
});
