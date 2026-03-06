/**
 * Config plugin para evitar timeout do JitPack ao resolver org.jitsi:webrtc.
 * 1. Força versão 124.0.0 (evita metadata fetch que causa timeout)
 * 2. Exclui org.jitsi do JitPack para usar Maven Central
 */
const { withProjectBuildGradle } = require("@expo/config-plugins");

const RESOLUTION_BLOCK = `  configurations.all {
    resolutionStrategy {
      force 'org.jitsi:webrtc:124.0.0'
    }
  }
`;

function withJitsiMavenCentral(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Força org.jitsi:webrtc:124.0.0 (evita 124.+ que exige metadata do JitPack)
    if (!contents.includes("force 'org.jitsi:webrtc:124.0.0'")) {
      contents = contents.replace(
        /(allprojects\s*\{\s*\n)/,
        "$1" + RESOLUTION_BLOCK + "\n"
      );
    }

    // 2. Exclui org.jitsi do JitPack
    const jitpackWithExclude = `maven {
      url 'https://www.jitpack.io'
      content {
        excludeGroup "org.jitsi"
      }
    }`;
    if (!contents.includes('excludeGroup "org.jitsi"')) {
      contents = contents.replace(
        /maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\}/,
        jitpackWithExclude
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withJitsiMavenCentral;
