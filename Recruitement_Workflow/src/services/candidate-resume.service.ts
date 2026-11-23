import { Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import candidateApi from '@/services/candidate-api';
import { getCandidateToken } from '@/services/candidate-session.service';

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function chooseResume() {
  return DocumentPicker.getDocumentAsync({ type: Object.values(mimeByExtension), copyToCacheDirectory: true, multiple: false });
}

export async function uploadMyResume(asset: DocumentPicker.DocumentPickerAsset) {
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = mimeByExtension[extension];
  if (!mimeType) throw new Error('Choose a PDF, DOC, or DOCX resume.');
  if (asset.size != null && asset.size > MAX_RESUME_SIZE) throw new Error('Resume files must be 10 MB or smaller.');
  const token = await getCandidateToken();
  if (!token) throw new Error('Candidate session has expired.');
  const endpoint = `${candidateApi.defaults.baseURL}/candidates/me/resume?file_name=${encodeURIComponent(asset.name)}`;
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('The selected browser file is unavailable.');
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType }, body: asset.file });
    const payload = await response.json() as { success: boolean; message?: string };
    if (!response.ok) throw new Error(payload.message || 'Resume upload failed.');
    return;
  }
  const response = await FileSystem.uploadAsync(endpoint, asset.uri, {
    httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
  });
  const payload = JSON.parse(response.body) as { success: boolean; message?: string };
  if (response.status < 200 || response.status >= 300) throw new Error(payload.message || 'Resume upload failed.');
}

export async function openMyResume(download = false) {
  const token = await getCandidateToken();
  if (!token) throw new Error('Candidate session has expired.');
  const baseUrl = candidateApi.defaults.baseURL;
  const endpoint = `${baseUrl}/candidates/me/resume/file`;
  if (Platform.OS === 'web') {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to open your resume.');
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const extension = blob.type === mimeByExtension.doc ? 'doc' : blob.type === mimeByExtension.docx ? 'docx' : 'pdf';
    if (download) { const anchor = document.createElement('a'); anchor.href = url; anchor.download = `resume.${extension}`; anchor.click(); }
    else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const cacheId = Date.now();
  const result = await FileSystem.downloadAsync(endpoint, `${FileSystem.cacheDirectory}candidate-resume-${cacheId}.tmp`, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status < 200 || result.status >= 300) throw new Error('Unable to open your resume.');
  const disposition = result.headers['content-disposition'] ?? result.headers['Content-Disposition'] ?? '';
  const extension = disposition.match(/filename\*?=(?:UTF-8''|"?)[^;"%]*?(\.(?:pdf|docx?))/i)?.[1]?.toLowerCase() ?? '.pdf';
  const fileUri = `${FileSystem.cacheDirectory}candidate-resume-${cacheId}${extension}`;
  await FileSystem.moveAsync({ from: result.uri, to: fileUri });
  const uri = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(fileUri) : fileUri;
  await Linking.openURL(uri);
}
