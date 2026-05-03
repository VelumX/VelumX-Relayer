import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface AuthRequest extends Request {
    userId?: string;
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://yjbsdesjzvuagcxntscd.supabase.co';

// JWKS client for ES256 tokens — caches signing keys to avoid repeated network calls
const jwks = jwksClient({
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    requestHeaders: { 'apikey': process.env.SUPABASE_ANON_KEY || '' },
    timeout: 10000,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000, // 10 min
    rateLimit: true,
    jwksRequestsPerMinute: 10,
});

function getKey(header: any, callback: any) {
    jwks.getSigningKey(header.kid, (err, key: any) => {
        if (err) {
            console.error("Relayer Auth: JWKS getSigningKey error:", err.message);
            callback(err);
            return;
        }
        callback(null, key.getPublicKey());
    });
}

export const verifySupabaseToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    // Sanity-check token length to reject obviously malformed inputs early
    if (!token || token.length < 20 || token.length > 4096) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    // Decode header WITHOUT trusting it — we use it only to detect the algorithm
    // so we can route to the correct verifier. The verifier itself enforces the alg.
    const decoded = jwt.decode(token, { complete: true }) as any;
    if (!decoded?.header?.alg) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const alg = decoded.header.alg;

    // ── Algorithm allow-list ──────────────────────────────────────────────────
    // SECURITY: We explicitly enumerate which algorithms we accept and which
    // verifier handles each. We never let the token dictate its own verification
    // method — the verifier always enforces the expected algorithm.
    // This prevents algorithm confusion attacks (e.g. RS256→HS256 downgrade).
    // ─────────────────────────────────────────────────────────────────────────

    if (alg === 'ES256') {
        // Asymmetric — verify via JWKS. Algorithm is pinned to ES256 only.
        jwt.verify(token, getKey, { algorithms: ['ES256'] }, (err, payload: any) => {
            if (err) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.userId = payload.sub;
            next();
        });

    } else if (alg === 'HS256') {
        // Symmetric — verify via shared secret. Algorithm is pinned to HS256 only.
        if (!jwtSecret) {
            console.error("Relayer Auth: SUPABASE_JWT_SECRET is not configured.");
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Supabase JWT secrets are base64-encoded — try both raw and decoded forms
        let verified = false;
        let payload: any;

        const attempts = [
            jwtSecret,
            (() => { try { return Buffer.from(jwtSecret, 'base64'); } catch { return null; } })()
        ].filter(Boolean);

        for (const secret of attempts) {
            try {
                payload = jwt.verify(token, secret as string | Buffer, { algorithms: ['HS256'] });
                verified = true;
                break;
            } catch {}
        }

        if (!verified || !payload) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.userId = payload.sub;
        next();

    } else {
        // Reject any algorithm not in our explicit allow-list (RS256, none, etc.)
        console.warn(`Relayer Auth: Rejected token with unsupported algorithm: ${alg}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
