const pool = require('../config/db');
const { extractDocumentData } = require('../services/ai.service');
const logger = require('../config/logger');

/**
 * POST /api/v1/ocr/scan
 * Accept base64 image, extract structured data via GPT-4o Vision
 */
async function scanDocument(req, res) {
  const { imageBase64, sessionId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'imageBase64 is required' });
  }

  try {
    // Call AI to extract document data
    const structuredData = await extractDocumentData(imageBase64);

    // Save to DB if session provided
    let scanId = null;
    if (sessionId) {
      const result = await pool.query(
        `INSERT INTO ocr_scans (session_id, raw_ocr_text, structured_data)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [sessionId, structuredData.raw_text || '', JSON.stringify(structuredData)]
      );
      scanId = result.rows[0].id;
    }

    return res.status(200).json({
      success: true,
      data: {
        scanId,
        structuredData,
      },
    });
  } catch (err) {
    logger.error('OCR scan error', err);
    return res.status(500).json({ success: false, error: 'Failed to process document' });
  }
}

module.exports = { scanDocument };
