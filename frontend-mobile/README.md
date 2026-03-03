# RenoveJá+ — App Mobile (Paciente e Médico)

Aplicativo mobile do **RenoveJá+**, feito com **Expo (React Native)** e **TypeScript**, focado em experiência do paciente e do médico para:

- Renovação de receitas
- Pedidos de exames
- Consultas por vídeo
- Acompanhamento de status e notificações

Este app conversa com o **backend .NET** e com o **Supabase** (banco + realtime).

---

## 🎯 Escopo e principais recursos

### Para pacientes

- 📱 Autenticação completa (login, cadastro, esqueci minha senha)
- 💊 Solicitar renovação de receitas (simples, controladas, azul)
- 🔬 Solicitar pedidos de exame
- 📹 Agendar/entrar em consultas por vídeo
- 💬 Chat em tempo quase real com o médico
- 💳 Pagamento via **PIX** (QR Code + copia e cola)
- 📄 Visualizar e baixar PDFs assinados (receitas e pedidos)
- 🔔 Notificações de status das solicitações
- 👤 Gerenciar perfil (dados pessoais e de saúde)

### Para médicos

- 🏥 Dashboard com fila de solicitações e indicadores básicos
- 📋 Ver solicitações disponíveis e atribuídas
- ✅ Assumir e revisar solicitações de pacientes
- ✍️ Aprovar/rejeitar com comentários
- 🔏 Assinar digitalmente receitas/pedidos (integração com backend)
- 💬 Chat com pacientes atrelado à solicitação
- 📹 Entrar em salas de vídeo para consultas
- 👨‍⚕️ Gerenciar perfil profissional (CRM, especialidade, bio)

---

## 🧱 Stack técnica

- **Framework**: Expo SDK 54 + Expo Router (file-based routing)
- **Linguagem**: TypeScript
- **Backend principal**: API .NET 8 (`backend-dotnet`)
- **Backend de dados**: Supabase (PostgreSQL + Realtime)
- **Navegação**: Expo Router (grupos `(auth)`, `(patient)`, `(doctor)`)
- **Estado**: React Context API
- **Armazenamento local**: AsyncStorage
- **UI**: componentes customizados com paleta azul
- **Realtime**: Supabase Realtime (chat, atualizações de requests)
- **Imagens**: Expo Image Picker
- **Notificações push**: Expo Notifications

---

## 📁 Estrutura do projeto

```text
frontend-mobile/
├── app/                          # Telas (Expo Router)
│   ├── (auth)/                   # Fluxo de autenticação
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (patient)/                # Fluxo paciente (tabs)
│   │   ├── home.tsx
│   │   ├── requests.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── (doctor)/                 # Fluxo médico (tabs)
│   │   ├── dashboard.tsx
│   │   ├── requests.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── new-request/              # Criação de solicitações
│   │   ├── prescription.tsx
│   │   ├── exam.tsx
│   │   └── consultation.tsx
│   ├── request-detail/[id].tsx   # Detalhe da solicitação (paciente)
│   ├── doctor-request/[id].tsx   # Revisão da solicitação (médico)
│   ├── chat/[id].tsx             # Chat em tempo real
│   ├── payment/[id].tsx          # Pagamento PIX
│   ├── video-call/[id].tsx       # Consulta por vídeo
│   ├── index.tsx                 # Splash / root
│   └── _layout.tsx               # Layout raiz (rotas)
├── components/                   # Componentes reutilizáveis
├── contexts/                     # Contextos (ex.: AuthContext)
├── lib/                          # Integrações (ex.: Supabase, API)
├── types/                        # Tipos TypeScript
├── constants/                    # Tema, constantes, cores
└── assets/                       # Ícones, logos, fontes, etc.
```

---

## 🎨 Paleta de cores

Toda a identidade visual do app segue uma paleta **azul**, alinhada ao restante da plataforma:

- Primary: `#0EA5E9`
- Primary Light: `#38BDF8`
- Primary Lighter: `#7DD3FC`
- Primary Dark: `#0284C7`
- Primary Darker: `#0369A1`
- Primary Pale: `#BAE6FD`
- Primary Paler: `#E0F7FF`

---

## 🗄️ Modelo de dados (Supabase)

Principais tabelas utilizadas (em conjunto com o backend .NET):

- `users` — usuários (pacientes e médicos)
- `doctor_profiles` — dados adicionais do médico
- `requests` — solicitações (receita, exame, consulta)
- `payments` — pagamentos
- `chat_messages` — mensagens de chat por solicitação
- `notifications` — notificações do usuário
- `video_rooms` — salas de vídeo
- `product_prices` — preços/planos de serviços
- `push_tokens` — tokens de push notification

---

## 🔐 Autenticação

O app usa **autenticação customizada** integrada ao backend:

1. Login chama o backend .NET, que valida credenciais usando Supabase.
2. O backend gera tokens e persiste em tabela (`auth_tokens` / equivalente).
3. O app armazena o token de sessão em AsyncStorage.
4. As próximas chamadas à API usam `Authorization: Bearer <token>`.

> A implementação exata pode variar conforme a versão do backend; consulte o `backend-dotnet/README.md` para detalhes.

---

## 🔁 Fluxo de status das solicitações

### Receitas / exames

```text
submitted → pending_payment → paid → in_review → approved → signed → delivered → completed
```

### Consultas

```text
submitted → searching_doctor → consultation_ready → in_consultation → consultation_finished → completed
```

Esses status são exibidos no app e consumidos diretamente do backend.

---

## 🚀 Como rodar o app

### Pré-requisitos

- **Node.js 18+**
- **npm** ou **yarn**
- **Expo CLI** (`npm install -g expo-cli` se quiser usar global)
- Dispositivo físico com **Expo Go** ou emulador iOS/Android

### Passos

```bash
cd frontend-mobile

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm start

# iOS (se disponível)
npm run ios

# Android (emulador ou dispositivo)
npm run android
```

> Para testar em dispositivo físico na mesma rede, ajuste `EXPO_PUBLIC_API_URL` no `.env` da raiz do app apontando para o IP da sua máquina rodando o backend.

---

## 🔑 Variáveis de ambiente

Arquivo esperado: `frontend-mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://SEU_IP:5000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

- `EXPO_PUBLIC_API_URL` — URL base do backend .NET (dev/prod).
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Client ID para login com Google (quando habilitado).

---

## ⚠️ Limitações conhecidas (mobile)

- Integrações avançadas (vídeo, push, assinatura) dependem da configuração correta do backend e de serviços externos.
- Algumas telas podem ficar em modo “somente leitura” se o backend não estiver com todas as migrations aplicadas.

---

## 📄 Licença

Uso privado — Plataforma RenoveJá+. Todos os direitos reservados.

