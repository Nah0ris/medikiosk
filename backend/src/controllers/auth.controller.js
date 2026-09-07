const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { issueTokens, verifyRefreshToken } = require('../middleware/auth.middleware');
const logger = require('../config/logger');

async function register(req, res) {
  const { email, password, fullName, specialty, hospitalName } = req.validated.body;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, specialty, hospital_name)
       VALUES ($1, $2, $3, 'doctor', $4, $5)
       RETURNING id, email, full_name, role, specialty, hospital_name, created_at`,
      [email, passwordHash, fullName, specialty || null, hospitalName || null]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = issueTokens(user.id, user.role);

    logger.info(`New doctor registered: ${user.id}`);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          specialty: user.specialty,
          hospitalName: user.hospital_name,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Register error', err);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
}

async function login(req, res) {
  const { email, password } = req.validated.body;

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, role, is_active, full_name, specialty, hospital_name
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      await bcrypt.compare(password, '$2a$12$invalidhashpaddingtomatchtime0000000000000000000000000000');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account suspended' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const { accessToken, refreshToken } = issueTokens(user.id, user.role);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          specialty: user.specialty,
          hospitalName: user.hospital_name,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Login error', err);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
}

async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const userResult = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1', [payload.sub]
    );

    if (!userResult.rows[0]?.is_active) {
      return res.status(401).json({ success: false, error: 'Account inactive' });
    }

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(payload.sub, payload.role);

    return res.status(200).json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}

module.exports = { register, login, refresh };
