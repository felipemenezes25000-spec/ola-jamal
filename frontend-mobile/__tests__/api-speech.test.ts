/**
 * api-speech.test.ts
 *
 * Testa a função transcribeSymptomAudio que envia áudio para STT + polish.
 */

const mockPost = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('../lib/api-client', () => ({
  apiClient: {
    post: mockPost,
  },
}));

import { transcribeSymptomAudio } from '../lib/api-speech';

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('transcribeSymptomAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envia FormData com file para o endpoint correto', async () => {
    mockPost.mockResolvedValueOnce({
      transcribed: true,
      raw: 'dor de cabeça',
      polished: 'Dor de cabeça.',
      text: 'Dor de cabeça.',
    });

    const audioFile = { uri: 'file://symptom.m4a', name: 'symptom.m4a', type: 'audio/mp4' };
    const result = await transcribeSymptomAudio(audioFile, 'Exame laboratorial');

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, formData, isMultipart] = mockPost.mock.calls[0];
    expect(url).toBe('/api/speech-to-text/symptom');
    expect(isMultipart).toBe(true);
    expect(formData).toBeInstanceOf(FormData);
    expect(result.transcribed).toBe(true);
    expect(result.text).toBe('Dor de cabeça.');
  });

  it('envia sem context quando não fornecido', async () => {
    mockPost.mockResolvedValueOnce({
      transcribed: false,
      raw: '',
      polished: '',
      text: '',
    });

    const audioFile = { uri: 'file://symptom.m4a', name: 'symptom.m4a', type: 'audio/mp4' };
    const result = await transcribeSymptomAudio(audioFile);

    expect(result.transcribed).toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('propaga erro da API', async () => {
    mockPost.mockRejectedValueOnce({ message: 'Timeout', status: 504 });

    const audioFile = { uri: 'file://symptom.m4a', name: 'symptom.m4a', type: 'audio/mp4' };

    await expect(transcribeSymptomAudio(audioFile)).rejects.toEqual(
      expect.objectContaining({ message: 'Timeout' }),
    );
  });

  it('retorna raw quando polished está vazio', async () => {
    mockPost.mockResolvedValueOnce({
      transcribed: true,
      raw: 'dor no peito',
      polished: null,
      text: 'dor no peito',
    });

    const audioFile = { uri: 'file://audio.m4a', name: 'audio.m4a', type: 'audio/mp4' };
    const result = await transcribeSymptomAudio(audioFile);

    expect(result.text).toBe('dor no peito');
  });
});
