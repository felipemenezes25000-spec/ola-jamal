-- Tabela de preços fixos por produto (prescrição, exame, consulta)
-- O valor é consultado quando o médico aprova (não informa na API) e quando o paciente vai pagar.
-- Execute no SQL Editor do Supabase se precisar recriar ou alterar preços.

-- Estrutura (já criada pela migration create_product_prices_table)
-- product_type: prescription | exam | consultation
-- subtype: para prescription = simples | controlado | azul; para exam/consultation = default

SELECT * FROM product_prices WHERE is_active = true;

-- Exemplo: alterar preço da receita simples
-- UPDATE product_prices SET price_brl = 55.00, updated_at = now() WHERE product_type = 'prescription' AND subtype = 'simples';
