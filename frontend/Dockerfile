# ── Stage: serve pre-built Vite bundle with nginx ───────────────────────────
# The CI pipeline builds dist/ as an artifact and passes it to kaniko context.
# This Dockerfile just copies dist/ into nginx — no Node.js needed at runtime.
FROM nginx:1.27-alpine

# Copy pre-built Vite output
COPY dist/ /usr/share/nginx/html/

# nginx config with SPA fallback + API/WebSocket proxy to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
