import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { apiClient } from './api-client';
import type { UserDto } from '../types/database';

// ============================================
// AUTH (extended — password & avatar)
// ============================================

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.patch('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

/** Copia URI content:// para file:// no Android (FormData não lê content:// corretamente). */
async function ensureFileUriForUpload(uri: string): Promise<{ uri: string; filename: string }> {
  const needsCopy = Platform.OS === 'android' && uri.startsWith('content://');
  if (!needsCopy) {
    const filename = uri.split('/').pop() ?? 'avatar.jpg';
    return { uri, filename };
  }
  const ext = uri.includes('.png') ? '.png' : '.jpg';
  const dest = `${FileSystem.cacheDirectory}avatar_${Date.now()}${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return { uri: dest, filename: `avatar${ext}` };
}

export async function updateAvatar(uri: string, filename?: string): Promise<UserDto> {
  const { uri: uploadUri, filename: uploadFilename } = await ensureFileUriForUpload(uri);
  const formData = new FormData();
  const name = filename ?? uploadFilename;
  const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  formData.append('avatar', {
    uri: uploadUri,
    name,
    type,
  } as unknown as Blob);
  try {
    return await apiClient.patchMultipart<UserDto>('/api/auth/avatar', formData);
  } finally {
    // Clean up temporary cache file created by ensureFileUriForUpload (Android content:// copy)
    if (uploadUri !== uri) {
      FileSystem.deleteAsync(uploadUri, { idempotent: true }).catch(() => {});
    }
  }
}
