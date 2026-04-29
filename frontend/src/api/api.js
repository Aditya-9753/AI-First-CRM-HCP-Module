import axios from 'axios';

const BASE = 'http://127.0.0.1:8000';

export const api = {
  chat: async (session_id, message) => {
    const { data } = await axios.post(`${BASE}/api/chat`, { session_id, message });
    return data;
  },
  logInteraction: async (payload) => {
    const { data } = await axios.post(`${BASE}/log-interaction`, payload);
    return data;
  },
  getInteractions: async (search = '') => {
    const { data } = await axios.get(`${BASE}/api/interactions`, { params: { search } });
    return data;
  },
  editInteraction: async (id, field, value) => {
    const { data } = await axios.put(`${BASE}/edit-interaction/${id}`, { field, value });
    return data;
  },
  deleteInteraction: async (id) => {
    const { data } = await axios.delete(`${BASE}/delete-interaction/${id}`);
    return data;
  },
  getDashboardSummary: async () => {
    const { data } = await axios.get(`${BASE}/dashboard-summary`);
    return data;
  },
  suggestFollowup: async (hcp_name, notes, sentiment) => {
    const { data } = await axios.post(`${BASE}/suggest-followup`, { hcp_name, notes, sentiment });
    return data;
  },
  getHcpHistory: async (hcp_id) => {
    const { data } = await axios.get(`${BASE}/hcp-history/${hcp_id}`);
    return data;
  },
  searchHcps: async (q) => {
    const { data } = await axios.get(`${BASE}/api/hcps`, { params: { q } });
    return data;
  },
};
