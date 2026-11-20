import api from '@/services/api';

export type ManagedApplication = {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  resume_url: string | null;
  candidate_created_at: string;
  jd_content: string;
  job_status: string;
  status: string;
  current_stage: string;
  decision: string | null;
  decision_by: number | null;
  decision_at: string | null;
  decision_by_name: string | null;
  decision_comments: string | null;
  applied_at: string;
  updated_at: string;
};

export type ApplicationCounts = { total: number; new: number; screening: number; shortlisted: number; hired: number };
export type ApplicationFilters = { search?: string; status?: string; stage?: string; page?: number; page_size?: number };
export type ApplicationPage = {
  items: ManagedApplication[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type ReviewQueueItem = Pick<ManagedApplication, 'id' | 'candidate_id' | 'job_id' | 'status' | 'current_stage' | 'applied_at' | 'decision' | 'first_name' | 'last_name' | 'email' | 'job_title'> & {
  completed_interview_count: number;
  feedback_available: boolean;
};
export type InterviewReview = {
  id: number; interview_type: string; title: string; scheduled_at: string; duration_minutes: number;
  meeting_url: string | null; location: string | null; status: string;
  feedback: Array<{ id: number; interviewer_id: number; rating: number; recommendation: string | null; strengths: string | null; weaknesses: string | null; comments: string | null; interviewer_first_name: string; interviewer_last_name: string | null }>;
};
export type ApplicationReview = ManagedApplication & { completed_interviews: InterviewReview[] };

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export async function getApplicationCounts() {
  const response = await api.get<ApiResponse<ApplicationCounts>>('/applications/dashboard');
  return response.data.data;
}

export async function getApplications(filters: ApplicationFilters = {}) {
  const response = await api.get<ApiResponse<ApplicationPage>>('/applications', { params: filters });
  return response.data.data;
}

export async function getApplicationDetails(id: number) {
  const response = await api.get<ApiResponse<ManagedApplication>>(`/applications/${id}`);
  return response.data.data;
}

export async function getApplicationReviewQueue() {
  const response = await api.get<ApiResponse<ReviewQueueItem[]>>('/applications/review-queue');
  return response.data.data;
}

export async function getApplicationReview(id: number) {
  const response = await api.get<ApiResponse<ApplicationReview>>(`/applications/${id}/review`);
  return response.data.data;
}

export async function decideOnApplication(id: number, decision: 'SELECTED' | 'REJECTED', comments: string) {
  const response = await api.post<ApiResponse<ApplicationReview>>(`/applications/${id}/decision`, { decision, comments });
  return response.data.data;
}

export async function moveApplicationStage(id: number, stage: string, comments?: string) {
  const response = await api.patch<ApiResponse<ManagedApplication>>(`/applications/${id}/stage`, { stage, comments });
  return response.data.data;
}

export async function shortlistApplication(id: number, comments: string) {
  const response = await api.post<ApiResponse<ManagedApplication>>(`/applications/${id}/shortlist`, { comments });
  return response.data.data;
}

export async function rejectApplication(id: number, comments: string) {
  const response = await api.post<ApiResponse<ManagedApplication>>(`/applications/${id}/reject`, { comments });
  return response.data.data;
}
