import api from '@/services/api';

export type JobDescriptionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | string;
export type JobDescription = {
  id: number; requirement_id: number; organization_id: number; workflow_id?: number | null;
  title: string; jd_content: string; status: JobDescriptionStatus; published_at?: string | null;
  created_at: string; updated_at: string; requirement_title?: string | null;
};
export type ApprovalAction = { id: number; step_order: number; approver_name?: string | null; action: string; comments?: string | null; action_at?: string | null };
export type ApprovalRequest = { id: number; approval_workflow_id: number; workflow_name?: string; current_step: number; status: string; actions: ApprovalAction[] };
export type JobWorkflow = { id: number; name: string; steps?: Array<{ step_order: number; role_name?: string; approver_role?: string }> };
type DataResponse<T> = { success: boolean; data: T };

async function data<T>(promise: Promise<{ data: DataResponse<T> }>): Promise<T> { return (await promise).data.data; }
export const getJobDescriptions = () => data(api.get<DataResponse<JobDescription[]>>('/jobs'));
export const getJobDescription = (id: number) => data(api.get<DataResponse<JobDescription>>(`/jobs/${id}`));
export const getJobDescriptionApprovalHistory = (id: number) => data(api.get<DataResponse<{ requests: ApprovalRequest[] }>>(`/jobs/${id}/approval-history`));
export const getJobDescriptionWorkflows = () => data(api.get<DataResponse<JobWorkflow[]>>('/jobs/workflows'));
export const createJobDescriptionFromRequirement = (requirementId: number) => data(api.post<DataResponse<JobDescription>>(`/jobs/from-requirement/${requirementId}`));
export const updateJobDescription = (id: number, input: Pick<JobDescription, 'title' | 'jd_content'>) => data(api.put<DataResponse<JobDescription>>(`/jobs/${id}`, input));
export const submitJobDescription = (id: number, workflow_id: number) => data(api.post<DataResponse<ApprovalRequest>>(`/jobs/${id}/submit`, { workflow_id }));
export const approveJobDescription = (id: number, step_order: number, comments?: string) => data(api.post<DataResponse<ApprovalRequest>>(`/jobs/${id}/approve`, { step_order, comments }));
export const rejectJobDescription = (id: number, step_order: number, comments: string) => data(api.post<DataResponse<ApprovalRequest>>(`/jobs/${id}/reject`, { step_order, comments }));
export const publishJobDescription = (id: number) => data(api.post<DataResponse<JobDescription>>(`/jobs/${id}/publish`));
