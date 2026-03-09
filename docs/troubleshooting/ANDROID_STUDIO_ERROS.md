# Android Studio — Erros comuns e correções

## 1. "Unsupported class file major version 69"

**Causa:** O Gradle está rodando com Java 25, mas o projeto (React Native/Expo) precisa de **Java 17**.

**Solução A — No Android Studio:**
1. **File** → **Settings** (ou **Ctrl+Alt+S**)
2. **Build, Execution, Deployment** → **Build Tools** → **Gradle**
3. Em **Gradle JDK**, selecione **JDK 17** (ou "Download JDK" → escolha 17)
4. Clique **Apply** → **OK**
5. **File** → **Sync Project with Gradle Files**

**Solução B — Via gradle.properties:**
1. Abra `frontend-mobile/android/gradle.properties`
2. Adicione (ajuste o caminho se o JDK 17 estiver em outro lugar):
   ```
   org.gradle.java.home=C:\\Program Files\\Java\\jdk-17
   ```
3. Salve e sincronize o projeto

**Solução C — Instalar JDK 17:**
- Baixe: https://adoptium.net/temurin/releases/?version=17
- Instale e depois use a Solução A ou B

---

## 2. "google-services.json" não encontrado

**Causa:** O arquivo é injetado no CI pelo secret `GOOGLE_SERVICES_JSON_BASE64`. Localmente ele não existe.

**Solução:**
1. Baixe o `google-services.json` do Firebase Console (seu app Android)
2. Coloque em: `frontend-mobile/android/app/google-services.json`

Ou, para builds sem Firebase (apenas debug):
- O build pode falhar. Adicione um `google-services.json` mínimo ou desabilite o plugin temporariamente.

---

## 3. Sync falha com "Could not resolve..."

**Causa:** Dependências não baixadas ou cache corrompido.

**Solução:**
1. No terminal: `cd frontend-mobile && npm ci`
2. No Android Studio: **File** → **Invalidate Caches** → **Invalidate and Restart**
3. Depois: **File** → **Sync Project with Gradle Files**

---

## 4. "SDK location not found"

**Causa:** `local.properties` não existe (gerado pelo Android Studio).

**Solução:**
1. Crie `frontend-mobile/android/local.properties`
2. Adicione (ajuste o caminho do seu SDK):
   ```
   sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
   ```
3. O Android Studio geralmente cria isso ao abrir o projeto.

---

## 5. Build via terminal (recomendado)

Para evitar problemas do Android Studio, use:

```bash
cd frontend-mobile
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
```

Ou, para release (com o secret no CI):
- Use o workflow **Build Android APK** no GitHub Actions.
