import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, Check, ChevronDown, ChevronUp, FileText, Pill, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [ocrScans, setOcrScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const { data } = await api.get(`/intake/${sessionId}`);
        if (data.success) {
          setSession(data.data.session);
          setOcrScans(data.data.ocrScans || []);
          setEditedSummary(data.data.session.structured_summary);
        }
      } catch (err) {
        console.error('Failed to fetch session', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/intake/${sessionId}/summary`, { summary: editedSummary });
      setSession(prev => ({ ...prev, structured_summary: editedSummary, status: 'reviewed' }));
      setEditing(false);
    } catch (err) {
      console.error('Failed to save', err);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status) => {
    const styles = { in_progress: 'bg-amber-100 text-amber-800', completed: 'bg-emerald-100 text-emerald-800', reviewed: 'bg-blue-100 text-blue-800' };
    const labels = { in_progress: 'In Progress', completed: 'Completed', reviewed: 'Reviewed' };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-800'}`}>{labels[status] || status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading session...</div>;
  if (!session) return <div className="flex items-center justify-center h-screen text-slate-500">Session not found</div>;

  const summary = editing ? editedSummary : session.structured_summary;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/dashboard')} className="mr-4 text-slate-500 hover:text-slate-700"><ChevronLeft className="h-5 w-5" /></button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-lg font-semibold text-slate-900">{session.patient_name}</h1>
                {statusBadge(session.status)}
              </div>
              {session.abha_id && <p className="text-sm text-slate-500">ABHA: {session.abha_id}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                <Edit2 className="h-4 w-4 mr-1.5" />Edit Summary
              </button>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setEditedSummary(session.structured_summary); }} className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center px-3 py-2 text-sm bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors">
                  <Check className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save & Mark Reviewed'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Clinical Summary */}
        {summary && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Clinical Summary</h2>
            </div>
            <div className="p-6 space-y-5">
              <SummaryField label="Chief Complaint" value={summary.chief_complaint} editing={editing} onChange={(v) => setEditedSummary(prev => ({ ...prev, chief_complaint: v }))} large />
              <SummaryField label="History of Present Illness" value={summary.history_of_present_illness} editing={editing} onChange={(v) => setEditedSummary(prev => ({ ...prev, history_of_present_illness: v }))} multiline />
              <SummaryField label="Preliminary Assessment" value={summary.preliminary_assessment} editing={editing} onChange={(v) => setEditedSummary(prev => ({ ...prev, preliminary_assessment: v }))} highlight />

              {summary.current_medications?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Medications</label>
                  <div className="flex flex-wrap gap-2">
                    {summary.current_medications.map((med, i) => (
                      <div key={i} className="flex items-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        <Pill className="h-3.5 w-3.5 text-teal-600 mr-1.5" />
                        <span className="text-slate-800 font-medium">{med.name}</span>
                        {med.dosage && <span className="text-slate-500 ml-1">{med.dosage}</span>}
                        {med.frequency && <span className="text-slate-400 ml-1">- {med.frequency}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.allergies?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Allergies</label>
                  <div className="flex flex-wrap gap-2">
                    {summary.allergies.map((a, i) => (
                      <span key={i} className="flex items-center px-2.5 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
                        <AlertCircle className="h-3 w-3 mr-1" />{a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.past_medical_history?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Past Medical History</label>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {summary.past_medical_history.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}

              <SummaryField label="Family History" value={summary.family_history} editing={editing} onChange={(v) => setEditedSummary(prev => ({ ...prev, family_history: v }))} />
              <SummaryField label="Social History" value={summary.social_history} editing={editing} onChange={(v) => setEditedSummary(prev => ({ ...prev, social_history: v }))} />
            </div>
          </section>
        )}

        {/* OCR Scans */}
        {ocrScans.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Scanned Documents ({ocrScans.length})</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {ocrScans.map((scan) => (
                <div key={scan.id} className="p-5">
                  <div className="flex items-center mb-3">
                    <FileText className="h-4 w-4 text-slate-500 mr-2" />
                    <span className="text-sm font-medium text-slate-700 capitalize">{scan.structured_data?.document_type || 'Document'}</span>
                    {scan.structured_data?.date && <span className="text-xs text-slate-400 ml-2">{scan.structured_data.date}</span>}
                  </div>
                  {scan.structured_data?.medications?.length > 0 && (
                    <div className="ml-6">
                      {scan.structured_data.medications.map((med, i) => (
                        <p key={i} className="text-sm text-slate-600">{med.name} {med.dosage} - {med.frequency} {med.duration ? `(${med.duration})` : ''}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conversation Transcript */}
        {session.conversation?.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setShowTranscript(!showTranscript)} className="w-full p-6 flex items-center justify-between text-left">
              <h2 className="text-base font-semibold text-slate-800">Conversation Transcript ({session.conversation.length} messages)</h2>
              {showTranscript ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
            {showTranscript && (
              <div className="px-6 pb-6 space-y-3">
                {session.conversation.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm ${msg.role === 'assistant' ? 'bg-slate-100 text-slate-800' : 'bg-teal-50 text-teal-900'}`}>
                      <p className="text-xs font-medium mb-1 text-slate-500">{msg.role === 'assistant' ? 'MediKiosk AI' : 'Patient'}</p>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryField({ label, value, editing, onChange, multiline, large, highlight }) {
  if (!value && !editing) return null;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {editing ? (
        multiline ? (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        ) : (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        )
      ) : (
        <p className={`text-sm ${large ? 'text-lg font-medium text-slate-900' : highlight ? 'text-slate-800 bg-teal-50 border border-teal-100 p-3 rounded-lg' : 'text-slate-600'}`}>{value}</p>
      )}
    </div>
  );
}
