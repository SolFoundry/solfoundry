FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --production

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

COPY .env.example .env.example

VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
