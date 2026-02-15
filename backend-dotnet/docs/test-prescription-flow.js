/**
 * Script para testar o fluxo de receita com IA.
 * Uso: node test-prescription-flow.js [caminho-da-imagem.jpg]
 * Ex: node test-prescription-flow.js ./receita-teste.jpg
 *
 * Se não passar o caminho, usa uma imagem mínima para testar a estrutura da API.
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_EMAIL = `test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'Test123!@#';

// PNG 1x1 mínimo (válido)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
  0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59,
  0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82
]);

const logFile = path.join(__dirname, 'test-result.json');
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  console.log(msg);
}

async function main() {
  const imagePath = process.argv[2];
  let imageBuffer;
  let imageName = 'test.png';

  if (imagePath && fs.existsSync(imagePath)) {
    imageBuffer = fs.readFileSync(imagePath);
    imageName = path.basename(imagePath);
    log('Usando imagem:', imagePath);
  } else {
    imageBuffer = MINIMAL_PNG;
    log('Usando imagem mínima (placeholder). Passe um arquivo: node test-prescription-flow.js ./sua-receita.jpg');
  }

  log('\n1. Registrando usuário de teste...');
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: 'Teste',
      phone: '11999999999',
      cpf: '12345678901',
      birthDate: '1990-01-01'
    })
  });

  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({}));
    fs.writeFileSync(logFile, JSON.stringify({ passo: 'register', status: regRes.status, erro: err }, null, 2), 'utf8');
    log('Erro ao registrar:', regRes.status, JSON.stringify(err, null, 2));
    process.exit(1);
  }

  log('2. Fazendo login...');
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });

  if (!loginRes.ok) {
    const err = await loginRes.json().catch(() => ({}));
    fs.writeFileSync(logFile, JSON.stringify({ passo: 'login', status: loginRes.status, erro: err }, null, 2), 'utf8');
    log('Erro ao fazer login:', loginRes.status, JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const { token } = await loginRes.json();
  if (!token) {
    log('Token não retornado no login');
    process.exit(1);
  }

  log('3. Criando solicitação de receita com imagem...');
  const form = new FormData();
  form.append('prescriptionType', 'simples');
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  form.append('images', blob, imageName);

  const prescRes = await fetch(`${API_URL}/api/requests/prescription`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });

  const data = await prescRes.json().catch(() => ({}));

  log('\n--- RESPOSTA DA API ---');
  log('Status:', prescRes.status);
  log(JSON.stringify(data, null, 2));

  const result = { status: prescRes.status, data };
  if (data.request) {
    const r = data.request;
    result.resumo = r.aiSummaryForDoctor;
    result.risco = r.aiRiskLevel;
    result.legibilidadeOk = r.aiReadabilityOk;
    result.mensagemUsuario = r.aiMessageToUser;
    if (r.aiSummaryForDoctor) log('\n>>> Resumo para o médico:', r.aiSummaryForDoctor);
    if (r.aiRiskLevel) log('>>> Risco:', r.aiRiskLevel);
    if (r.aiReadabilityOk === false) log('>>> Legibilidade: imagem ilegível -', r.aiMessageToUser);
  }
  fs.writeFileSync(logFile, JSON.stringify(result, null, 2), 'utf8');
  log('\nResultado salvo em:', logFile);
}

main().catch(e => {
  const errResult = { erro: e.message || String(e), stack: e.stack };
  fs.writeFileSync(logFile, JSON.stringify(errResult, null, 2), 'utf8');
  log('Erro:', e.message);
  process.exit(1);
});
