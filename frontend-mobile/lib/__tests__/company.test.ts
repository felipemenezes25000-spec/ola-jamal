import { COMPANY } from '../company';

describe('company', () => {
  it('expõe nome e CNPJ', () => {
    expect(COMPANY.name).toBe('RenoveJá Saúde');
    expect(COMPANY.cnpj).toBe('65.947.180/0001-69');
  });

  it('expõe endereço e contato', () => {
    expect(COMPANY.address).toBeTruthy();
    expect(COMPANY.phone).toBe('(11) 98631-8000');
    expect(COMPANY.website).toBe('www.renovejasaude.com.br');
    expect(COMPANY.fullContact).toContain('98631-8000');
    expect(COMPANY.whatsapp).toContain('wa.me');
  });
});
