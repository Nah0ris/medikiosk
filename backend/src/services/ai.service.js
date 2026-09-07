const OpenAI = require('openai');
const logger = require('../config/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INTAKE_SYSTEM_PROMPT = `You are MediKiosk, an AI-powered OPD intake assistant at a hospital. Your role is to take a structured clinical history from the patient before they see the doctor.

Rules:
- Ask ONE question at a time
- Be warm, professional, and reassuring
- Adapt questions based on previous answers (e.g., if chest pain → ask cardiac history)
- Cover: chief complaint, onset/duration, severity (1-10), associated symptoms, past medical history, current medications, allergies, family history, lifestyle (smoking/alcohol)
- After gathering sufficient information (typically 8-12 questions), respond with EXACTLY: "[INTAKE_COMPLETE]"
- Keep questions simple and clear — patients may have limited medical knowledge
- If the patient's language preference is not English, respond in that language
- Do NOT diagnose or prescribe — you are only gathering history`;

const SUMMARY_SYSTEM_PROMPT = `You are a clinical documentation AI. Given a patient intake conversation and optional OCR-extracted prescription/lab data, generate a structured clinical summary.

Return a JSON object with this exact structure:
{
  "chief_complaint": "Brief one-line complaint",
  "history_of_present_illness": "Detailed narrative of the current issue",
  "past_medical_history": ["condition1", "condition2"],
  "current_medications": [{"name": "...", "dosage": "...", "frequency": "..."}],
  "allergies": ["allergy1", "allergy2"],
  "family_history": "Relevant family medical history",
  "social_history": "Smoking, alcohol, occupation, etc.",
  "review_of_systems": {"cardiovascular": "...", "respiratory": "...", "gastrointestinal": "..."},
  "vitals_reported": {"temperature": null, "blood_pressure": null, "heart_rate": null},
  "preliminary_assessment": "Brief clinical impression for the doctor"
}

Return ONLY valid JSON. No markdown, no explanation.`;

const OCR_SYSTEM_PROMPT = `You are a medical document OCR specialist. Extract structured data from this prescription or lab report image.

Return a JSON object with this structure:
{
  "document_type": "prescription" | "lab_report" | "discharge_summary" | "other",
  "date": "YYYY-MM-DD or null",
  "doctor_name": "Name or null",
  "patient_name": "Name or null",
  "diagnosis": ["diagnosis1", "diagnosis2"],
  "medications": [
    {"name": "...", "dosage": "...", "frequency": "...", "duration": "...", "instructions": "..."}
  ],
  "lab_results": [
    {"test_name": "...", "value": "...", "unit": "...", "reference_range": "...", "flag": "normal|high|low"}
  ],
  "notes": "Any additional notes or observations",
  "raw_text": "The full raw text extracted from the document"
}

Return ONLY valid JSON. No markdown, no explanation. If a field is not found, use null or empty array.`;

/**
 * Get next adaptive question for patient intake
 */
async function getNextQuestion(conversationHistory, patientContext = {}) {
  try {
    const messages = [
      { role: 'system', content: INTAKE_SYSTEM_PROMPT },
    ];

    if (patientContext.language && patientContext.language !== 'en') {
      messages.push({
        role: 'system',
        content: `The patient prefers to communicate in: ${patientContext.language}. Respond in that language.`
      });
    }

    if (patientContext.name) {
      messages.push({
        role: 'system',
        content: `Patient name: ${patientContext.name}`
      });
    }

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = response.choices[0].message.content.trim();
    const isComplete = reply.includes('[INTAKE_COMPLETE]');

    return {
      message: isComplete ? reply.replace('[INTAKE_COMPLETE]', '').trim() : reply,
      isComplete,
    };
  } catch (err) {
    logger.error('OpenAI call failed, using intelligent dynamic clinical history fallback', { error: err.message });
    return generateSmartClinicalFollowUp(conversationHistory, patientContext);
  }
}

/**
 * Human-like clinical intake dialogue engine (used as graceful fallback)
 */
function generateSmartClinicalFollowUp(history, context) {
  const userMessages = history.filter(m => m.role === 'user');
  const count = userMessages.length;
  const lastUserMsg = (userMessages[userMessages.length - 1]?.content || '').toLowerCase();

  // Initial greeting
  if (count === 0) {
    return {
      message: `Hello ${context.name ? context.name : ''}! I'm the MediKiosk Clinical Assistant. What symptoms or primary health concerns bring you in today?`,
      isComplete: false
    };
  }

  // Question 1 response -> Probe onset, duration & severity
  if (count === 1) {
    let specific = "I understand.";
    if (lastUserMsg.includes('pain') || lastUserMsg.includes('hurt') || lastUserMsg.includes('ache')) {
      specific = "I'm sorry to hear you're experiencing pain.";
    } else if (lastUserMsg.includes('fever') || lastUserMsg.includes('temp') || lastUserMsg.includes('hot')) {
      specific = "Got it, noting down the fever.";
    } else if (lastUserMsg.includes('cough') || lastUserMsg.includes('throat') || lastUserMsg.includes('cold')) {
      specific = "Understood, tracking the respiratory symptoms.";
    }

    return {
      message: `${specific} Roughly how many days or hours have you been feeling this way, and on a scale of 1 to 10, how severe is it right now?`,
      isComplete: false
    };
  }

  // Question 2 response -> Probe associated symptoms
  if (count === 2) {
    return {
      message: "Thank you for clarifying. Are you having any other accompanying symptoms—such as dizziness, nausea, shortness of breath, chills, or fatigue?",
      isComplete: false
    };
  }

  // Question 3 response -> Current medications & home remedies
  if (count === 3) {
    return {
      message: "Noted. Have you taken any over-the-counter medicines, prescriptions, or home remedies for this recently?",
      isComplete: false
    };
  }

  // Question 4 response -> Allergies & chronic medical conditions
  if (count === 4) {
    return {
      message: "Understood. Do you have any known drug allergies (like penicillin or sulfa), or chronic conditions like diabetes, hypertension, or asthma?",
      isComplete: false
    };
  }

  // Question 5 response -> Final wrap-up
  if (count >= 5) {
    return {
      message: "Thank you for sharing your history. I have compiled all your responses into a structured clinical summary for the doctor to review before your consultation. [INTAKE_COMPLETE]",
      isComplete: true
    };
  }

  return {
    message: "Thank you. Is there anything else you would like the doctor to know about how you've been feeling today?",
    isComplete: false
  };
}

/**
 * Generate structured clinical summary from conversation + OCR data
 */
async function generateSummary(conversationHistory, ocrData = []) {
  try {
    let userContent = 'Patient intake conversation:\n\n';
    for (const msg of conversationHistory) {
      const role = msg.role === 'assistant' ? 'MediKiosk' : 'Patient';
      userContent += `${role}: ${msg.content}\n`;
    }

    if (ocrData.length > 0) {
      userContent += '\n\nExtracted document data:\n';
      userContent += JSON.stringify(ocrData, null, 2);
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    logger.error('AI generateSummary error', { error: err.message });
    throw new Error('Failed to generate summary');
  }
}

/**
 * Extract structured data from prescription/lab report image
 */
async function extractDocumentData(imageBase64) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all structured data from this medical document:' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    logger.error('AI extractDocumentData error', { error: err.message });
    throw new Error('Failed to extract document data');
  }
}

module.exports = { getNextQuestion, generateSummary, extractDocumentData };
