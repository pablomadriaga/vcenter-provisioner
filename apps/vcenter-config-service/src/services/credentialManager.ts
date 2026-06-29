import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

export class CredentialManager {
    private key: Buffer;

    constructor(masterKey: string) {
        if (masterKey.length < 32) {
            throw new Error('Master key must be at least 32 characters');
        }
        this.key = crypto.scryptSync(masterKey, 'vcenter-salt', KEY_LENGTH);
    }

    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    }

    decrypt(encryptedData: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, tagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    static generateMasterKey(length: number = 64): string {
        return crypto.randomBytes(length).toString('hex');
    }
}

export const createCredentialManager = (masterKey: string) => {
    return new CredentialManager(masterKey);
};
