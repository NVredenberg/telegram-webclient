
FROM node:18-bullseye

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js ./server.js
COPY tdlib ./tdlib

# Für TDLib Session (wird im Volume gespeichert)
RUN mkdir -p /app/session_data

CMD ["node", "server.js"]
