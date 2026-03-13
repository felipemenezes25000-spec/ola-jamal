/**
 * withFixLibraryManifests.js
 *
 * Remove o atributo `package=` de manifestos de bibliotecas RN que ainda não
 * migraram para o modelo de namespace do AGP 8 / SDK 36.
 *
 * Com compileSdk/targetSdk 36 o atributo `package` no <manifest> é proibido.
 * O AGP 8 injeta o namespace do app como `root@package` internamente; se uma
 * biblioteca *também* declara `package=`, o manifest merger falha:
 *   "Attribute root@package ... is also present at [...] Attributes of
 *    <manifest> elements are not merged."
 *
 * Estratégia dupla:
 *  1. withDangerousMod (fase BEFORE): edita node_modules ANTES do prebuild
 *     gerar os arquivos Android — garante que o Gradle nunca veja o package=.
 *  2. withAppBuildGradle: injeta um Gradle task `stripManifestPackageAttrs`
 *     que roda antes do processReleaseMainManifest como fallback definitivo,
 *     mesmo que o EAS restaure node_modules do cache depois da fase 1.
 */
const { withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Lista de manifestos de bibliotecas com package= hardcoded ───────────────
const LIBRARY_MANIFESTS_RELATIVE = [
  'node_modules/@react-native-google-signin/google-signin/android/src/main/AndroidManifest.xml',
  'node_modules/@daily-co/react-native-webrtc/android/src/main/AndroidManifest.xml',
  'node_modules/@react-native-async-storage/async-storage/android/src/main/AndroidManifest.xml',
  'node_modules/react-native-background-timer/android/src/main/AndroidManifest.xml',
  'node_modules/@react-native-community/netinfo/android/src/main/AndroidManifest.xml',
  'node_modules/react-native-get-random-values/android/src/main/AndroidManifest.xml',
  'node_modules/@sentry/react-native/android/src/main/AndroidManifest.xml',
  'node_modules/react-native-safe-area-context/android/src/main/AndroidManifest.xml',
];

// Regex que captura `package="..."` em qualquer posição dentro da tag <manifest>
const PACKAGE_ATTR_RE = /(\s+package\s*=\s*"[^"]*")/g;

function stripPackageAttr(content) {
  // Só modifica o atributo package dentro da tag <manifest ...>
  return content.replace(
    /(<manifest\b)([\s\S]*?)(>)/,
    (match, open, attrs, close) => {
      const stripped = attrs.replace(PACKAGE_ATTR_RE, '');
      return open + stripped + close;
    }
  );
}

function patchManifests(projectRoot) {
  for (const rel of LIBRARY_MANIFESTS_RELATIVE) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, 'utf8');
    const patched = stripPackageAttr(original);
    if (patched !== original) {
      fs.writeFileSync(abs, patched, 'utf8');
      console.log(`[withFixLibraryManifests] ✓ Removido package= de ${rel}`);
    }
  }
}

// ─── Gradle task injetado no app/build.gradle ────────────────────────────────
const GRADLE_TASK = `
// ── stripManifestPackageAttrs ─────────────────────────────────────────────────
// Remove atributo package= de manifestos de libs não migradas para AGP 8/SDK 36.
// Tenta múltiplos caminhos para funcionar tanto local quanto no EAS Build.
def manifestsToStrip = [
  "node_modules/@react-native-google-signin/google-signin/android/src/main/AndroidManifest.xml",
  "node_modules/@daily-co/react-native-webrtc/android/src/main/AndroidManifest.xml",
  "node_modules/@react-native-async-storage/async-storage/android/src/main/AndroidManifest.xml",
  "node_modules/react-native-background-timer/android/src/main/AndroidManifest.xml",
  "node_modules/@react-native-community/netinfo/android/src/main/AndroidManifest.xml",
  "node_modules/react-native-get-random-values/android/src/main/AndroidManifest.xml",
  "node_modules/@sentry/react-native/android/src/main/AndroidManifest.xml",
  "node_modules/react-native-safe-area-context/android/src/main/AndroidManifest.xml",
]

task stripManifestPackageAttrs {
  doLast {
    def candidates = [
      rootProject.projectDir.parentFile,
      rootProject.projectDir,
    ]
    manifestsToStrip.each { rel ->
      for (base in candidates) {
        def f = new File(base, rel)
        if (f.exists()) {
          def txt = f.text
          def updated = txt.replaceAll('(?s)(\\\\s+)package\\\\s*=\\\\s*"[^"]*"', '')
          if (updated != txt) {
            f.text = updated
            println "[stripManifestPackageAttrs] ✓ Removido package= de \${f.absolutePath}"
          }
          break
        }
      }
    }
  }
}

tasks.whenTaskAdded { task ->
  if (task.name == 'processReleaseMainManifest' || task.name == 'processDebugMainManifest') {
    task.dependsOn stripManifestPackageAttrs
  }
}
// ─────────────────────────────────────────────────────────────────────────────
`;

function withFixLibraryManifests(config) {
  // Fase 1: modifica node_modules durante o prebuild
  config = withDangerousMod(config, [
    'android',
    (config) => {
      patchManifests(config.modRequest.projectRoot);
      return config;
    },
  ]);

  // Fase 2: injeta Gradle task como fallback
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('stripManifestPackageAttrs')) {
      config.modResults.contents += GRADLE_TASK;
    }
    return config;
  });

  return config;
}

module.exports = withFixLibraryManifests;
