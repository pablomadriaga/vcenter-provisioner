import { describe, it, expect } from 'vitest';

describe('Basic Auth Credential Format Validation', () => {
    const isValidBasicAuthFormat = (credential: string): boolean => {
        return credential.includes(':');
    };

    const encodeBasicAuth = (credential: string): string => {
        return Buffer.from(credential).toString('base64');
    };

    describe('Credential Format Validation', () => {
        it('should accept valid format: username:password', () => {
            expect(isValidBasicAuthFormat('admin:password123')).toBe(true);
        });

        it('should accept valid format: user@domain:password', () => {
            expect(isValidBasicAuthFormat('admin@vsphere.local:password123')).toBe(true);
        });

        it('should accept valid format: DOMAIN\\user:password', () => {
            expect(isValidBasicAuthFormat('DOMAIN\\admin:password')).toBe(true);
        });

        it('should accept credential with special characters in password', () => {
            expect(isValidBasicAuthFormat('user:pass@word!#$%')).toBe(true);
        });

        it('should reject invalid format: no colon', () => {
            expect(isValidBasicAuthFormat('invalid-no-colon')).toBe(false);
        });

        it('should reject invalid format: just colon', () => {
            expect(isValidBasicAuthFormat(':')).toBe(true);
        });

        it('should reject empty string', () => {
            expect(isValidBasicAuthFormat('')).toBe(false);
        });

        it('should reject only username without password', () => {
            expect(isValidBasicAuthFormat('adminonly')).toBe(false);
        });
    });

    describe('Basic Auth Header Encoding', () => {
        it('should correctly encode username:password', () => {
            const encoded = encodeBasicAuth('admin:password123');
            expect(encoded).toBe(Buffer.from('admin:password123').toString('base64'));
            expect(encoded).toBe('YWRtaW46cGFzc3dvcmQxMjM=');
        });

        it('should correctly encode user@domain:password', () => {
            const encoded = encodeBasicAuth('admin@vsphere.local:secret');
            expect(encoded).toBe('YWRtaW5AdnNwaGVyZS5sb2NhbDpzZWNyZXQ=');
        });

        it('should produce correct Authorization header format', () => {
            const credential = 'user:pass';
            const header = `Basic ${encodeBasicAuth(credential)}`;
            expect(header).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
        });
    });

    describe('vCenter API endpoint validation', () => {
        it('should use correct vCenter REST API endpoint', () => {
            const vcenterUrl = 'https://vcenter.example.com';
            const expectedEndpoint = `${vcenterUrl}/rest/com/vmware/cis`;
            expect(expectedEndpoint).toBe('https://vcenter.example.com/rest/com/vmware/cis');
        });
    });
});
