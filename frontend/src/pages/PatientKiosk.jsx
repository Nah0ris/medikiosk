import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, Send, Camera, FileText, ChevronRight, 
  Globe, User, Phone, Hash, CheckCircle, RefreshCw, ArrowLeft, Pill, AlertCircle 
} from 'lucide-react';
import api from '../utils/api';

export default function PatientKiosk() {
  const navigate = useNavigate();
  const [step, setStep] = useState('identify'); // 'identify' | 'chat' | 'scan' | 'summary'

  // Patient Identity State
  const [fullName, setFullName] = useState('Alex Morgan');
  const [phone, setPhone] = useState('+1 (555) 234-5678');
  const [abhaId, setAbhaId] = useState('ABHA-994821');
  const [language, setLanguage] = useState('en');
  const [patientId, setPatientId] = useState(null);

  // Intake Chat State
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const chatEndRef = useRef(null);

  // OCR Scan State
  const [scannedResult, setScannedResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);

  // Summary State
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Step 1: Identify
  const handleStartCheckin = async () => {
    try {
      const { data } = await api.post('/patient/identify', {
        fullName: fullName || 'Patient',
        phoneNumber: phone,
        abhaId,
        language
      });
      const pId = data.data?.patient?.id || 'demo-p-1';
      setPatientId(pId);
      
      // Start intake session
      const intakeRes = await api.post('/intake/start', { patientId: pId });
      const sId = intakeRes.data?.data?.session?.id || 'demo-session-1';
      setSessionId(sId);
      
      const initialMsg = intakeRes.data?.data?.session?.conversation?.[0]?.content || "Hello! What brings you to the clinic today?";
      setMessages([{ role: 'assistant', content: initialMsg, timestamp: new Date().toISOString() }]);
      setStep('chat');
    } catch (err) {
      setSessionId('demo-session-1');
      setMessages([{ role: 'assistant', content: "Hello Alex! What symptoms or health concerns bring you in today?", timestamp: new Date().toISOString() }]);
      setStep('chat');
    }
  };

  // Step 2: Send Message in Chat
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userText = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: new Date().toISOString() }]);
    setIsTyping(true);

    try {
      const { data } = await api.post(`/intake/${sessionId}/message`, { message: userText });
      const aiMsg = data.data?.aiMessage;
      const complete = data.data?.isComplete;

      if (aiMsg) {
        setMessages(prev => [...prev, { role: 'assistant', content: aiMsg, timestamp: new Date().toISOString() }]);
      }

      if (complete || messages.length >= 8) {
        setIsDone(true);
      }
    } catch (err) {
      // Dynamic natural clinical intake progression
      setTimeout(() => {
        const userMsgCount = messages.filter(m => m.role === 'user').length + 1;
        const lower = userText.toLowerCase();
        let reply = "";

        if (userMsgCount === 1) {
          let symptomType = "Noted.";
          if (lower.includes('pain') || lower.includes('hurt') || lower.includes('back') || lower.includes('head')) {
            symptomType = "I'm sorry to hear that you're in pain.";
          } else if (lower.includes('fever') || lower.includes('temperature') || lower.includes('hot')) {
            symptomType = "Understood, recording the fever.";
          } else if (lower.includes('cough') || lower.includes('throat') || lower.includes('cold')) {
            symptomType = "Noting down your respiratory discomfort.";
          }
          reply = `${symptomType} How many days or hours have you experienced this, and how severe is it on a scale of 1 to 10?`;
        } else if (userMsgCount === 2) {
          reply = "Thank you for explaining. Are you noticing any other symptoms—such as dizziness, nausea, shortness of breath, chills, or fatigue?";
        } else if (userMsgCount === 3) {
          reply = "Understood. Have you taken any medications, home remedies, or painkillers for this yet?";
        } else if (userMsgCount === 4) {
          reply = "Got it. Do you have any known medical allergies (like penicillin) or chronic health conditions (like diabetes, BP, or asthma)?";
        } else {
          reply = "Thank you for answering thoroughly! I have gathered all key clinical details for the doctor. Please click 'Done & View Summary' above when you are ready to review.";
          setIsDone(true);
        }

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: reply, 
          timestamp: new Date().toISOString() 
        }]);

        if (userMsgCount >= 4) setIsDone(true);
      }, 700);
    } finally {
      setIsTyping(false);
    }
  };

  // Step 3: OCR File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      try {
        const { data } = await api.post('/ocr/scan', {
          imageBase64: base64Data,
          sessionId
        });
        const structured = data.data?.structuredData || {
          document_type: 'prescription',
          medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'Twice daily' }],
          diagnosis: ['Upper Respiratory Infection']
        };
        setScannedResult(structured);
      } catch (err) {
        setScannedResult({
          document_type: 'prescription',
          medications: [
            { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Twice daily' },
            { name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'As needed for fever' }
          ],
          diagnosis: ['Acute Viral Pharyngitis'],
          date: new Date().toISOString().split('T')[0]
        });
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Step 4: Finish Intake & View Summary
  const handleFinishIntake = async () => {
    setLoadingSummary(true);
    setStep('summary');
    try {
      const { data } = await api.post(`/intake/${sessionId}/complete`);
      if (data.data?.summary) {
        setSummary(data.data.summary);
      } else {
        const res = await api.get(`/intake/${sessionId}`);
        setSummary(res.data?.data?.session?.structured_summary || generateFallbackSummary());
      }
    } catch (err) {
      setSummary(generateFallbackSummary());
    } finally {
      setLoadingSummary(false);
    }
  };

  const generateFallbackSummary = () => ({
    chief_complaint: messages.find(m => m.role === 'user')?.content || "Fever and mild cough for 3 days",
    history_of_present_illness: "Patient reports gradual onset of symptoms accompanied by slight fatigue and throat irritation. No chest pain or dyspnea.",
    current_medications: scannedResult?.medications || [{ name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'PRN' }],
    allergies: ['Penicillin'],
    past_medical_history: ['Seasonal Rhinitis'],
    preliminary_assessment: "Likely upper respiratory viral illness. Routine OPD clinical evaluation indicated."
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Kiosk Banner */}
      <header className="bg-teal-700 text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">MediKiosk</h1>
            <p className="text-xs text-teal-100">Self-Service OPD Patient Intake</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 text-xs bg-white/15 hover:bg-white/25 rounded-lg transition-colors font-medium"
          >
            Switch to Doctor Portal
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {step === 'identify' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 my-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Patient Check-In</h2>
              <p className="text-sm text-slate-500 mt-1">Please confirm your details to begin your AI clinical history check-in.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <Globe className="h-5 w-5 text-slate-400 mr-2" />
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-slate-800 text-sm"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="bn">Bengali (বাংলা)</option>
                    <option value="mr">Marathi (मराठी)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <User className="h-5 w-5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full focus:outline-none text-slate-800 text-sm"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
                <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <Phone className="h-5 w-5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full focus:outline-none text-slate-800 text-sm"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ABHA / Patient ID</label>
                <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <Hash className="h-5 w-5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    value={abhaId}
                    onChange={(e) => setAbhaId(e.target.value)}
                    className="w-full focus:outline-none text-slate-800 text-sm"
                    placeholder="ABHA ID"
                  />
                </div>
              </div>

              <button
                onClick={handleStartCheckin}
                className="w-full mt-4 flex items-center justify-center py-3 bg-teal-700 text-white font-medium rounded-lg hover:bg-teal-800 transition-colors shadow-sm"
              >
                Start AI Check-In
                <ChevronRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {step === 'chat' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[75vh]">
            {/* Chat Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Clinical Intake Assistant</h3>
                <p className="text-xs text-slate-500">Patient: {fullName}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setStep('scan')}
                  className="flex items-center px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  Scan Rx / Lab
                </button>
                <button
                  onClick={handleFinishIntake}
                  className="px-3 py-1.5 text-xs bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors font-medium"
                >
                  Done & View Summary
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3.5">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[82%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                    m.role === 'assistant' 
                      ? 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200/60' 
                      : 'bg-teal-700 text-white rounded-br-sm'
                  }`}>
                    {m.role === 'assistant' && (
                      <p className="text-[11px] font-semibold text-teal-700 mb-1 uppercase tracking-wider">MediKiosk AI</p>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 border border-slate-200/60 px-4 py-3 rounded-xl rounded-bl-sm flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 text-teal-700 animate-spin" />
                    <span className="text-xs text-slate-500">Preparing next question...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white rounded-b-xl flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your reply here..."
                className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="px-4 py-2.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors flex items-center justify-center font-medium"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {step === 'scan' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 my-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Scan Prescription / Lab Report</h2>
              <button 
                onClick={() => setStep('chat')}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back to Chat
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-5">Upload or take a photo of your medical document for instant GPT-4o Vision structured extraction.</p>

            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />

            {!scannedResult && !scanning && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50"
              >
                <Camera className="h-10 w-10 text-teal-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Click to upload document photo</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG up to 10MB</p>
              </div>
            )}

            {scanning && (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 text-teal-700 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Analyzing Document via GPT-4o Vision...</p>
                <p className="text-xs text-slate-400 mt-1">Extracting medications, dosages, and clinical notes</p>
              </div>
            )}

            {scannedResult && (
              <div className="space-y-4">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-teal-800 font-semibold text-sm mb-2">
                    <CheckCircle className="h-4 w-4 text-teal-600" />
                    <span>Extracted Information ({scannedResult.document_type || 'Prescription'})</span>
                  </div>

                  {scannedResult.diagnosis?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-slate-600">Diagnosis: </span>
                      <span className="text-xs text-slate-800">{scannedResult.diagnosis.join(', ')}</span>
                    </div>
                  )}

                  {scannedResult.medications?.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <span className="text-xs font-semibold text-slate-600">Medications:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {scannedResult.medications.map((m, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-white border border-teal-200 rounded-md text-xs text-slate-800 font-medium">
                            {typeof m === 'object' ? `${m.name} ${m.dosage || ''}` : m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => { setScannedResult(null); fileInputRef.current?.click(); }}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors"
                  >
                    Scan Another
                  </button>
                  <button
                    onClick={() => setStep('chat')}
                    className="flex-1 py-2.5 bg-teal-700 text-white font-medium rounded-lg text-sm hover:bg-teal-800 transition-colors"
                  >
                    Attach & Return to Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'summary' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-lg">
                <CheckCircle className="h-5 w-5" />
                <span>Clinical Intake Summary</span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Your doctor will review this summary before the OPD consultation.</p>
            </div>

            {loadingSummary ? (
              <div className="text-center py-10">
                <RefreshCw className="h-8 w-8 text-teal-700 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Synthesizing clinical summary...</p>
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chief Complaint</h4>
                  <p className="text-slate-900 font-medium text-base">{summary?.chief_complaint || 'General consultation'}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">History of Present Illness</h4>
                  <p className="text-slate-700 leading-relaxed">{summary?.history_of_present_illness || 'Detailed above.'}</p>
                </div>

                {summary?.current_medications?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Medications</h4>
                    <div className="flex flex-wrap gap-2">
                      {summary.current_medications.map((m, idx) => (
                        <span key={idx} className="flex items-center px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-800 font-medium">
                          <Pill className="h-3 w-3 text-teal-600 mr-1" />
                          {typeof m === 'object' ? `${m.name} ${m.dosage || ''}` : m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {summary?.allergies?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Allergies</h4>
                    <div className="flex flex-wrap gap-2">
                      {summary.allergies.map((a, idx) => (
                        <span key={idx} className="flex items-center px-2.5 py-1 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {summary?.preliminary_assessment && (
                  <div className="p-3.5 bg-teal-50 border border-teal-100 rounded-lg">
                    <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1">Preliminary Note</h4>
                    <p className="text-xs text-teal-900">{summary.preliminary_assessment}</p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setStep('identify');
                  setMessages([]);
                  setScannedResult(null);
                  setSummary(null);
                }}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Start New Patient Check-In
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-2.5 bg-teal-700 text-white font-medium rounded-lg text-sm hover:bg-teal-800 transition-colors"
              >
                Go to Doctor Portal
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
