FROM node:20-alpine

WORKDIR /app

# Шрифт для PDF (кириллица) + зависимости для сборки better-sqlite3 (native module)
RUN apk add --no-cache ttf-dejavu python3 make g++ sqlite-dev

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
# ВАЖНО: по умолчанию кладём SQLite на /data (его надо монтировать как volume)
ENV DB_PATH=/data/service_booking.db
# Шрифт для PDF (кириллица) — пакет ttf-dejavu
ENV ACT_FONT_PATH=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf

VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server.js"]

