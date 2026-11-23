import api from '@/services/api';
import type { ApplicationPage, ManagedApplication } from '@/services/application-management.service';

export type ManagementOfferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'ACCEPTED' | 'DECLINED' | string;
export type OfferAction = { id: number; step_order: number; approver_name?: string | null; action: string; comments?: string | null; action_at?: string | null };
export type OfferApprovalRequest = { id: number; approval_workflow_id: number; workflow_name?: string; status: string; current_step: number; actions: OfferAction[] };
export type ManagementOffer = {
  id: number; organization_id: number; application_id: number; candidate_id: number; job_id: number;
  annual_ctc: string | number; currency: string; employment_type: string; work_location?: string | null;
  start_date: string; expiry_date?: string | null; offer_letter_url?: string | null;
  status: ManagementOfferStatus; created_at: string; updated_at: string; issued_at?: string | null;
  candidate_responded_at?: string | null; candidate_response_comments?: string | null;
  candidate_first_name?: string; candidate_last_name?: string | null; candidate_email?: string;
  job_title?: string; application?: { id: number; status: string; decision: string | null; current_stage: string };
  candidate?: { id: number; first_name: string; last_name: string | null; email: string };
  job?: { id: number; title: string }; approval_history?: OfferApprovalRequest[];
};
export type OfferTermsInput = { annual_ctc: string; currency: string; employment_type: string; work_location: string | null; start_date: string; expiry_date: string | null; offer_letter_url: string | null };
export type OfferWorkflow = { id: number; name: string; steps?: Array<{ step_order: number; name?: string }> };
type Response<T> = { success: boolean; data: T; message?: string };

export async function getManagementOffers() { const response = await api.get<Response<ManagementOffer[]>>('/offers'); return response.data.data; }
export async function getManagementOffer(id: number) { const response = await api.get<Response<ManagementOffer>>(`/offers/${id}`); return response.data.data; }
export async function getOfferWorkflows() { const response = await api.get<Response<OfferWorkflow[]>>('/offers/workflows'); return response.data.data; }
export async function createManagementOffer(input: OfferTermsInput & { application_id: number }) { const response = await api.post<Response<ManagementOffer>>('/offers', input); return response.data.data; }
export async function updateManagementOffer(id: number, input: Partial<OfferTermsInput>) { const response = await api.patch<Response<ManagementOffer>>(`/offers/${id}`, input); return response.data.data; }
export async function submitManagementOffer(id: number, workflow_id: number) { const response = await api.post<Response<{ offer: ManagementOffer; approval_request: OfferApprovalRequest }>>(`/offers/${id}/submit`, { workflow_id }); return response.data.data; }
export async function issueManagementOffer(id: number) { const response = await api.post<Response<ManagementOffer>>(`/offers/${id}/issue`); return response.data.data; }
export async function decideOfferApproval(id: number, decision: 'approve' | 'reject', step_order: number, comments?: string) {
  const response = await api.post<Response<OfferApprovalRequest>>(`/approvals/requests/${id}/${decision}`, { step_order, comments }); return response.data.data;
}
export async function getSelectedApplications() {
  const all: ManagedApplication[] = []; let page = 1; let totalPages = 1;
  do { const response = await api.get<Response<ApplicationPage>>('/applications', { params: { page, page_size: 100 } }); all.push(...response.data.data.items); totalPages = response.data.data.total_pages; page += 1; } while (page <= totalPages);
  return all.filter((application) => application.decision === 'SELECTED');
}
export async function getOfferApplication(id: number) {
  const response = await api.get<Response<ManagedApplication>>(`/applications/${id}`); return response.data.data;
}
