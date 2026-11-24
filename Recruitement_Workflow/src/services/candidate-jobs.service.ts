import candidateApi from '@/services/candidate-api';

export type PublishedJob = {
  id: number;
  title: string;
  jd_content: string;
  published_at: string | null;
};

type JobsResponse = { success: boolean; data: PublishedJob[] };
type JobResponse = { success: boolean; data: PublishedJob };
type ApplicationResponse = { success: boolean; data: { id: number } };

export type CandidateApplication = {
  id: number;
  job_id: number;
  job_title: string;
  status: string;
  current_stage: string | null;
  applied_at: string;
  updated_at: string;
  has_accepted_offer?: boolean | number;
};

type ApplicationsResponse = { success: boolean; data: CandidateApplication[] };

function jobsPath(organizationSlug: string) {
  return `/public/organizations/${encodeURIComponent(organizationSlug)}/jobs`;
}

export async function getPublishedJobs(organizationSlug: string): Promise<PublishedJob[]> {
  const response = await candidateApi.get<JobsResponse>(jobsPath(organizationSlug));
  return response.data.data;
}

export async function getPublishedJob(organizationSlug: string, jobId: number): Promise<PublishedJob> {
  const response = await candidateApi.get<JobResponse>(`${jobsPath(organizationSlug)}/${jobId}`);
  return response.data.data;
}

export async function applyToPublishedJob(jobId: number): Promise<number> {
  const response = await candidateApi.post<ApplicationResponse>('/candidates/me/applications', { job_id: jobId });
  return response.data.data.id;
}

export async function getMyApplications(): Promise<CandidateApplication[]> {
  const response = await candidateApi.get<ApplicationsResponse>('/candidates/me/applications');
  return response.data.data;
}

export async function withdrawMyApplication(applicationId: number, reason: string): Promise<CandidateApplication> {
  const response = await candidateApi.post<{ success: boolean; data: CandidateApplication }>(
    `/candidates/me/applications/${applicationId}/withdraw`, { reason },
  );
  return response.data.data;
}
