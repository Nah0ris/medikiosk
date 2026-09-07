import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001/api/v1';

async function getAuthHeaders() {
  const token = await SecureStore.getItemAsync('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export async function loginDoctor(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.success) {
    await SecureStore.setItemAsync('accessToken', data.data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.data.user));
  }
  return data;
}

export async function getTodaySessions() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/intake/today`, { headers });
  return res.json();
}

export async function getSession(sessionId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/intake/${sessionId}`, { headers });
  return res.json();
}

export async function updateSummary(sessionId, summary) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/intake/${sessionId}/summary`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ summary }),
  });
  return res.json();
}

export async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
}
