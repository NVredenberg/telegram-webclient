# ./backend/Dockerfile
FROM node:18-bullseye

# Arbeitsverzeichnis
WORKDIR /app

# Nur package.json zuerst kopieren, damit Docker-Layer-Cache greift
COPY package.json ./

# Prod-Dependencies installieren (kein dev)
RUN npm ci --omit=dev

# Restliche App-Dateien
COPY . .

# Node-Umgebungsvariable für schnelleren Start
ENV NODE_ENV=production

# Standard-Port (überschreibbar via Compose)
EXPOSE 1993

# Startkommando
CMD ["node", "server.js"]