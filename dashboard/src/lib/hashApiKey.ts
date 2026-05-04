import crypto from 'crypto';

/**
 * Hashes an API key using SHA-256.
 *
 * Why SHA-256 and not bcrypt?
 * - API keys are long (64 random hex bytes) cryptographically random secrets, not user-chosen passwords.
 * - bcrypt's slow hashing is designed to resist brute-force on weak passwords — unnecessary here.
 * - SHA-256 is deterministic and fast, which is what we need for a per-request lookup.
 * - The security comes from the key's entropy (32 random bytes = 2^256 possibilities), not the hash speed.
 *
 * @param rawKey - The plaintext API key (e.g. "vx_abc123...")
 * @returns Hex-encoded SHA-256 digest
 */
export function hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}
