FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

ARG VITE_API_URL
ARG VITE_COLLAB_URL
ARG VITE_VOICE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_COLLAB_URL=$VITE_COLLAB_URL
ENV VITE_VOICE_URL=$VITE_VOICE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @whaler/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
