import { apiClient } from './api-client';
import type { VideoRoomResponseDto } from '../types/database';

// ============================================
// VIDEO
// ============================================

export async function createVideoRoom(requestId: string): Promise<VideoRoomResponseDto> {
  return apiClient.post('/api/video/rooms', { requestId });
}

export async function fetchVideoRoom(roomId: string): Promise<VideoRoomResponseDto> {
  return apiClient.get(`/api/video/rooms/${roomId}`);
}

export async function fetchVideoRoomByRequest(requestId: string): Promise<VideoRoomResponseDto | null> {
  try {
    return await apiClient.get(`/api/video/by-request/${requestId}`);
  } catch (error: unknown) {
    if ((error as { status?: number })?.status === 404) return null;
    throw error;
  }
}
