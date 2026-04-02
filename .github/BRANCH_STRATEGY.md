# Git Flow — RenoveJá+

## Visao geral

```
feature/* ──┐
fix/*     ──┤
            ▼
        develop  ───── CI (lint + test + build)
            │
      release/* ──┐
      hotfix/*  ──┤
                  ▼
              main  ───── CI → Deploy (AWS ECS + S3/CloudFront)
```

---

## Branches principais

| Branch    | Proposito                 | Protegida? | Deploy         |
|-----------|---------------------------|------------|----------------|
| `main`    | Codigo em producao        | Sim — PR + CI obrigatorio | Automatico (AWS) |
| `develop` | Integracao de features    | Sim — PR + CI obrigatorio | Nenhum (apenas CI) |

## Branches de trabalho

| Prefixo      | Origem    | Destino              | Uso                             |
|--------------|-----------|----------------------|---------------------------------|
| `feature/*`  | `develop` | `develop`            | Novas funcionalidades           |
| `fix/*`      | `develop` | `develop`            | Correcoes nao-urgentes          |
| `hotfix/*`   | `main`    | `main` + `develop`   | Correcoes urgentes de producao  |
| `release/*`  | `develop` | `main` + `develop`   | Preparacao de release           |

---

## Fluxo de trabalho

### Feature / Fix

```bash
git checkout develop
git checkout -b feature/minha-feature
# ... trabalha ...
git push -u origin feature/minha-feature
# Abre PR para develop
```

### Release

```bash
git checkout develop
git checkout -b release/1.2.0
# ... ajustes finais, bump de versao ...
git push -u origin release/1.2.0
# Abre PR para main
# Apos merge em main, merge back em develop
```

### Hotfix

```bash
git checkout main
git checkout -b hotfix/fix-critico
# ... corrige ...
git push -u origin hotfix/fix-critico
# Abre PR para main
# Apos merge em main, merge back em develop
```

---

## Pipeline CI/CD

### CI (`ci.yml`)

Roda em **push** e **PR** para `main` e `develop`.
**Path filters:** cada job so roda quando arquivos do seu modulo mudam (via `dorny/paths-filter`).

| Modulo           | Path filter          | Steps                                    |
|------------------|----------------------|------------------------------------------|
| Backend (.NET)   | `backend-dotnet/**`  | restore → build → test                   |
| Backend Docker   | `backend-dotnet/**`  | docker build (valida Dockerfile)         |
| Frontend Web     | `frontend-web/**`    | install → lint → test → build            |
| Frontend Mobile  | `frontend-mobile/**` | install → typecheck → lint → test → export |

### Deploy (`deploy-aws.yml`)

Roda **apenas** para `main`, apos CI verde.

```
CI verde (main) ──→ Deploy Backend (ECS)
                ──→ Deploy Frontend (S3/CloudFront)

workflow_dispatch ──→ Test Gate (todos os modulos) ──→ Deploy
```

- **Trigger automatico:** apos CI passar em `main` — deploy direto (CI ja validou)
- **Trigger manual:** `workflow_dispatch` — roda testes antes de deployar
- **Concurrency:** apenas um deploy por vez, sem cancelar o em andamento

| Componente | Destino                       | Estrategia          |
|------------|-------------------------------|---------------------|
| Backend    | AWS ECS Fargate (sa-east-1)   | Rolling deployment  |
| Frontend   | AWS S3 + CloudFront           | Sync + invalidation |

### Build Android (`build-android.yml`)

Disparado **manualmente** (`workflow_dispatch`). Gera APK release/debug.

---

## Regras

1. **Nunca** faca push direto em `main` ou `develop`
2. Todo merge requer **PR aprovado** + **CI passando**
3. Branches de trabalho devem ser deletadas apos merge
4. Commits devem seguir [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nova funcionalidade
   - `fix:` correcao de bug
   - `chore:` manutencao
   - `docs:` documentacao
   - `refactor:` refatoracao
   - `test:` testes
   - `ci:` mudancas de CI/CD

---

## Pre-push hook (local)

Antes de cada `git push`, o hook Husky **detecta quais modulos foram alterados** e so roda verificacoes para esses modulos.

| Modulo           | Condicao                        | Steps                    |
|------------------|---------------------------------|--------------------------|
| Frontend Web     | arquivos em `frontend-web/`     | lint → test              |
| Frontend Mobile  | arquivos em `frontend-mobile/`  | lint → typecheck → test  |
| Backend .NET     | arquivos em `backend-dotnet/`   | build → test             |

- Se apenas docs/infra/CI mudaram, o hook **pula todos os testes**
- Se qualquer step falhar, o push e abortado

---

## Protecao de branches (GitHub Settings)

### `main`

- [x] Require pull request before merging (1 approval)
- [x] Require status checks to pass: `Backend (.NET)`, `Frontend Web`, `Frontend Mobile (Expo)`
- [x] Require branches to be up to date before merging
- [x] Do not allow force pushes
- [x] Do not allow deletions

### `develop`

- [x] Require pull request before merging (1 approval)
- [x] Require status checks to pass: `Backend (.NET)`, `Frontend Web`, `Frontend Mobile (Expo)`
- [x] Do not allow force pushes
