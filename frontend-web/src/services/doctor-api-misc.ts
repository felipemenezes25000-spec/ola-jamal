/**
 * doctor-api-misc.ts — Specialties, CID search, address lookup,
 * and prescription/exam image retrieval.
 */

import { authFetch } from './doctor-api-auth';
import type { Specialty } from './doctorApi';

// ── Specialties ──

export async function fetchSpecialties(): Promise<Specialty[]> {
  // Uses plain fetch (no auth required for specialties list)
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  const base = env || (typeof window !== 'undefined' ? window.location.origin : '');
  try {
    const res = await fetch(`${base}/api/specialties`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── CID ──

export async function searchCid(query: string, limit = 10): Promise<{ code: string; description: string }[]> {
  if (!query?.trim() || query.trim().length < 2) return [];
  const res = await authFetch(`/api/cid10/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

// ── Address (ViaCEP) ──

export async function fetchAddressByCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  } catch {
    return null;
  }
}

// ── Prescription/Exam Images ──

/**
 * Returns a blob URL for the prescription image.
 * ⚠️ Caller MUST call URL.revokeObjectURL(url) when done to avoid memory leaks.
 */
export async function getPrescriptionImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/prescription-image/${index}`);
  if (!res.ok) throw new Error('Erro ao buscar imagem');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Returns a blob URL for the exam image.
 * ⚠️ Caller MUST call URL.revokeObjectURL(url) when done to avoid memory leaks.
 */
export async function getExamImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/exam-image/${index}`);
  if (!res.ok) throw new Error('Erro ao buscar imagem');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
