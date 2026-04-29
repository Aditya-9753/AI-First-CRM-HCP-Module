import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api/api';

const today = new Date();
const initialFormState = {
  hcp_name: '',
  interaction_type: 'Meeting',
  date: today.toISOString().split('T')[0],
  time: today.toTimeString().substring(0, 5),
  notes: '',
  materials_shared: '',
  samples_distributed: '',
  sentiment: 'Neutral',
  outcomes: '',
  follow_up_actions: '',
};

// ── Async Thunks ─────────────────────────────────────────────
export const sendMessageToAi = createAsyncThunk(
  'crm/sendMessage',
  async (message, { dispatch, getState }) => {
    const { sessionId } = getState().crm;
    dispatch(addChatMessage({ sender: 'user', text: message }));
    const response = await api.chat(sessionId, message);
    dispatch(addChatMessage({
      sender: 'ai',
      text: response.response,
      tools_called: response.tools_called,
    }));
    // Auto-fill form if LogInteractionTool extracted fields
    if (response.extracted_fields && Object.keys(response.extracted_fields).length > 0) {
      dispatch(autoFillForm(response.extracted_fields));
    }
    dispatch(fetchInteractions());
    return response;
  }
);

export const fetchInteractions = createAsyncThunk(
  'crm/fetchInteractions',
  async (search = '') => {
    const data = await api.getInteractions(search);
    return data;
  }
);

export const fetchDashboard = createAsyncThunk(
  'crm/fetchDashboard',
  async () => {
    const data = await api.getDashboardSummary();
    return data;
  }
);

export const submitForm = createAsyncThunk(
  'crm/submitForm',
  async (_, { dispatch, getState }) => {
    const { form } = getState().crm;
    if (!form.hcp_name.trim()) throw new Error('HCP Name is required');
    if (!form.date) throw new Error('Date is required');
    await api.logInteraction(form);
    dispatch(resetForm());
    dispatch(fetchInteractions());
    dispatch(fetchDashboard());
  }
);

export const deleteInteractionThunk = createAsyncThunk(
  'crm/deleteInteraction',
  async (id, { dispatch }) => {
    await api.deleteInteraction(id);
    dispatch(fetchInteractions());
    dispatch(fetchDashboard());
    return id;
  }
);

export const editInteractionThunk = createAsyncThunk(
  'crm/editInteraction',
  async ({ id, field, value }, { dispatch }) => {
    await api.editInteraction(id, field, value);
    dispatch(fetchInteractions());
  }
);

// ── Slice ─────────────────────────────────────────────────────
const crmSlice = createSlice({
  name: 'crm',
  initialState: {
    activeTab: 'dashboard',
    form: initialFormState,
    chatMessages: [],
    interactions: [],
    dashboard: null,
    loading: false,
    chatLoading: false,
    toasts: [],         // [{id, type, message}]
    sessionId: `session_${Math.random().toString(36).substring(2, 10)}`,
  },
  reducers: {
    setActiveTab:   (s, a) => { s.activeTab = a.payload; },
    updateForm:     (s, a) => { s.form = { ...s.form, ...a.payload }; },
    resetForm:      (s)    => { s.form = initialFormState; },
    autoFillForm:   (s, a) => { s.form = { ...s.form, ...a.payload }; },
    addChatMessage: (s, a) => { s.chatMessages.push(a.payload); },
    addToast:       (s, a) => { s.toasts.push({ id: Date.now(), ...a.payload }); },
    removeToast:    (s, a) => { s.toasts = s.toasts.filter(t => t.id !== a.payload); },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInteractions.pending,   s => { s.loading = true; })
      .addCase(fetchInteractions.fulfilled, (s, a) => { s.loading = false; s.interactions = a.payload || []; })
      .addCase(fetchInteractions.rejected,  s => { s.loading = false; })
      .addCase(fetchDashboard.fulfilled,    (s, a) => { s.dashboard = a.payload; })
      .addCase(submitForm.pending,          s => { s.loading = true; })
      .addCase(submitForm.fulfilled,        s => { s.loading = false; })
      .addCase(submitForm.rejected,         s => { s.loading = false; })
      .addCase(sendMessageToAi.pending,     s => { s.chatLoading = true; })
      .addCase(sendMessageToAi.fulfilled,   s => { s.chatLoading = false; })
      .addCase(sendMessageToAi.rejected,    s => { s.chatLoading = false; })
      .addCase(deleteInteractionThunk.pending,   s => { s.loading = true; })
      .addCase(deleteInteractionThunk.fulfilled, s => { s.loading = false; })
      .addCase(deleteInteractionThunk.rejected,  s => { s.loading = false; })
      .addCase(editInteractionThunk.pending,   s => { s.loading = true; })
      .addCase(editInteractionThunk.fulfilled, s => { s.loading = false; })
      .addCase(editInteractionThunk.rejected,  s => { s.loading = false; });
  },
});

export const {
  setActiveTab, updateForm, resetForm, autoFillForm,
  addChatMessage, addToast, removeToast,
} = crmSlice.actions;

export const store = configureStore({
  reducer: { crm: crmSlice.reducer },
});
