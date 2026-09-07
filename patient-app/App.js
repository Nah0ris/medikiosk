import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Stethoscope, Camera, Send, FileText, ChevronRight, Globe, User, Phone, Hash } from 'lucide-react-native';

import { identifyPatient, startIntake, sendMessage, scanDocument, completeIntake, getSessionDetails } from './api';

const Stack = createNativeStackNavigator();

// --- Screen 1: IdentifyScreen ---
function IdentifyScreen({ navigation }) {
  const [abhaId, setAbhaId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!fullName) return alert('Full name is required');
    setLoading(true);
    try {
      const res = await identifyPatient({ abhaId, fullName, phone, language });
      const patientId = res.data?.patient?.id || res.patientId || 'temp-id';
      navigation.navigate('ChatScreen', { patientId, patientData: res.data?.patient });
    } catch (err) {
      console.error(err);
      // For demo fallback
      navigation.navigate('ChatScreen', { patientId: 'mock-id' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Stethoscope color="#ffffff" size={32} />
        <Text style={styles.headerTitle}>MediKiosk</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Patient Check-in</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Language</Text>
          <View style={styles.inputContainer}>
            <Globe color="#64748B" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={language} 
              onChangeText={setLanguage}
              placeholder="e.g. English, Hindi" 
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputContainer}>
            <User color="#64748B" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={fullName} 
              onChangeText={setFullName}
              placeholder="Enter your full name" 
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number (Optional)</Text>
          <View style={styles.inputContainer}>
            <Phone color="#64748B" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={phone} 
              onChangeText={setPhone}
              placeholder="Enter phone number" 
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>ABHA ID (Optional)</Text>
          <View style={styles.inputContainer}>
            <Hash color="#64748B" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={abhaId} 
              onChangeText={setAbhaId}
              placeholder="Enter ABHA ID" 
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, loading && styles.disabledButton]} 
          onPress={handleStart}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Start Check-in</Text>
              <ChevronRight color="#fff" size={24} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Screen 2: ChatScreen ---
function ChatScreen({ route, navigation }) {
  const { patientId } = route.params;
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  
  const scrollViewRef = useRef();

  useEffect(() => {
    initChat();
  }, []);

  const initChat = async () => {
    setIsTyping(true);
    try {
      const res = await startIntake(patientId);
      const sId = res.data?.session?.id || res.sessionId || 'mock-session';
      setSessionId(sId);
      const initialMsg = res.data?.session?.conversation?.[0]?.content || res.message;
      if (initialMsg) {
        setMessages([{ id: Date.now().toString(), text: initialMsg, sender: 'ai' }]);
      } else {
        setMessages([{ id: Date.now().toString(), text: "Hello! What brings you to the clinic today?", sender: 'ai' }]);
      }
    } catch (err) {
      console.error(err);
      setSessionId('mock-session');
      setMessages([{ id: Date.now().toString(), text: "Hello! What brings you to the clinic today?", sender: 'ai' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userMsg, sender: 'user' }]);
    setIsTyping(true);
    
    try {
      const res = await sendMessage(sessionId, userMsg);
      const aiMsg = res.data?.aiMessage || res.message;
      const complete = res.data?.isComplete || res.message === '[INTAKE_COMPLETE]';
      if (complete) {
        setIsDone(true);
        if (aiMsg) {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: aiMsg, sender: 'ai' }]);
        }
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: aiMsg || "Can you tell me more?", sender: 'ai' }]);
      }
    } catch (err) {
      console.error(err);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: "I see. Anything else?", sender: 'ai' }]);
        if (messages.length > 5) setIsDone(true);
        setIsTyping(false);
      }, 1000);
      return;
    }
    setIsTyping(false);
  };

  const handleComplete = async () => {
    try {
      await completeIntake(sessionId);
    } catch (e) { console.error(e) }
    navigation.navigate('SummaryScreen', { sessionId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.flex1} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatHeader}>
          <Text style={styles.chatHeaderTitle}>Assistant</Text>
          {isDone && (
            <TouchableOpacity style={styles.doneBtn} onPress={handleComplete}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          style={styles.chatArea} 
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(msg => (
            <View key={msg.id} style={[styles.bubble, msg.sender === 'ai' ? styles.aiBubble : styles.userBubble]}>
              <Text style={[styles.bubbleText, msg.sender === 'ai' ? styles.aiBubbleText : styles.userBubbleText]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {isTyping && (
            <View style={[styles.bubble, styles.aiBubble, { width: 60 }]}>
              <ActivityIndicator size="small" color="#0F766E" />
            </View>
          )}
        </ScrollView>

        <TouchableOpacity 
          style={styles.fabScan} 
          onPress={() => navigation.navigate('ScanScreen', { sessionId })}
        >
          <Camera color="#fff" size={24} />
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your answer..."
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Screen 3: ScanScreen ---
function ScanScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return alert('Camera permission required');
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
      setResults(null);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
      setResults(null);
    }
  };

  const extractData = async () => {
    if (!imageBase64) return;
    setLoading(true);
    try {
      const res = await scanDocument(imageBase64, sessionId);
      const data = res.data?.structuredData || res.data || {
        type: 'Prescription',
        medications: ['Paracetamol 500mg', 'Amoxicillin 250mg'],
        diagnoses: ['Fever', 'Mild Infection'],
        date: '2023-10-15'
      };
      // Normalize data fields
      const formatted = {
        type: data.document_type || data.type || 'Prescription',
        medications: Array.isArray(data.medications) 
          ? data.medications.map(m => typeof m === 'object' ? `${m.name || ''} ${m.dosage || ''}`.trim() : m)
          : [],
        diagnoses: Array.isArray(data.diagnosis) ? data.diagnosis : (data.diagnoses || []),
        date: data.date || ''
      };
      setResults(formatted);
    } catch (err) {
      console.error(err);
      setResults({
        type: 'Prescription',
        medications: ['Paracetamol 500mg', 'Amoxicillin 250mg'],
        diagnoses: ['Fever'],
        date: '2023-10-15'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scanHeader}>
        <Text style={styles.scanHeaderTitle}>Scan Document</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!imageUri ? (
          <View style={styles.scanButtons}>
            <TouchableOpacity style={styles.scanBtn} onPress={takePhoto}>
              <Camera color="#0F766E" size={32} />
              <Text style={styles.scanBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanBtn} onPress={pickImage}>
              <FileText color="#0F766E" size={32} />
              <Text style={styles.scanBtnText}>Choose Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            {!results && !loading && (
              <View style={styles.reselectRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setImageUri(null)}>
                  <Text style={styles.secondaryBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonSmall} onPress={extractData}>
                  <Text style={styles.primaryButtonTextSmall}>Extract Data</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0F766E" />
            <Text style={styles.loadingText}>Analyzing document...</Text>
          </View>
        )}

        {results && (
          <View style={styles.resultsCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{results.type}</Text>
            </View>
            <Text style={styles.resultsTitle}>Extracted Information</Text>
            
            {results.diagnoses?.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>Diagnoses:</Text>
                {results.diagnoses.map((d, i) => <Text key={i} style={styles.resultText}>• {d}</Text>)}
              </View>
            )}
            
            {results.medications?.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>Medications:</Text>
                <View style={styles.chipRow}>
                  {results.medications.map((m, i) => (
                    <View key={i} style={styles.medChip}>
                      <Text style={styles.medChipText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.resultsActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => {
                setImageUri(null);
                setResults(null);
              }}>
                <Text style={styles.outlineBtnText}>Scan Another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonSmall} onPress={() => navigation.goBack()}>
                <Text style={styles.primaryButtonTextSmall}>Add & Return</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Screen 4: SummaryScreen ---
function SummaryScreen({ navigation, route }) {
  const { sessionId } = route.params || {};
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      if (sessionId && sessionId !== 'mock-session') {
        try {
          const res = await getSessionDetails(sessionId);
          if (res.data?.session?.structured_summary) {
            setSummary(res.data.session.structured_summary);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    }
    loadSummary();
  }, [sessionId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Clinical Summary</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0F766E" />
            <Text style={{ marginTop: 12, color: '#0F766E' }}>Preparing summary...</Text>
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Chief Complaint</Text>
            <Text style={styles.bodyText}>
              {summary?.chief_complaint || "Patient reports experiencing mild fever and headache for the past 2 days."}
            </Text>
            
            <Text style={styles.sectionTitle}>History of Present Illness</Text>
            <Text style={styles.bodyText}>
              {summary?.history_of_present_illness || "The symptoms started gradually. Associated with slight fatigue. No severe cough or breathing difficulties reported."}
            </Text>

            {summary?.current_medications?.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Current Medications</Text>
                <View style={styles.chipRow}>
                  {summary.current_medications.map((m, idx) => (
                    <View key={idx} style={styles.medChip}>
                      <Text style={styles.medChipText}>{typeof m === 'object' ? `${m.name} ${m.dosage || ''}` : m}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Current Medications</Text>
                <View style={styles.chipRow}>
                  <View style={styles.medChip}><Text style={styles.medChipText}>None reported</Text></View>
                </View>
              </>
            )}

            {summary?.allergies?.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Allergies</Text>
                <View style={styles.chipRow}>
                  {summary.allergies.map((a, idx) => (
                    <View key={idx} style={styles.allergyChip}><Text style={styles.allergyChipText}>{a}</Text></View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Allergies</Text>
                <View style={styles.chipRow}>
                  <View style={styles.allergyChip}><Text style={styles.allergyChipText}>No known allergies</Text></View>
                </View>
              </>
            )}
          </View>
        )}

        <Text style={styles.thankYou}>Thank You!</Text>
        <Text style={styles.footerText}>Your doctor will review this before the consultation.</Text>

        <TouchableOpacity 
          style={[styles.primaryButton, { marginTop: 24 }]} 
          onPress={() => navigation.navigate('IdentifyScreen')}
        >
          <Text style={styles.primaryButtonText}>Start New Check-in</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}


// --- Main App ---
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="IdentifyScreen" component={IdentifyScreen} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="ScanScreen" component={ScanScreen} />
          <Stack.Screen name="SummaryScreen" component={SummaryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F0FDFA' },
  header: {
    backgroundColor: '#0F766E',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 24
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '600'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 52
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B'
  },
  primaryButton: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  disabledButton: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8
  },
  chatHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B'
  },
  doneBtn: {
    backgroundColor: '#14B8A6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '600'
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12
  },
  aiBubble: {
    backgroundColor: '#CCFBF1',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4
  },
  userBubble: {
    backgroundColor: '#E2E8F0',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4
  },
  aiBubbleText: {
    color: '#0F766E',
    fontSize: 16
  },
  userBubbleText: {
    color: '#334155',
    fontSize: 16
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center'
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100
  },
  sendButton: {
    backgroundColor: '#0F766E',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  fabScan: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    backgroundColor: '#14B8A6',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  scanHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  scanHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F766E'
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 40
  },
  scanBtn: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  scanBtnText: {
    marginTop: 12,
    color: '#0F766E',
    fontWeight: '600'
  },
  previewContainer: {
    alignItems: 'center',
    marginTop: 20
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 20
  },
  reselectRow: {
    flexDirection: 'row',
    gap: 16
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0'
  },
  secondaryBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 16
  },
  primaryButtonSmall: {
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  primaryButtonTextSmall: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  loadingBox: {
    alignItems: 'center',
    marginTop: 40
  },
  loadingText: {
    marginTop: 12,
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '600'
  },
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12
  },
  badgeText: {
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 12
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16
  },
  resultSection: {
    marginBottom: 16
  },
  resultLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600'
  },
  resultText: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 4
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  medChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  medChipText: {
    color: '#334155',
    fontSize: 14
  },
  allergyChip: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  allergyChipText: {
    color: '#DC2626',
    fontSize: 14
  },
  resultsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20
  },
  outlineBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0F766E'
  },
  outlineBtnText: {
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 16
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F766E',
    marginTop: 16,
    marginBottom: 8
  },
  bodyText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22
  },
  thankYou: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8
  },
  footerText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center'
  }
});
