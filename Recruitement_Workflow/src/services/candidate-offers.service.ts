import candidateApi from '@/services/candidate-api';

export type CandidateOffer = {
  id: number;
  application_id: number;
  annual_ctc: string | number;
  currency: string;
  employment_type: string;
  work_location: string | null;
  start_date: string;
  expiry_date: string | null;
  offer_letter_url: string | null;
  status: 'ISSUED' | 'ACCEPTED' | 'DECLINED' | string;
  issued_at: string | null;
  candidate_responded_at: string | null;
  candidate_response_comments: string | null;
  job_id: number;
  job_title: string;
};

export function isOfferExpired(expiryDate: string | null | undefined, today = new Date()) {
  if (!expiryDate) return false;
  const expiry = expiryDate.slice(0, 10);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(expiry) && expiry < todayKey;
}

type OffersResponse = { success: boolean; data: CandidateOffer[] };
type OfferResponse = { success: boolean; data: CandidateOffer };

export async function getMyOffers(): Promise<CandidateOffer[]> {
  const response = await candidateApi.get<OffersResponse>('/candidates/me/offers');
  return response.data.data;
}

export async function getMyOffer(id: number): Promise<CandidateOffer> {
  const response = await candidateApi.get<OfferResponse>(`/candidates/me/offers/${id}`);
  return response.data.data;
}

export async function respondToMyOffer(id: number, action: 'accept' | 'decline', comments?: string): Promise<CandidateOffer> {
  const response = await candidateApi.post<OfferResponse>(`/candidates/me/offers/${id}/${action}`, {
    ...(comments?.trim() ? { comments: comments.trim() } : {}),
  });
  return response.data.data;
}
