/**
 * Access Log Middleware
 * Logs all authenticated API access to DB for audit trail
 * Especially important for PHI (Protected Health Information) access
 */

const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * Log PHI access to database (for sensitive endpoints)
 */
async function logAccess(req, actionType, resourceType, resourceId, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO access_logs 
       (user_id, user_role, action_type, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user?.id || null,
        req.user?.role || 'anonymous',
        actionType,
        resourceType,
        resourceId,
        req.ip,
        req.headers['user-agent']?.substring(0, 500),
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    // Log failure to logger but don't crash the request
    logger.error('Failed to write access log', { error: err.message });
  }
}

/**
 * HTTP request logger middleware (logs all requests)
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      user: req.user?.id || 'anonymous',
    });
  });

  next();
}

module.exports = { logAccess, requestLogger };
