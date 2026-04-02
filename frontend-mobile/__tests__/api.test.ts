const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-file-system/legacy', () => ({
  copyAsync: jest.fn(({ from }: { from: string; to: string }) => Promise.resolve()),
  cacheDirectory: 'file:///cache/',
}));

jest.mock('../lib/analytics', () => ({
  trackApiLatency: jest.fn(),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;
(global as any).__DEV__ = true;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

function mockOkResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h: string) =>
        h === 'content-type' ? 'application/json' : null,
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function mockErrorResponse(status: number, body: any) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: {
      get: (h: string) =>
        h === 'content-type' ? 'application/json' : null,
    },
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

describe('api module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue('test-token-abc');
    jest.resetModules();
  });

  describe('fetchRequests', () => {
    it('calls GET /api/requests with auth header', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ items: [], total: 0 })
      );

      const { fetchRequests } = require('../lib/api');
      const result = await fetchRequests();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requests'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-abc',
          }),
        })
      );
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('passes filter params as query string', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ items: [], total: 0 })
      );

      const { fetchRequests } = require('../lib/api');
      await fetchRequests({ status: 'Pending', type: 'prescription', page: 2, pageSize: 10 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=Pending');
      expect(calledUrl).toContain('type=prescription');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('pageSize=10');
    });
  });

  describe('fetchRequestById', () => {
    it('calls GET /api/requests/:id', async () => {
      const mockRequest = { id: 'req-123', status: 'Pending' };
      mockFetch.mockResolvedValueOnce(mockOkResponse(mockRequest));

      const { fetchRequestById } = require('../lib/api');
      const result = await fetchRequestById('req-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requests/req-123'),
        expect.any(Object)
      );
      expect(result).toEqual(mockRequest);
    });
  });

  describe('fetchNotifications', () => {
    it('calls GET /api/notifications with pagination', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ items: [], total: 0 })
      );

      const { fetchNotifications } = require('../lib/api');
      await fetchNotifications(1, 20);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/notifications');
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('pageSize=20');
    });

    it('uses default page params when none provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ items: [], total: 0 })
      );

      const { fetchNotifications } = require('../lib/api');
      await fetchNotifications();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('pageSize=20');
    });
  });

  describe('markNotificationRead', () => {
    it('calls PUT /api/notifications/:id/read', async () => {
      mockFetch.mockResolvedValueOnce(mockOkResponse({ id: 'notif-1', read: true }));

      const { markNotificationRead } = require('../lib/api');
      await markNotificationRead('notif-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/notif-1/read'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('markNotificationAsRead (alias)', () => {
    it('delegates to markNotificationRead', async () => {
      mockFetch.mockResolvedValueOnce(mockOkResponse({ id: 'n-1' }));

      const { markNotificationAsRead } = require('../lib/api');
      await markNotificationAsRead('n-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/n-1/read'),
        expect.any(Object)
      );
    });
  });

  describe('createPrescriptionRequest', () => {
    it('sends JSON when no images', async () => {
      const mockResp = { request: { id: 'r-1' } };
      mockFetch.mockResolvedValueOnce(mockOkResponse(mockResp));

      const { createPrescriptionRequest } = require('../lib/api');
      await createPrescriptionRequest({
        prescriptionType: 'simples',
        medications: ['Paracetamol'],
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('/api/requests/prescription');
      const body = JSON.parse(callArgs[1].body);
      expect(body.prescriptionType).toBe('simples');
      expect(body.medications).toEqual(['Paracetamol']);
    });

    it('sends FormData when images provided', async () => {
      const mockResp = { request: { id: 'r-2' } };
      mockFetch.mockResolvedValueOnce(mockOkResponse(mockResp));

      const { createPrescriptionRequest } = require('../lib/api');
      await createPrescriptionRequest({
        prescriptionType: 'controlado',
        images: ['/path/to/image.jpg'],
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('/api/requests/prescription');
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(500, { message: 'Internal Server Error' })
      );

      const { fetchRequests } = require('../lib/api');
      await expect(fetchRequests()).rejects.toEqual(
        expect.objectContaining({ status: 500 })
      );
    });

    it('throws on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(401, { message: 'Unauthorized' })
      );

      const { fetchRequests } = require('../lib/api');
      await expect(fetchRequests()).rejects.toEqual(
        expect.objectContaining({ status: 401 })
      );
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const { fetchRequests } = require('../lib/api');
      await expect(fetchRequests()).rejects.toBeDefined();
    });
  });

  describe('approveRequest', () => {
    it('calls POST /api/requests/:id/approve', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ id: 'req-1', status: 'Approved' })
      );

      const { approveRequest } = require('../lib/api');
      const result = await approveRequest('req-1', {
        medications: ['Med A'],
        notes: 'OK',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requests/req-1/approve'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.status).toBe('Approved');
    });
  });

  describe('rejectRequest', () => {
    it('calls POST /api/requests/:id/reject with reason', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ id: 'req-1', status: 'Rejected' })
      );

      const { rejectRequest } = require('../lib/api');
      await rejectRequest('req-1', 'Receita ilegível');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.rejectionReason).toBe('Receita ilegível');
    });
  });

  describe('changePassword', () => {
    it('calls PATCH /api/auth/change-password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: (h: string) => (h === 'content-length' ? '0' : null) },
        text: () => Promise.resolve(''),
      });

      const { changePassword } = require('../lib/api');
      await changePassword('old123', 'new456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/change-password'),
        expect.objectContaining({ method: 'PATCH' })
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.currentPassword).toBe('old123');
      expect(body.newPassword).toBe('new456');
    });
  });

  describe('parseAiSuggestedExams', () => {
    it('parses valid JSON array', () => {
      const { parseAiSuggestedExams } = require('../lib/api');
      expect(parseAiSuggestedExams('["Hemograma","TSH"]')).toEqual([
        'Hemograma',
        'TSH',
      ]);
    });

    it('returns empty array for null/undefined', () => {
      const { parseAiSuggestedExams } = require('../lib/api');
      expect(parseAiSuggestedExams(null)).toEqual([]);
      expect(parseAiSuggestedExams(undefined)).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const { parseAiSuggestedExams } = require('../lib/api');
      expect(parseAiSuggestedExams('not json')).toEqual([]);
    });

    it('filters out non-string elements', () => {
      const { parseAiSuggestedExams } = require('../lib/api');
      expect(parseAiSuggestedExams('["ok", 123, null]')).toEqual(['ok']);
    });

    it('returns empty array for non-array JSON', () => {
      const { parseAiSuggestedExams } = require('../lib/api');
      expect(parseAiSuggestedExams('{"a": 1}')).toEqual([]);
    });
  });

  describe('sortRequestsByNewestFirst', () => {
    it('sorts by createdAt descending', () => {
      const { sortRequestsByNewestFirst } = require('../lib/api');
      const items = [
        { id: '1', createdAt: '2025-01-01T00:00:00Z' },
        { id: '2', createdAt: '2025-06-01T00:00:00Z' },
        { id: '3', createdAt: '2025-03-01T00:00:00Z' },
      ];
      const sorted = sortRequestsByNewestFirst(items);
      expect(sorted.map((r: any) => r.id)).toEqual(['2', '3', '1']);
    });

    it('breaks ties by updatedAt descending', () => {
      const { sortRequestsByNewestFirst } = require('../lib/api');
      const items = [
        { id: 'a', createdAt: '2025-06-01T00:00:00Z', updatedAt: '2025-06-01T10:00:00Z' },
        { id: 'b', createdAt: '2025-06-01T00:00:00Z', updatedAt: '2025-06-02T10:00:00Z' },
      ];
      const sorted = sortRequestsByNewestFirst(items);
      expect(sorted.map((r: any) => r.id)).toEqual(['b', 'a']);
    });

    it('does not mutate original array', () => {
      const { sortRequestsByNewestFirst } = require('../lib/api');
      const items = [
        { id: '1', createdAt: '2025-01-01T00:00:00Z' },
        { id: '2', createdAt: '2025-06-01T00:00:00Z' },
      ];
      const sorted = sortRequestsByNewestFirst(items);
      expect(items[0].id).toBe('1');
      expect(sorted).not.toBe(items);
    });
  });

  describe('aliases', () => {
    it('getRequests delegates to fetchRequests', async () => {
      mockFetch.mockResolvedValueOnce(
        mockOkResponse({ items: [], total: 0 })
      );

      const { getRequests } = require('../lib/api');
      await getRequests({ page: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/requests'),
        expect.any(Object)
      );
    });

    it('getRequestById is fetchRequestById', () => {
      const api = require('../lib/api');
      expect(api.getRequestById).toBe(api.fetchRequestById);
    });
  });
});
