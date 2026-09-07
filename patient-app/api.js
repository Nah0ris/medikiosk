import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001/api/v1';

export async function identifyPatient(data) {
  const res = await fetch(`${API_URL}/patient/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function startIntake(patientId) {
  const res = await fetch(`${API_URL}/intake/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId }),
  });
  return res.json();
}

export async function sendMessage(sessionId, message) {
  const res = await fetch(`${API_URL}/intake/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function completeIntake(sessionId) {
  const res = await fetch(`${API_URL}/intake/${sessionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function scanDocument(imageBase64, sessionId) {
  const res = await fetch(`${API_URL}/ocr/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, sessionId }),
  });
  return res.json();
}

export async function getSessionDetails(sessionId) {
  const res = await fetch(`${API_URL}/intake/${sessionId}`);
  return res.json();
}
