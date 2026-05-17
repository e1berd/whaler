FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile=false

EXPOSE 3001
CMD ["pnpm", "--filter", "@whaler/collab", "start"]
