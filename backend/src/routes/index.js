const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation.middleware');

const authCtrl = require('../controllers/auth.controller');
const intakeCtrl = require('../controllers/intake.controller');
const ocrCtrl = require('../controllers/ocr.controller');
const patientCtrl = require('../controllers/patient.controller');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth
router.post('/auth/register', authLimiter, validate(schemas.register), authCtrl.register);
router.post('/auth/login', authLimiter, validate(schemas.login), authCtrl.login);
router.post('/auth/refresh', authCtrl.refresh);

// Patient identification (no auth needed - kiosk)
router.post('/patient/identify', validate(schemas.identifyPatient), patientCtrl.identifyPatient);

// Intake sessions (no auth for patient-facing, auth for doctor-facing)
router.post('/intake/start', validate(schemas.startSession), intakeCtrl.startSession);
router.post('/intake/:sessionId/message', validate(schemas.sendMessage), intakeCtrl.sendMessage);
router.post('/intake/:sessionId/complete', intakeCtrl.completeSession);
router.get('/intake/today', authenticate, authorize('doctor'), intakeCtrl.getTodaySessions);
router.get('/intake/:sessionId', intakeCtrl.getSession);
router.put('/intake/:sessionId/summary', authenticate, authorize('doctor'), intakeCtrl.updateSummary);

// OCR (no auth - kiosk)
router.post('/ocr/scan', ocrCtrl.scanDocument);

// Access logs (doctor only)
router.get('/logs/doctor', authenticate, authorize('doctor'), async (req, res) => {
  const pool = require('../config/db');
  const result = await pool.query(
    `SELECT action_type, resource_type, resource_id, ip_address, created_at, metadata
     FROM access_logs WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  return res.status(200).json({ success: true, data: result.rows });
});

// Health check
router.get('/health', (req, res) =>
  res.status(200).json({ success: true, status: 'ok', service: 'medikiosk', ts: new Date().toISOString() })
);

module.exports = router;
