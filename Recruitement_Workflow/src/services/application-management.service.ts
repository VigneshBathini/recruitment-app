import api from '@/services/api';
import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getToken } from '@/services/token.service';

export type ManagedApplication = {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  has_resume_snapshot: boolean | number;
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
  status_history?: Array<{
    id: number;
    from_status: string | null;
    to_status: string;
    actor_type: 'CANDIDATE' | 'MANAGEMENT_USER';
    actor_id: number | null;
    actor_name: string | null;
    reason: string | null;
    changed_at: string;
  }>;
};

export type ApplicationCounts = { total: number; new: number; screening: number; shortlisted: number; withdrawn: number; hired: number };
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

export async function accessApplicationResume(id: number, download = false) {
  const token = await getToken();
  if (!token) throw new Error('Your session has expired.');
  const endpoint = `${api.defaults.baseURL}/applications/${id}/resume`;
  if (Platform.OS === 'web') {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to open the submitted application resume.');
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const extension = blob.type === 'application/msword' ? 'doc' : blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' : 'pdf';
    if (download) { const anchor = document.createElement('a'); anchor.href = url; anchor.download = `application-${id}-resume.${extension}`; anchor.click(); }
    else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const cacheId = Date.now();
  const temporaryPath = `${FileSystem.cacheDirectory}application-${id}-resume-${cacheId}.tmp`;
  const result = await FileSystem.downloadAsync(endpoint, temporaryPath, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status < 200 || result.status >= 300) throw new Error('Unable to open the submitted application resume.');
  const disposition = result.headers['content-disposition'] ?? result.headers['Content-Disposition'] ?? '';
  const extension = disposition.match(/filename\*?=(?:UTF-8''|"?)[^;"%]*?(\.(?:pdf|docx?|PDF|DOCX?))/i)?.[1]?.toLowerCase() ?? '.pdf';
  const filePath = `${FileSystem.cacheDirectory}application-${id}-resume-${cacheId}${extension}`;
  await FileSystem.moveAsync({ from: result.uri, to: filePath });
  const uri = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(filePath) : filePath;
  await Linking.openURL(uri);
}

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

export async function withdrawManagedApplication(id: number, reason: string) {
  const response = await api.post<ApiResponse<ManagedApplication>>(`/applications/${id}/withdraw`, { reason });
  return response.data.data;
}
