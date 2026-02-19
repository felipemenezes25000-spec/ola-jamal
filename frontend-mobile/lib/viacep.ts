/**
 * Resposta da API ViaCEP (https://viacep.com.br).
 * CEP inexistente retorna { erro: true }.
 */
export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: true;
}

export interface ViaCepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

const VIACEP_BASE = 'https://viacep.com.br/ws';

/**
 * Busca endereço pelo CEP (apenas dígitos, 8 caracteres).
 * Retorna rua (logradouro), bairro, cidade e UF.
 * Lança em caso de CEP inválido/inexistente ou falha de rede.
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepAddress> {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) {
    throw new Error('CEP deve ter 8 dígitos.');
  }

  const res = await fetch(`${VIACEP_BASE}/${digits}/json/`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Não foi possível consultar o CEP. Tente novamente.');
  }

  const data: ViaCepResponse = await res.json();

  if (data.erro === true) {
    throw new Error('CEP não encontrado.');
  }

  const street = (data.logradouro || '').trim();
  const neighborhood = (data.bairro || '').trim();
  const city = (data.localidade || '').trim();
  const state = (data.uf || '').trim().toUpperCase();

  return { street, neighborhood, city, state };
}
