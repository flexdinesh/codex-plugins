FROM node:26-slim

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4317 \
    CODEX_PLUGINS_STATE_DIR=/logs

# Native TypeScript, Node built-ins only: no install or compilation needed.
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 4317
CMD ["node", "src/server.ts"]
