# Obol in one container — for Hugging Face Spaces (Docker SDK) or any host.
#
# Runs the x402 data market (:4020, internal) and the Next.js app (on $PORT).
# The agent is spawned per run as a child process by the web app. The SQLite
# ledger lives in /tmp so it's writable regardless of the runtime user.
FROM node:20-slim

# Native build deps for better-sqlite3.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

ENV NODE_ENV=production
# Hugging Face Spaces routes the public URL to this port.
ENV PORT=7860
# Data market stays internal to the container.
ENV DATA_SERVER_URL=http://localhost:4020
# Writable ledger location (the default repo path may be read-only).
ENV OBOL_DB_PATH=/tmp/obol/obol.db

EXPOSE 7860

CMD ["sh", "deploy/hf-start.sh"]
