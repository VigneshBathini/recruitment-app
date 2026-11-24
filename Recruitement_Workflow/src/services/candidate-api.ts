import { create } from 'axios';
import { getCandidateToken } from '@/services/candidate-session.service';
import { API_BASE_URL } from '@/services/api-config';

const candidateApi = create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

candidateApi.interceptors.request.use(async (config) => {
  const token = await getCandidateToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default candidateApi;
