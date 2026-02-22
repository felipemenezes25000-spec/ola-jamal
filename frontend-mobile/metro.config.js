const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

// Proxy /api requests to backend — avoids CORS issues on web
const apiProxy = createProxyMiddleware({
  target: process.env.EXPO_PUBLIC_API_URL || "https://renovejasaude.com.br",
  changeOrigin: true,
  secure: true,
  pathFilter: "/api/**",
  on: {
    proxyReq: (proxyReq) => {
      // ngrok free tier returns an HTML warning page without this header
      proxyReq.setHeader("ngrok-skip-browser-warning", "true");
    },
  },
});

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url?.startsWith("/api/")) {
        return apiProxy(req, res, next);
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
