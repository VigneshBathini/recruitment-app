import candidateApi from '@/services/candidate-api';

export type CandidateInterview = {
  id: number;
  application_id: number;
  job_title: string;
  interview_type: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  location: string | null;
  status: string;
  interviewers: { name: string }[];
};

type InterviewsResponse = { success: boolean; data: CandidateInterview[] };

export async function getMyInterviews(): Promise<CandidateInterview[]> {
  const response = await candidateApi.get<InterviewsResponse>('/candidates/me/interviews');
  return response.data.data;
}
