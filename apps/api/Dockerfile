FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile=false

EXPOSE 3000
CMD ["pnpm", "--filter", "@whaler/api", "start"]
