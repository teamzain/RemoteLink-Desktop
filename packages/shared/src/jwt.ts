import jwt from 'jsonwebtoken';

// In production, these should be loaded from environment variables.
// The architecture specifies RS256 for JWTs. 
// Fallback to HS256 for local development.
let rawPrivate = process.env.JWT_PRIVATE_KEY || 'dummy_private_key';
let rawPublic = process.env.JWT_PUBLIC_KEY || 'dummy_public_key';

// Fix typical dotenv newline escaping issues
rawPrivate = rawPrivate.replace(/\\n/g, '\n');
rawPublic = rawPublic.replace(/\\n/g, '\n');

const extractPem = (key: string) => {
  if (key.includes('dummy')) return key;
  const match = key.match(/(-----BEGIN[\s\S]+?-----END[A-Z\s]+-----)/);
  return match ? match[1] : key;
};

const privateKey = extractPem(rawPrivate);
const publicKey = extractPem(rawPublic);

export const generateToken = (payload: object, expiresIn: any = '24h'): string => {
  const isPem = privateKey.includes('BEGIN PRIVATE KEY');
  const algorithm = isPem ? 'RS256' : 'HS256';
  return jwt.sign(payload, privateKey.trim(), { algorithm, expiresIn });
};

export const verifyToken = (token: string): any => {
  const isPem = publicKey.includes('BEGIN PUBLIC KEY');
  const algorithm = isPem ? 'RS256' : 'HS256';
  // HS256 is symmetric; it must use the same secret (privateKey) for both signing and verifying
  const secret = isPem ? publicKey.trim() : privateKey.trim();
  
  try {
    const decoded = jwt.verify(token, secret, { algorithms: [algorithm] });
    return decoded;
  } catch (e: any) {
    console.error(`[JWT] Verification failed (${algorithm}):`, e.message);
    return null;
  }
};
