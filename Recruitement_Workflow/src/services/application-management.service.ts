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
  decision_comments: string | null;
  applied_at: string;
  updated_at: string;
};

export type ApplicationCounts = { total: number; new: number; screening: number; shortlisted: number };
export type ApplicationFilters = { search?: string; status?: string; stage?: string; page?: number; page_size?: number };
export type ApplicationPage = {
  items: ManagedApplication[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

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
