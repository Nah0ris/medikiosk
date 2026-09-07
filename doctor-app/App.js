import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, FlatList, ActivityIndicator, Alert, RefreshControl,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  Stethoscope, Clock, User, FileText, Edit, Check,
  LogOut, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Pill, Heart, Activity
} from 'lucide-react-native';

import { loginDoctor, getTodaySessions, getSession, updateSummary, logout } from './api';

const Stack = createNativeStackNavigator();

// Define colors
const COLORS = {
  primary: '#1E40AF',
  secondary: '#3B82F6',
  background: '#EFF6FF',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  text: '#1E293B',
  textLight: '#64748B',
  white: '#FFFFFF',
  border: '#E2E8F0',
};

// --- SCREENS ---

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
      
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        navigation.replace('Home');
      }
    })();
  }, [navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      const res = await loginDoctor(email, password);
      if (res.success) {
        navigation.replace('Home');
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid credentials');
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const savedEmail = await SecureStore.getItemAsync('savedEmail');
      const savedPassword = await SecureStore.getItemAsync('savedPassword');
      
      if (!savedEmail || !savedPassword) {
        Alert.alert('Info', 'Please login with email and password first to enable biometric login');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with Biometrics',
        fallbackLabel: 'Use password',
      });

      if (result.success) {
        setLoading(true);
        const res = await loginDoctor(savedEmail, savedPassword);
        if (res.success) {
          navigation.replace('Home');
        } else {
          Alert.alert('Login Failed', 'Session expired, please login manually');
        }
        setLoading(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.loginContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Stethoscope size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.brandTitle}>MediKiosk</Text>
          <Text style={styles.brandSubtitle}>Doctor Portal</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="dr.smith@medikiosk.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {isBiometricSupported && (
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Use Biometrics</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorName, setDoctorName] = useState('Doctor');

  const fetchSessions = useCallback(async () => {
    try {
      const res = await getTodaySessions();
      if (res.success) {
        setSessions(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const userStr = await SecureStore.getItemAsync('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setDoctorName(user.name || 'Doctor');
      }
    })();
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={styles.headerTitle}>Today's Patients</Text>
          <Text style={styles.headerSubtitle}>Dr. {doctorName}</Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
          <LogOut size={24} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, doctorName]);

  const renderStatusBadge = (status) => {
    let color, text;
    switch (status) {
      case 'in_progress':
        color = COLORS.warning;
        text = 'In Progress';
        break;
      case 'completed':
        color = COLORS.success;
        text = 'Completed';
        break;
      case 'reviewed':
        color = COLORS.secondary;
        text = 'Reviewed';
        break;
      default:
        color = COLORS.textLight;
        text = status;
    }
    return (
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const pName = item.patient_name || item.patientName || 'Unknown Patient';
    const abha = item.abha_id || item.abhaId;
    const complaint = item.chief_complaint || item.summary?.chiefComplaint || 'No chief complaint recorded';
    const timestamp = item.updated_at || item.created_at || item.updatedAt || item.createdAt || new Date();

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id, patientName: pName })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <User size={20} color={COLORS.textLight} />
            <Text style={styles.cardTitle}>{pName}</Text>
          </View>
          {renderStatusBadge(item.status)}
        </View>
        
        {abha ? (
          <Text style={styles.cardSubText}>ABHA: {abha}</Text>
        ) : null}
        
        <View style={styles.cardBody}>
          <Text style={styles.chiefComplaint} numberOfLines={1}>
            {complaint}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <Clock size={14} color={COLORS.textLight} />
          <Text style={styles.timeText}>{new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Clock size={64} color={COLORS.border} />
          <Text style={styles.emptyStateTitle}>No patients checked in yet today</Text>
          <Text style={styles.emptyStateText}>Pull down to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

function SessionDetailScreen({ route, navigation }) {
  const { sessionId, patientName } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editableSummary, setEditableSummary] = useState({});
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: patientName || 'Patient Details' });
    fetchSessionDetails();
  }, []);

  const fetchSessionDetails = async () => {
    try {
      const res = await getSession(sessionId);
      if (res.success) {
        const rawSession = res.data.session || res.data;
        const summary = rawSession.structured_summary || rawSession.summary || {};
        const normalized = {
          ...rawSession,
          patientName: rawSession.patient_name || rawSession.patientName || patientName,
          summary: {
            chiefComplaint: summary.chief_complaint || summary.chiefComplaint || rawSession.chief_complaint,
            historyOfPresentIllness: summary.history_of_present_illness || summary.historyOfPresentIllness,
            pastMedicalHistory: Array.isArray(summary.past_medical_history) ? summary.past_medical_history.join(', ') : (summary.pastMedicalHistory || ''),
            currentMedications: Array.isArray(summary.current_medications) 
              ? summary.current_medications.map(m => typeof m === 'object' ? `${m.name} ${m.dosage || ''}`.trim() : m).join(', ')
              : (summary.currentMedications || ''),
            allergies: Array.isArray(summary.allergies) ? summary.allergies.join(', ') : (summary.allergies || ''),
            preliminaryAssessment: summary.preliminary_assessment || summary.preliminaryAssessment,
          },
          scannedDocuments: (res.data.ocrScans || rawSession.scannedDocuments || []).map(d => ({
            type: d.structured_data?.document_type || d.type || 'Document',
            extractedText: d.raw_ocr_text || d.extractedText || JSON.stringify(d.structured_data || '')
          })),
          transcript: rawSession.conversation || rawSession.transcript || []
        };
        setSession(normalized);
        setEditableSummary(normalized.summary);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateSummary(sessionId, editableSummary);
      if (res.success) {
        setSession({ ...session, summary: editableSummary, status: 'reviewed' });
        setIsEditing(false);
        Alert.alert('Success', 'Summary saved successfully');
      } else {
        Alert.alert('Error', res.message || 'Failed to save');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save summary');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const summary = isEditing ? editableSummary : (session.summary || {});

  const updateField = (field, value) => {
    setEditableSummary(prev => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.detailScrollContainer}>
        
        {/* Status Banner */}
        <View style={styles.detailHeader}>
          <View style={styles.detailTitleRow}>
            <Text style={styles.detailPatientName}>{session.patientName}</Text>
            <View style={[
              styles.badge, 
              { backgroundColor: session.status === 'completed' ? COLORS.success : session.status === 'reviewed' ? COLORS.secondary : COLORS.warning }
            ]}>
              <Text style={styles.badgeText}>
                {session.status === 'completed' ? 'Ready for Review' : session.status === 'reviewed' ? 'Reviewed' : 'In Progress'}
              </Text>
            </View>
          </View>
        </View>

        {/* Clinical Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Clinical Summary</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Chief Complaint</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.chiefComplaint || ''}
                onChangeText={(t) => updateField('chiefComplaint', t)}
                multiline
              />
            ) : (
              <Text style={styles.fieldValueBold}>{summary.chiefComplaint || 'None recorded'}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>History of Present Illness</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.historyOfPresentIllness || ''}
                onChangeText={(t) => updateField('historyOfPresentIllness', t)}
                multiline
              />
            ) : (
              <Text style={styles.fieldValue}>{summary.historyOfPresentIllness || 'None recorded'}</Text>
            )}
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Past Medical History</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.pastMedicalHistory || ''}
                onChangeText={(t) => updateField('pastMedicalHistory', t)}
                multiline
              />
            ) : (
              <Text style={styles.fieldValue}>{summary.pastMedicalHistory || 'None recorded'}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Current Medications</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.currentMedications || ''}
                onChangeText={(t) => updateField('currentMedications', t)}
                multiline
              />
            ) : (
              <View style={styles.chipsContainer}>
                {summary.currentMedications ? summary.currentMedications.split(',').map((med, i) => (
                  <View key={i} style={styles.chip}>
                    <Pill size={14} color={COLORS.secondary} />
                    <Text style={styles.chipText}>{med.trim()}</Text>
                  </View>
                )) : <Text style={styles.fieldValue}>None recorded</Text>}
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Allergies</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.allergies || ''}
                onChangeText={(t) => updateField('allergies', t)}
                multiline
              />
            ) : (
              <View style={styles.chipsContainer}>
                {summary.allergies && summary.allergies !== 'None' ? summary.allergies.split(',').map((allergy, i) => (
                  <View key={i} style={styles.chipAlert}>
                    <AlertCircle size={14} color={COLORS.error} />
                    <Text style={styles.chipAlertText}>{allergy.trim()}</Text>
                  </View>
                )) : <Text style={styles.fieldValue}>None recorded</Text>}
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Preliminary Assessment</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={summary.preliminaryAssessment || ''}
                onChangeText={(t) => updateField('preliminaryAssessment', t)}
                multiline
              />
            ) : (
              <View style={styles.highlightBox}>
                <Text style={styles.highlightText}>{summary.preliminaryAssessment || 'None recorded'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Scanned Documents */}
        {session.scannedDocuments && session.scannedDocuments.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Activity size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Scanned Documents ({session.scannedDocuments.length})</Text>
            </View>
            {session.scannedDocuments.map((doc, index) => (
              <View key={index} style={styles.documentCard}>
                <Text style={styles.documentType}>{doc.type || 'Document'}</Text>
                <Text style={styles.documentSummary} numberOfLines={2}>{doc.extractedText}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Transcript Section */}
        <View style={styles.sectionCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setTranscriptExpanded(!transcriptExpanded)}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.sectionTitle}>AI Conversation Transcript</Text>
            </View>
            {transcriptExpanded ? <ChevronUp size={20} color={COLORS.text} /> : <ChevronDown size={20} color={COLORS.text} />}
          </TouchableOpacity>

          {transcriptExpanded && (
            <View style={styles.transcriptContainer}>
              {session.transcript && session.transcript.length > 0 ? (
                session.transcript.map((msg, index) => (
                  <View key={index} style={[
                    styles.messageBubble,
                    msg.role === 'assistant' ? styles.messageAI : styles.messagePatient
                  ]}>
                    <Text style={[
                      styles.messageText,
                      msg.role === 'assistant' ? styles.messageTextAI : styles.messageTextPatient
                    ]}>
                      {msg.content}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.textLight}>No transcript available</Text>
              )}
            </View>
          )}
        </View>
        
        {/* Padding for bottom */}
        <View style={{height: 100}} />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        {isEditing ? (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1}]}
              onPress={() => {
                setIsEditing(false);
                setEditableSummary(session.summary || {});
              }}
            >
              <Text style={[styles.actionButtonText, {color: COLORS.text}]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: COLORS.primary, flex: 2, marginLeft: 10}]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Check size={20} color={COLORS.white} style={{marginRight: 8}} />
                  <Text style={[styles.actionButtonText, {color: COLORS.white}]}>Save Summary</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: COLORS.white, borderColor: COLORS.primary, borderWidth: 1, flex: 1, marginRight: 10}]}
              onPress={() => setIsEditing(true)}
            >
              <Edit size={20} color={COLORS.primary} style={{marginRight: 8}} />
              <Text style={[styles.actionButtonText, {color: COLORS.primary}]}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: COLORS.success, flex: 2}]}
              onPress={handleSave} // To just mark as reviewed using current summary
            >
              <Check size={20} color={COLORS.white} style={{marginRight: 8}} />
              <Text style={[styles.actionButtonText, {color: COLORS.white}]}>Mark Reviewed</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// --- APP COMPONENT ---

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.white },
          headerTintColor: COLORS.primary,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'Today\'s Patients' }} 
        />
        <Stack.Screen 
          name="SessionDetail" 
          component={SessionDetailScreen} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- STYLES ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Login Styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(30, 64, 175, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  brandSubtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Home Styles
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  cardSubText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 8,
    marginLeft: 28,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardBody: {
    marginTop: 8,
    marginBottom: 12,
  },
  chiefComplaint: {
    fontSize: 14,
    color: COLORS.text,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  // Detail Styles
  detailScrollContainer: {
    padding: 16,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailPatientName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  fieldValueBold: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  editInput: {
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  chipAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipAlertText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '500',
    marginLeft: 4,
  },
  highlightBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  highlightText: {
    fontSize: 15,
    color: '#92400E',
    fontWeight: '500',
  },
  
  // Document Styles
  documentCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  documentType: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  documentSummary: {
    fontSize: 14,
    color: COLORS.text,
  },

  // Transcript Styles
  transcriptContainer: {
    marginTop: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageAI: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messagePatient: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextAI: {
    color: COLORS.text,
  },
  messageTextPatient: {
    color: COLORS.white,
  },
  
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  }
});
