const Reanimated = require('react-native-reanimated/mock');

// Sobrescreve funções que causam problemas em jest
Reanimated.default.call = () => {};

module.exports = Reanimated;
