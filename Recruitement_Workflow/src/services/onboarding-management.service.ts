import api from '@/services/api';

export type OnboardingStatus = 'INITIATED' | 'IN_PROGRESS' | 'READY_TO_JOIN' | 'COMPLETED' | 'CANCELLED';
export type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type OnboardingTask = {
  id: number; onboarding_id: number; title: string; description: string | null;
  assigned_to_candidate_id: number | null; assigned_to_user_id: number | null;
  candidate_assignee_name: string | null; employee_assignee_name: string | null;
  status: OnboardingTaskStatus; due_date: string | null; completed_at: string | null; comments: string | null;
};
export type OnboardingDocument = {
  id: number; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; is_primary: number; uploaded_at: string;
  review_status: 'PENDING' | 'VERIFIED' | 'REJECTED'; reviewed_at: string | null;
  rejection_reason: string | null; reviewer_name: string | null; download_url: string;
};
export type OnboardingRecord = {
  id: number; organization_id: number; offer_id: number; application_id: number; candidate_id: number;
  status: OnboardingStatus; target_join_date: string | null; notes: string | null;
  initiated_at: string; completed_at: string | null;
  candidate_first_name: string; candidate_last_name: string | null; candidate_email: string;
  annual_ctc: string | number; currency: string; employment_type: string; job_id: number; job_title: string;
  tasks?: OnboardingTask[]; documents?: OnboardingDocument[];
};
type ApiResponse<T> = { success: boolean; data: T; message?: string };
export type OnboardingDashboard = {
  total: number; onboarding_by_status: Record<string, number>;
  tasks_by_status: Record<string, number>; documents_by_review_status: Record<string, number>;
};

export async function getOnboardingDashboard() {
  return (await api.get<ApiResponse<OnboardingDashboard>>('/onboarding/dashboard')).data.data;
}
export async function getOnboardingRecords(params: { search?: string; status?: string } = {}) {
  return (await api.get<ApiResponse<OnboardingRecord[]>>('/onboarding', { params })).data.data;
}
export async function getOnboardingRecord(id: number) {
  return (await api.get<ApiResponse<OnboardingRecord>>(`/onboarding/${id}`)).data.data;
}

export type WorkflowHistoryItem = { id: number; entity_type: string; entity_id: number; action: string; field_name: string | null; previous_value: string | null; new_value: string | null; actor_type: string; actor_name: string | null; created_at: string };
export async function getOnboardingHistory(id: number) {
  return (await api.get<ApiResponse<WorkflowHistoryItem[]>>(`/onboarding/${id}/history`)).data.data;
}
export async function initiateOnboarding(input: { offer_id: number; target_join_date?: string; notes?: string }) {
  return (await api.post<ApiResponse<OnboardingRecord>>('/onboarding', input)).data.data;
}
export async function updateOnboarding(id: number, input: Partial<Pick<OnboardingRecord, 'status' | 'target_join_date' | 'notes'>>) {
  return (await api.patch<ApiResponse<OnboardingRecord>>(`/onboarding/${id}`, input)).data.data;
}
export async function completeOnboarding(id: number) {
  return (await api.post<ApiResponse<{ onboarding: OnboardingRecord }>>(`/onboarding/${id}/complete`)).data.data;
}
export async function createOnboardingTask(id: number, input: { title: string; description?: string; assigned_to_candidate_id?: number; assigned_to_user_id?: number; due_date?: string }) {
  return (await api.post<ApiResponse<OnboardingTask>>(`/onboarding/${id}/tasks`, input)).data.data;
}
export async function updateOnboardingTask(id: number, input: Partial<Pick<OnboardingTask, 'status' | 'comments' | 'due_date' | 'title' | 'description'>>) {
  return (await api.patch<ApiResponse<{ id: number }>>(`/onboarding/tasks/${id}`, input)).data.data;
}
export async function reviewOnboardingDocument(id: number, input: { review_status: 'VERIFIED' | 'REJECTED'; rejection_reason?: string }) {
  return (await api.post<ApiResponse<OnboardingDocument>>(`/onboarding/documents/${id}/review`, input)).data.data;
}
export async function getOnboardingDocumentFile(id: number) {
  return api.get<Blob>(`/onboarding/documents/${id}/file`, { responseType: 'blob' });
}
