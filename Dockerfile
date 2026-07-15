# OPTIC — Railway deploy image
# node:20-bookworm has glibc prebuilds for better-sqlite3 and @resvg/resvg-js.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# runtime assets: card fonts (read from cwd) + fixtures (CLI fallbacks) + marketing site
COPY assets ./assets
COPY fixtures ./fixtures
COPY site ./site
EXPOSE 3000
CMD ["node", "dist/server.js"]
