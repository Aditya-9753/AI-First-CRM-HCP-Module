import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  updateForm, submitForm, setActiveTab, fetchInteractions, fetchDashboard,
  sendMessageToAi, resetForm, deleteInteractionThunk, editInteractionThunk,
  addToast, removeToast,
} from './store/store';
import { api } from './api/api';

// ── Toast System ──────────────────────────────────────────────
function ToastContainer() {
  const dispatch = useDispatch();
  const toasts = useSelector(s => s.crm.toasts);
  useEffect(() => {
    toasts.forEach(t => {
      const timer = setTimeout(() => dispatch(removeToast(t.id)), 3500);
      return () => clearTimeout(timer);
    });
  }, [toasts, dispatch]);
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white pointer-events-auto transition-all ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-indigo-600'}`}>
          {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Sentiment Badge ───────────────────────────────────────────
function SentimentBadge({ s }) {
  const cfg = { Positive: 'bg-green-100 text-green-800', Negative: 'bg-red-100 text-red-800', Neutral: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg[s] || cfg.Neutral}`}>{s || 'Neutral'}</span>;
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ interaction, onClose, onSave }) {
  const [field, setField] = useState('notes');
  const [value, setValue] = useState(interaction?.notes || '');
  const [saving, setSaving] = useState(false);
  const fields = [
    { k: 'notes', l: 'Notes' }, { k: 'topics_discussed', l: 'Topics' },
    { k: 'sentiment', l: 'Sentiment' }, { k: 'outcomes', l: 'Outcomes' },
    { k: 'materials_shared', l: 'Materials' }, { k: 'interaction_type', l: 'Type' },
  ];
  const handleField = f => { setField(f); setValue(interaction?.[f] || ''); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-bold">Edit Interaction #{interaction?.id}</h3>
          <button onClick={onClose} className="text-indigo-300 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Field</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              value={field} onChange={e => handleField(e.target.value)}>
              {fields.map(f => <option key={f.k} value={f.k}>{f.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">New Value</label>
            {field === 'sentiment'
              ? <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" value={value} onChange={e => setValue(e.target.value)}>
                  {['Positive','Neutral','Negative'].map(s => <option key={s}>{s}</option>)}
                </select>
              : <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-400"
                  rows={3} value={value} onChange={e => setValue(e.target.value)} />}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">Cancel</button>
            <button disabled={saving} onClick={async () => { setSaving(true); await onSave(interaction.id, field, value); setSaving(false); onClose(); }}
              className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-semibold hover:bg-indigo-800 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard() {
  const dispatch = useDispatch();
  const { interactions, loading, dashboard } = useSelector(s => s.crm);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchDashboard()); }, [dispatch]);

  const handleSearch = useCallback((e) => {
    const q = e.target.value;
    setSearch(q);
    dispatch(fetchInteractions(q));
  }, [dispatch]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interaction?')) return;
    setDeletingId(id);
    await dispatch(deleteInteractionThunk(id));
    dispatch(addToast({ type: 'success', message: 'Interaction deleted.' }));
    setDeletingId(null);
  };

  const handleEditSave = async (id, field, value) => {
    await dispatch(editInteractionThunk({ id, field, value }));
    dispatch(addToast({ type: 'success', message: 'Interaction updated.' }));
  };

  const d = dashboard;
  const cards = [
    { label: 'Total Interactions', value: d?.total_interactions ?? '—', color: 'border-blue-500', bg: 'bg-blue-50', icon: '📋' },
    { label: 'Total HCPs', value: d?.total_hcps ?? '—', color: 'border-purple-500', bg: 'bg-purple-50', icon: '👨‍⚕️' },
    { label: 'Positive Sentiment', value: d?.sentiment_breakdown?.Positive ?? '—', color: 'border-green-500', bg: 'bg-green-50', icon: '😊' },
    { label: 'Needs Attention', value: d?.sentiment_breakdown?.Negative ?? '—', color: 'border-red-500', bg: 'bg-red-50', icon: '⚠️' },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto w-full">
      {editing && <EditModal interaction={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <button onClick={() => { dispatch(fetchInteractions()); dispatch(fetchDashboard()); }}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">↻ Refresh</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`${c.bg} border-l-4 ${c.color} rounded-xl p-5 shadow-sm`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{c.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Sentiment bar */}
      {d && d.total_interactions > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Sentiment Distribution</h3>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {[['Positive','bg-green-500'],['Neutral','bg-gray-300'],['Negative','bg-red-500']].map(([k, cls]) => {
              const pct = ((d.sentiment_breakdown[k] || 0) / d.total_interactions * 100).toFixed(0);
              return pct > 0 ? <div key={k} className={`${cls} transition-all`} style={{ width: `${pct}%` }} title={`${k}: ${pct}%`} /> : null;
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {[['Positive','bg-green-500'],['Neutral','bg-gray-300'],['Negative','bg-red-500']].map(([k, cls]) => (
              <span key={k} className="flex items-center gap-1 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${cls}`}/>{k}: {d.sentiment_breakdown[k] || 0}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Interactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h3 className="font-bold text-gray-800">All Interactions</h3>
          <input value={search} onChange={handleSearch} placeholder="🔍  Search HCP or notes…"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-64" />
        </div>
        {loading ? (
          <div className="p-8 text-center"><div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : interactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No interactions found{search ? ` matching "${search}"` : '. Log one to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>{['HCP Name','Type','Date','Notes','Sentiment','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {interactions.map(row => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{row.hcp_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.interaction_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{row.notes || row.topics_discussed || '—'}</td>
                    <td className="px-4 py-3"><SentimentBadge s={row.sentiment} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(row)}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100">✏️ Edit</button>
                        <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                          className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
                          {deletingId === row.id ? '…' : '🗑 Del'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log Interaction Form ──────────────────────────────────────
function LogForm() {
  const dispatch = useDispatch();
  const { form, loading } = useSelector(s => s.crm);
  const [errors, setErrors] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const handleChange = e => {
    dispatch(updateForm({ [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.hcp_name.trim()) errs.hcp_name = 'Required';
    if (!form.date) errs.date = 'Required';
    if (!form.notes.trim()) errs.notes = 'Please add some notes';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      await dispatch(submitForm()).unwrap();
      dispatch(addToast({ type: 'success', message: 'Interaction logged successfully!' }));
      setSuggestions([]);  // clear old suggestions
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.message || 'Failed to log interaction.' }));
    }
  };

  const handleGetSuggestions = async () => {
    if (!form.hcp_name.trim() && !form.notes.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter HCP Name and Notes first.' }));
      return;
    }
    setSuggestLoading(true);
    try {
      const result = await api.suggestFollowup(form.hcp_name, form.notes, form.sentiment);
      setSuggestions(result.suggestions || []);
      dispatch(addToast({ type: 'success', message: 'AI suggestions generated!' }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to get suggestions.' }));
    } finally {
      setSuggestLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', required, children, hint }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children || <input type={type} name={name} value={form[name]} onChange={handleChange}
        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition ${errors[name] ? 'border-red-400' : 'border-gray-300'}`} />}
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
      {hint && !errors[name] && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-white border-r border-gray-200">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Log HCP Interaction</h2>
          <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded-full font-medium">
            AI Auto-fill enabled
          </span>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Field label="HCP Name" name="hcp_name" required hint="e.g. Dr. Sharma" />
            <Field label="Interaction Type" name="interaction_type">
              <select name="interaction_type" value={form.interaction_type} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                {['Meeting','Call','Email','Webinar','Conference'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Date" name="date" type="date" required />
            <Field label="Time" name="time" type="time" />
          </div>

          <Field label="Notes / Topics Discussed" name="notes" required>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${errors.notes ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Summarize the interaction…" />
          </Field>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Materials Shared" name="materials_shared" />
            <Field label="Samples Distributed" name="samples_distributed" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Observed Sentiment</label>
            <div className="flex gap-4">
              {[['Positive','text-green-700 bg-green-50 border-green-300'],['Neutral','text-gray-700 bg-gray-50 border-gray-300'],['Negative','text-red-700 bg-red-50 border-red-300']].map(([s, cls]) => (
                <label key={s} className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition text-sm font-medium ${form.sentiment === s ? cls + ' ring-2 ring-offset-1' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="sentiment" value={s} checked={form.sentiment === s} onChange={handleChange} className="sr-only" />{s}
                </label>
              ))}
            </div>
          </div>

          <Field label="Outcomes" name="outcomes">
            <textarea name="outcomes" value={form.outcomes} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </Field>

          <Field label="Follow-up Actions" name="follow_up_actions" hint="Separate multiple with commas">
            <textarea name="follow_up_actions" value={form.follow_up_actions} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </Field>

          {/* AI Suggestions Panel */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-indigo-800">✨ AI Follow-Up Suggestions</h4>
                <p className="text-xs text-indigo-500 mt-0.5">Powered by Groq LLM + HCP history</p>
              </div>
              <button
                onClick={handleGetSuggestions}
                disabled={suggestLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {suggestLoading
                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                  : <>✨ Get Suggestions</>}
              </button>
            </div>

            {suggestions.length === 0 && !suggestLoading && (
              <p className="text-xs text-indigo-400 italic">Fill in HCP Name, Notes and Sentiment, then click "Get Suggestions".</p>
            )}

            {suggestions.length > 0 && (
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">{i+1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{s}</p>
                      <button
                        onClick={() => dispatch(updateForm({ follow_up_actions: form.follow_up_actions ? form.follow_up_actions + ', ' + s : s }))}
                        className="text-xs text-indigo-500 hover:text-indigo-700 mt-0.5 font-medium"
                      >+ Add to Follow-up Actions</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={() => { dispatch(resetForm()); setErrors({}); }}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">Clear</button>
            <button onClick={handleSubmit} disabled={loading}
              className="px-5 py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-semibold hover:bg-indigo-800 disabled:opacity-60 flex items-center gap-2 min-w-[140px] justify-center">
              {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : '💾 Save Interaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Chat Panel ─────────────────────────────────────────────
function ChatPanel() {
  const dispatch = useDispatch();
  const { chatMessages, chatLoading } = useSelector(s => s.crm);
  const [input, setInput] = useState('');
  const bottomRef = React.useRef(null);
  const PROMPTS = [
    'Met Dr. Sharma, discussed Product X, he seemed positive',
    'Show history for Dr. Patel',
    'Suggest follow-ups for negative sentiment HCP',
    'Generate summary report',
  ];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, chatLoading]);

  const send = () => {
    if (!input.trim()) return;
    dispatch(sendMessageToAi(input));
    setInput('');
  };

  return (
    <div className="w-96 flex-shrink-0 bg-gray-50 flex flex-col">
      <div className="px-5 py-4 bg-indigo-900 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="font-bold text-base">AI Copilot</h3>
        </div>
        <p className="text-xs text-indigo-300 mt-0.5">LangGraph · llama-3.3-70b · Auto-fill enabled</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {chatMessages.length === 0 && (
          <div className="text-center text-gray-400 text-sm bg-white rounded-xl p-5 border border-gray-100 shadow-sm my-auto">
            <p className="text-2xl mb-2">🤖</p>
            <p className="font-medium text-gray-600 mb-1">AI Copilot</p>
            <p>Describe a meeting and I'll automatically extract all fields and fill your form!</p>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200 shadow-sm'
            }`}>{msg.text}</div>
            {msg.tools_called?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {msg.tools_called.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">⚡ {t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {chatLoading && (
          <div className="flex items-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm flex items-center gap-1.5">
              {[0,150,300].map(d => <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PROMPTS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)}
              className="whitespace-nowrap px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 text-xs rounded-full border border-gray-200 hover:border-indigo-200 transition">
              {p.length > 30 ? p.slice(0,30)+'…' : p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 relative">
          <input className="flex-1 pl-4 pr-12 py-2.5 bg-gray-50 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && send()}
            placeholder="Describe a meeting or ask anything…" />
          <button onClick={send} disabled={chatLoading || !input.trim()}
            className="absolute right-1 top-1 bottom-1 w-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50">
            <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────
export default function App() {
  const dispatch = useDispatch();
  const { activeTab } = useSelector(s => s.crm);

  useEffect(() => {
    dispatch(fetchInteractions());
    dispatch(fetchDashboard());
  }, [dispatch]);

  const navItems = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'log',       label: '✏️ Log Interaction' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      <ToastContainer />
      {/* Sidebar */}
      <nav className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-indigo-800">HCP Connect AI</h1>
          <p className="text-xs text-gray-400 mt-0.5">Life Sciences CRM</p>
        </div>
        <div className="flex-1 py-4 flex flex-col gap-1 px-3">
          {navItems.map(({ key, label }) => (
            <button key={key}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === key ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => dispatch(setActiveTab(key))}>
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">LangGraph + Groq</p>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'log' && (
          <>
            <LogForm />
            <ChatPanel />
          </>
        )}
      </main>
    </div>
  );
}
