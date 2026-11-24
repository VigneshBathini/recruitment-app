import candidateApi from '@/services/candidate-api';

export type CandidateProfile = {
  id: number;
  account_type?: 'candidate';
  organization_id?: number;
  organization_slug?: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  resume_url?: string | null;
};

export type CandidateCredentials = {
  organization_slug: string;
  email: string;
  password: string;
};

export type CandidateRegistration = CandidateCredentials & {
  first_name: string;
  last_name: string;
  phone: string;
};

type CandidateAuthResponse = {
  success: boolean;
  message: string;
  data: { token: string; candidate: CandidateProfile };
};

type CandidateProfileResponse = {
  success: boolean;
  data: CandidateProfile;
};

export async function loginCandidate(input: CandidateCredentials) {
  const response = await candidateApi.post<CandidateAuthResponse>('/candidate-auth/login', input);
  return response.data.data;
}

export async function registerCandidate(input: CandidateRegistration) {
  const response = await candidateApi.post<CandidateAuthResponse>('/candidate-auth/register', input);
  return response.data.data;
}

export async function getCandidateProfile(): Promise<CandidateProfile> {
  const response = await candidateApi.get<CandidateProfileResponse>('/candidates/me');
  return response.data.data;
}

export async function updateCandidateProfile(input: Pick<CandidateProfile, 'first_name' | 'last_name' | 'phone'>): Promise<CandidateProfile> {
  const response = await candidateApi.put<CandidateProfileResponse>('/candidates/me', input);
  return response.data.data;
}

export async function updateCandidatePhone(phone: string): Promise<CandidateProfile> {
  const response = await candidateApi.put<CandidateProfileResponse>('/candidates/me', { phone });
  return response.data.data;
}
