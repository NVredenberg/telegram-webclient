FROM node:18-bullseye

WORKDIR /app

# Build-Dependencies für native Module installieren
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Dependencies installieren (mit Retry-Logik)
COPY package*.json ./

# npm mit mehr Timeout und Retries konfigurieren
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --omit=dev || \
    (sleep 10 && npm install --omit=dev) || \
    (sleep 20 && npm install --omit=dev)

# App-Code kopieren
COPY server.js ./server.js
COPY tdlib ./tdlib

# Verzeichnisse vorbereiten
RUN mkdir -p /app/session_data /app/uploads

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1993/auth/status', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Non-root User für Security
RUN groupadd -r telegram && useradd -r -g telegram telegram && \
    chown -R telegram:telegram /app
USER telegram

EXPOSE 1993

CMD ["node", "server.js"]