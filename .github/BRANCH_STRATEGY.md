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

| Modulo           | Steps                                    |
|------------------|------------------------------------------|
| Backend (.NET)   | restore → build → test                   |
| Backend Docker   | docker build (valida Dockerfile)         |
| Frontend Web     | install → lint → test → build            |
| Frontend Mobile  | install → typecheck → lint → test → export |

### Deploy (`deploy-aws.yml`)

Roda **apenas** para `main`, apos CI verde.

```
CI verde (main) ──→ Testes (gate) ──→ Deploy Backend (ECS)
                                  ──→ Deploy Frontend (S3/CloudFront)
```

- **Trigger automatico:** apos CI passar em `main`
- **Trigger manual:** `workflow_dispatch` (tambem roda testes antes)
- **Testes como gate:** mesmo quando disparado manualmente, todos os testes rodam antes do deploy
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

Antes de cada `git push`, o hook Husky roda automaticamente:

```
frontend-web:    lint → test
frontend-mobile: lint → typecheck → test
backend-dotnet:  build → test
```

Se qualquer step falhar, o push e abortado.

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
