FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile=false

ENV VOICE_PORT=3003
EXPOSE 3003
EXPOSE 40000-40100/udp
EXPOSE 40000-40100/tcp
CMD ["pnpm", "--filter", "@whaler/voice", "start"]
