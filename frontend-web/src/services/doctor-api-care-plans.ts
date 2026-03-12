/**
 * doctor-api-care-plans.ts — Care Plans API.
 * Alinhado ao mobile api-care-plans.
 */
import { authFetch } from './doctor-api-auth';

export interface CarePlanTaskFile {
  id: string;
  taskId: string;
  fileUrl: string;
  contentType: string;
  createdAt: string;
}

export interface CarePlanTask {
  id: string;
  carePlanId: string;
  type: string;
  state: string;
  title: string;
  description?: string;
  payloadJson: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  files: CarePlanTaskFile[];
}

export interface CarePlan {
  id: string;
  consultationId: string;
  patientId: string;
  responsibleDoctorId: string;
  status: string;
  createdFromAiSuggestionId: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  tasks: CarePlanTask[];
}

export interface AiSuggestionResponse {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId?: string | null;
  status: string;
  model: string;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedExam {
  name: string;
  priority: 'optional' | 'recommended' | 'urgent';
  instructions?: string;
  notes?: string;
}

export async function getAiExamSuggestions(consultationId: string, status?: string): Promise<AiSuggestionResponse[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authFetch(`/api/consultations/${consultationId}/ai/exam-suggestions${query}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createAiSuggestion(
  consultationId: string,
  data: { patientId: string; doctorId?: string; payloadJson: string; model: string; correlationId: string }
): Promise<AiSuggestionResponse> {
  const res = await authFetch(`/api/consultations/${consultationId}/ai/exam-suggestions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao criar sugestão');
  const json = await res.json();
  return json.suggestion ?? json;
}

export async function createCarePlanFromSuggestion(
  consultationId: string,
  data: {
    aiSuggestionId: string;
    responsibleDoctorId: string;
    acceptedExams: AcceptedExam[];
    inPersonRecommendation?: { confirmed: boolean; urgency?: string; message?: string };
    createTasks: boolean;
    correlationId: string;
  }
): Promise<{ carePlanId: string; status: string; carePlan: CarePlan }> {
  const res = await authFetch(`/api/consultations/${consultationId}/care-plans`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao criar plano');
  return res.json();
}

export async function getCarePlan(carePlanId: string): Promise<CarePlan> {
  const res = await authFetch(`/api/care-plans/${carePlanId}`);
  if (!res.ok) throw new Error('Erro ao carregar plano de cuidados');
  return res.json();
}

export async function getCarePlanByConsultation(consultationId: string): Promise<CarePlan | null> {
  try {
    const res = await authFetch(`/api/consultations/${consultationId}/care-plan`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function carePlanTaskAction(
  carePlanId: string,
  taskId: string,
  action: 'start' | 'complete' | 'submit_results' | 'add_file'
): Promise<CarePlan> {
  const res = await authFetch(`/api/care-plans/${carePlanId}/tasks/${taskId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Erro ao executar ação');
  return res.json();
}

export async function reviewCarePlan(
  carePlanId: string,
  data: { notes?: string; closePlan: boolean; taskDecisions: { taskId: string; decision: string; reason?: string }[] }
): Promise<CarePlan> {
  const res = await authFetch(`/api/care-plans/${carePlanId}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao revisar plano');
  return res.json();
}
