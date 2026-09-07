/**
 * JWT Auth Middleware
 * Validates access tokens, attaches user to req
 */

const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * Verify JWT and attach user to request
 * Rejects expired, invalid, or revoked tokens
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  // Check if token is revoked (stored in blacklist or check user active status)
  const userResult = await pool.query(
    `SELECT id, email, role, is_active FROM users WHERE id = $1`,
    [payload.sub]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    return res.status(401).json({ success: false, error: 'Account not found or inactive' });
  }

  req.user = userResult.rows[0];
  req.tokenPayload = payload;
  next();
}

/**
 * Role-based authorization
 * Usage: authorize('doctor'), authorize('patient'), authorize('doctor', 'admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized role access: user ${req.user.id} (${req.user.role}) tried ${req.method} ${req.path}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied: insufficient permissions',
      });
    }

    next();
  };
}

/**
 * Issue new access + refresh token pair
 */
function issueTokens(userId, role) {
  const accessToken = jwt.sign(
    { sub: userId, role, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { sub: userId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { authenticate, authorize, issueTokens, verifyRefreshToken };
