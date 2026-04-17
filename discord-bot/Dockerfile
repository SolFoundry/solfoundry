FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

# Data directory for SQLite
RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]