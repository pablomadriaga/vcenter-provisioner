import { describe, test, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Auth Service Logic', () => {
    const JWT_SECRET = 'test-secret';

    test('Password Hashing Integrity', async () => {
        const password = 'antigravity-secret';
        const hash = await bcrypt.hash(password, 10);

        expect(await bcrypt.compare(password, hash)).toBe(true);
        expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
    });

    test('JWT Token Generation and Verification', () => {
        const payload = { id: 1, username: 'staff-eng', role: 'admin' };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        expect(decoded.username).toBe('staff-eng');
        expect(decoded.role).toBe('admin');
    });

    test('JWT Rejection on Invalid Secret', () => {
        const token = jwt.sign({ id: 1 }, JWT_SECRET);
        expect(() => {
            jwt.verify(token, 'different-secret');
        }).toThrow('invalid signature');
    });
});
