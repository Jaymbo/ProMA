# ProMA – Production-Image (multi-stage)
# Build:  docker build -t proma .
# Run:    docker run -p 3210:3000 -v ./data:/app/data -v ./uploads:/app/uploads proma

# ---- Build-Stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime-Stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Nur das nötige Runtime-Artefakt (adapter-node Output)
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Statische Assets (Icons, manifest, Service Worker)
COPY --from=build /app/static ./static
# Hinweis: adapter-node liefert /static über den Node-Prozess aus

EXPOSE 3000
CMD ["node", "build/index.js"]
