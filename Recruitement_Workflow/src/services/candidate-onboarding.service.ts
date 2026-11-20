import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import candidateApi from '@/services/candidate-api';
import { getCandidateToken } from '@/services/candidate-session.service';
import type { OnboardingDocument, OnboardingRecord, OnboardingTask } from '@/services/onboarding-management.service';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export async function getMyOnboarding() {
  return (await candidateApi.get<ApiResponse<OnboardingRecord[]>>('/candidates/me/onboarding')).data.data;
}
export async function getMyOnboardingRecord(id: number) {
  return (await candidateApi.get<ApiResponse<OnboardingRecord>>(`/candidates/me/onboarding/${id}`)).data.data;
}
export async function getMyOnboardingTasks(id: number) {
  return (await candidateApi.get<ApiResponse<OnboardingTask[]>>(`/candidates/me/onboarding/${id}/tasks`)).data.data;
}
export async function updateMyOnboardingTask(id: number, input: { status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; comments?: string }) {
  await candidateApi.patch(`/candidates/me/onboarding/tasks/${id}`, input);
}
export async function listMyOnboardingDocuments(id: number) {
  return (await candidateApi.get<ApiResponse<OnboardingDocument[]>>(`/candidates/me/onboarding/${id}/documents`)).data.data;
}

export async function chooseOnboardingDocument() {
  return DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png'],
    copyToCacheDirectory: true,
    multiple: false,
  });
}

export async function uploadMyOnboardingDocument(onboardingId: number, documentType: string, asset: DocumentPicker.DocumentPickerAsset) {
  const mimeType = asset.mimeType || 'application/octet-stream';
  const query = `document_type=${encodeURIComponent(documentType)}&file_name=${encodeURIComponent(asset.name)}`;
  const baseUrl = candidateApi.defaults.baseURL;
  const endpoint = `${baseUrl}/candidates/me/onboarding/${onboardingId}/documents?${query}`;
  const token = await getCandidateToken();
  if (!token) throw new Error('Candidate session has expired');

  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('The selected browser file is unavailable');
    const response = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType }, body: asset.file,
    });
    const payload = await response.json() as ApiResponse<OnboardingDocument> & { success: boolean };
    if (!response.ok) throw new Error(payload.message || 'Document upload failed');
    return payload.data;
  }

  const response = await FileSystem.uploadAsync(endpoint, asset.uri, {
    httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
  });
  const payload = JSON.parse(response.body) as ApiResponse<OnboardingDocument> & { success: boolean; message?: string };
  if (response.status < 200 || response.status >= 300) throw new Error(payload.message || 'Document upload failed');
  return payload.data;
}
