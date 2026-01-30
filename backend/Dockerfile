# ./backend/Dockerfile
FROM node:18-bullseye

WORKDIR /app

# package.json + lockfile zuerst kopieren (Cache-freundlich)
COPY package.json package-lock.json ./

# reproduzierbarer Prod-Install
RUN npm ci --omit=dev

# Restliche App-Dateien
COPY . .

ENV NODE_ENV=production
EXPOSE 1993

CMD ["node", "server.js"]