FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build:ui
RUN npx tsc -p tsconfig.server.json

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/main.js /app/server.js ./
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
RUN find . -name "*.ts" -not -path "./node_modules/*" -delete
EXPOSE 3000
CMD ["node", "main.js"]
