FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY migrations ./migrations

EXPOSE 5000
CMD ["node", "src/server.js"]
