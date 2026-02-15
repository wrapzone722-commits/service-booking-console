# Сборка SPA (Vite + React)
# Опционально: docker build --build-arg VITE_API_BASE_URL=https://ваш-бэкенд.ru .
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Раздача статики через nginx (SPA: маршруты → index.html)
FROM nginx:alpine AS runtime
WORKDIR /usr/share/nginx/html

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime config: генерируем /config.json из переменной API_BASE_URL (или VITE_API_BASE_URL)
COPY docker-entrypoint.d/99-runtime-config.sh /docker-entrypoint.d/99-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/99-runtime-config.sh

COPY --from=builder /app/dist .

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
