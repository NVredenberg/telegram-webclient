FROM node:18-bullseye

WORKDIR /app

# Build-Dependencies für native Module
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
 && rm -rf /var/lib/apt/lists/*

# Manifest(e) zuerst, damit Layer-Caching funktioniert
COPY package*.json ./

# Install (mit deinen Retries)
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --omit=dev || \
    (sleep 10 && npm install --omit=dev) || \
    (sleep 20 && npm install --omit=dev)

# App-Code und TDLib-Pfad
COPY server.js ./server.js
COPY tdlib ./tdlib

# TDLib für den Loader bekannt machen (wichtig für Addon)
ENV LD_LIBRARY_PATH=/app/tdlib

# Verzeichnisse, Healthcheck, User
RUN mkdir -p /app/session_data /app/uploads

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1993/auth/status', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

RUN groupadd -r telegram && useradd -r -g telegram telegram && \
    chown -R telegram:telegram /app
USER telegram

EXPOSE 1993
CMD ["node", "server.js"]