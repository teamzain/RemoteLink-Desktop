import jwt from 'jsonwebtoken';

// In production, these should be loaded from environment variables (e.g., from AWS Secrets Manager or HashiCorp Vault).
// The architecture specifies RS256 for JWTs. 
// For local development, if keys are missing we will fall back to HS256 using a placeholder string so the app still boots.
let rawPrivate = process.env.JWT_PRIVATE_KEY || 'dummy_private_key';
let rawPublic = process.env.JWT_PUBLIC_KEY || 'dummy_public_key';

// Fix typical dotenv newline escaping issues
rawPrivate = rawPrivate.replace(/\\n/g, '\n');
rawPublic = rawPublic.replace(/\\n/g, '\n');

// Resilient fallback in case the logging wrappers (like '--- PRIVATE ---') were accidentally copied 
const extractPem = (key: string) => {
  if (key.includes('dummy')) return key;
  const match = key.match(/(-----BEGIN[\s\S]+?-----END[A-Z\s]+-----)/);
  return match ? match[1] : key;
};

const privateKey = extractPem(rawPrivate);
const publicKey = extractPem(rawPublic);

export const generateToken = (payload: object): string => {
  // Only use RS256 if the key actually looks like a PEM file
  const isPem = privateKey.includes('BEGIN PRIVATE KEY');
  const algorithm = isPem ? 'RS256' : 'HS256';
  return jwt.sign(payload, privateKey.trim(), { algorithm, expiresIn: '24h' });
};

export const verifyToken = (token: string): any => {
  const isPem = publicKey.includes('BEGIN PUBLIC KEY');
  const algorithm = isPem ? 'RS256' : 'HS256';
  return jwt.verify(token, publicKey.trim(), { algorithms: [algorithm] });
};
