FROM nginx:alpine

# Nginx Konfiguration für SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Frontend-Dateien kopieren
COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
