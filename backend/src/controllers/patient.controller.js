const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * POST /api/v1/patient/identify
 * Patient enters ABHA ID or name to identify themselves
 * Creates new patient if not found
 */
async function identifyPatient(req, res) {
  const { abhaId, fullName, language, phoneNumber, dateOfBirth } = req.body;

  try {
    // Try to find by ABHA ID first
    if (abhaId) {
      const existing = await pool.query(
        'SELECT * FROM patients WHERE abha_id = $1',
        [abhaId]
      );

      if (existing.rows.length > 0) {
        // Update language preference if provided
        if (language) {
          await pool.query(
            'UPDATE patients SET language = $1 WHERE id = $2',
            [language, existing.rows[0].id]
          );
          existing.rows[0].language = language;
        }

        return res.status(200).json({
          success: true,
          data: { patient: existing.rows[0], isNew: false },
        });
      }
    }

    // Create new patient
    if (!fullName) {
      return res.status(400).json({ success: false, error: 'Full name is required for new patients' });
    }

    const result = await pool.query(
      `INSERT INTO patients (abha_id, full_name, language, phone_number, date_of_birth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [abhaId || null, fullName, language || 'en', phoneNumber || null, dateOfBirth || null]
    );

    return res.status(201).json({
      success: true,
      data: { patient: result.rows[0], isNew: true },
    });
  } catch (err) {
    logger.error('Patient identify error', err);
    return res.status(500).json({ success: false, error: 'Failed to identify patient' });
  }
}

module.exports = { identifyPatient };
