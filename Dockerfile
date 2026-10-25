# Builds the static React app and serves it with nginx, proxying /api,
# /socket.io and /health to the backend so the browser sees one origin
# (cookies stay first-party; no API URL is baked into the bundle).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Public values only. Never pass secrets as VITE_* build args.
ARG VITE_API_URL=
ARG VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_MAP_ATTRIBUTION="&copy; OpenStreetMap contributors"
ENV VITE_API_URL=$VITE_API_URL VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
