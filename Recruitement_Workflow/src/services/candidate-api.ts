import { create } from 'axios';
import { getCandidateToken } from '@/services/candidate-session.service';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'http://192.168.1.128:5000/api';

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
