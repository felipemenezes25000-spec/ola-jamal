/**
 * requestCache — In-memory LRU cache for request data.
 *
 * Prevents redundant API calls when navigating between
 * request list and detail screens.
 */

import type { RequestResponseDto } from '../types/database';

const MAX_CACHE_SIZE = 50;
const _requestCache = new Map<string, RequestResponseDto>();

export function cacheRequest(r: RequestResponseDto): void {
  if (_requestCache.size >= MAX_CACHE_SIZE) {
    const firstKey = _requestCache.keys().next().value;
    if (firstKey) _requestCache.delete(firstKey);
  }
  _requestCache.set(r.id, r);
}

export function getCachedRequest(id: string): RequestResponseDto | undefined {
  return _requestCache.get(id);
}
