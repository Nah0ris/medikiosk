const pool = require('../config/db');
const { getNextQuestion, generateSummary } = require('../services/ai.service');
const { logAccess } = require('../middleware/accessLog.middleware');
const logger = require('../config/logger');

/**
 * POST /api/v1/intake/start
 * Start a new intake session for a patient
 */
async function startSession(req, res) {
  const { patientId } = req.body;

  try {
    // Verify patient exists
    const patient = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patient.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const patientData = patient.rows[0];

    // Get first question from AI
    const { message } = await getNextQuestion([], {
      name: patientData.full_name,
      language: patientData.language,
    });

    const initialConversation = [
      { role: 'assistant', content: message, timestamp: new Date().toISOString() },
    ];

    // Create session
    const result = await pool.query(
      `INSERT INTO intake_sessions (patient_id, conversation)
       VALUES ($1, $2)
       RETURNING id, status, conversation, created_at`,
      [patientId, JSON.stringify(initialConversation)]
    );

    return res.status(201).json({
      success: true,
      data: {
        session: result.rows[0],
        patient: { id: patientData.id, name: patientData.full_name, language: patientData.language },
      },
    });
  } catch (err) {
    logger.error('Start session error', err);
    return res.status(500).json({ success: false, error: 'Failed to start session' });
  }
}

/**
 * POST /api/v1/intake/:sessionId/message
 * Patient sends a message, AI responds with next question
 */
async function sendMessage(req, res) {
  const { sessionId } = req.params;
  const { message } = req.body;

  try {
    // Get current session
    const session = await pool.query(
      `SELECT s.*, p.full_name, p.language FROM intake_sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.id = $1 AND s.status = 'in_progress'`,
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found or already completed' });
    }

    const sessionData = session.rows[0];
    const conversation = sessionData.conversation || [];

    // Add patient message
    conversation.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Get AI response
    const aiResponse = await getNextQuestion(conversation, {
      name: sessionData.full_name,
      language: sessionData.language,
    });

    // Add AI response to conversation
    conversation.push({
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date().toISOString(),
    });

    // Update session
    const newStatus = aiResponse.isComplete ? 'completed' : 'in_progress';
    await pool.query(
      `UPDATE intake_sessions SET conversation = $1, status = $2 WHERE id = $3`,
      [JSON.stringify(conversation), newStatus, sessionId]
    );

    // If complete, auto-generate summary
    let summary = null;
    if (aiResponse.isComplete) {
      try {
        // Get OCR data for this session
        const ocrResult = await pool.query(
          'SELECT structured_data FROM ocr_scans WHERE session_id = $1',
          [sessionId]
        );
        const ocrData = ocrResult.rows.map(r => r.structured_data).filter(Boolean);

        summary = await generateSummary(conversation, ocrData);
        await pool.query(
          `UPDATE intake_sessions SET structured_summary = $1, chief_complaint = $2 WHERE id = $3`,
          [JSON.stringify(summary), summary.chief_complaint || null, sessionId]
        );
      } catch (summaryErr) {
        logger.error('Auto-summary generation failed', summaryErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        aiMessage: aiResponse.message,
        isComplete: aiResponse.isComplete,
        summary,
      },
    });
  } catch (err) {
    logger.error('Send message error', err);
    return res.status(500).json({ success: false, error: 'Failed to process message' });
  }
}

/**
 * POST /api/v1/intake/:sessionId/complete
 * Force-complete a session and generate summary
 */
async function completeSession(req, res) {
  const { sessionId } = req.params;

  try {
    const session = await pool.query(
      'SELECT * FROM intake_sessions WHERE id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const sessionData = session.rows[0];
    const conversation = sessionData.conversation || [];

    // Get OCR data
    const ocrResult = await pool.query(
      'SELECT structured_data FROM ocr_scans WHERE session_id = $1',
      [sessionId]
    );
    const ocrData = ocrResult.rows.map(r => r.structured_data).filter(Boolean);

    // Generate summary
    const summary = await generateSummary(conversation, ocrData);

    await pool.query(
      `UPDATE intake_sessions
       SET status = 'completed', structured_summary = $1, chief_complaint = $2
       WHERE id = $3`,
      [JSON.stringify(summary), summary.chief_complaint || null, sessionId]
    );

    return res.status(200).json({
      success: true,
      data: { summary },
    });
  } catch (err) {
    logger.error('Complete session error', err);
    return res.status(500).json({ success: false, error: 'Failed to complete session' });
  }
}

/**
 * GET /api/v1/intake/:sessionId
 * Get session details (for doctor view)
 */
async function getSession(req, res) {
  const { sessionId } = req.params;

  try {
    const result = await pool.query(
      `SELECT s.*, p.full_name as patient_name, p.abha_id, p.date_of_birth, p.language
       FROM intake_sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Get OCR scans
    const ocrResult = await pool.query(
      'SELECT id, structured_data, raw_ocr_text, created_at FROM ocr_scans WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );

    if (req.user) {
      await logAccess(req, 'view_intake', 'intake_session', sessionId);
    }

    return res.status(200).json({
      success: true,
      data: {
        session: result.rows[0],
        ocrScans: ocrResult.rows,
      },
    });
  } catch (err) {
    logger.error('Get session error', err);
    return res.status(500).json({ success: false, error: 'Failed to get session' });
  }
}

/**
 * PUT /api/v1/intake/:sessionId/summary
 * Doctor edits the structured summary
 */
async function updateSummary(req, res) {
  const { sessionId } = req.params;
  const { summary } = req.body;

  try {
    const result = await pool.query(
      `UPDATE intake_sessions
       SET structured_summary = $1, doctor_id = $2, status = 'reviewed'
       WHERE id = $3
       RETURNING id, status, updated_at`,
      [JSON.stringify(summary), req.user.id, sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    await logAccess(req, 'edit_summary', 'intake_session', sessionId);

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('Update summary error', err);
    return res.status(500).json({ success: false, error: 'Failed to update summary' });
  }
}

/**
 * GET /api/v1/intake/today
 * Get today's intake sessions (for doctor dashboard)
 */
async function getTodaySessions(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.status, s.chief_complaint, s.created_at, s.updated_at,
              p.full_name as patient_name, p.abha_id
       FROM intake_sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.created_at >= CURRENT_DATE
       ORDER BY s.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('Get today sessions error', err);
    return res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
}

module.exports = { startSession, sendMessage, completeSession, getSession, updateSummary, getTodaySessions };
