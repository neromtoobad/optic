# OPTIC — Railway deploy image
# node:20-bookworm has glibc prebuilds for better-sqlite3, @resvg/resvg-js and sharp.
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

# Agent Reel renders MP4s with Remotion, which drives a headless Chrome shell. The shell
# binary is downloaded at build (below), but it still needs these shared libraries present
# at runtime — without them Chrome exits before the first frame and every render fails.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 libxkbcommon0 libxcomposite1 \
      libxdamage1 libxfixes3 libxrandr2 libxext6 libx11-6 libxcb1 libxshmfence1 \
      fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
# reel-studio is bundled by Remotion at runtime, so its .tsx source ships in the image.
# It imports ../src/reel/props, so the src tree must be present too (transpiled on the fly
# by Remotion's own bundler, not by our tsc build).
COPY reel-studio ./reel-studio
COPY src ./src
# runtime assets: card fonts (read from cwd) + fixtures (CLI fallbacks) + marketing site
COPY assets ./assets
COPY fixtures ./fixtures
COPY site ./site

# Bake the Chrome headless-shell into the image so the first reel doesn't pay a cold
# download (and so a render can never fail on a missing browser at runtime).
RUN node -e "import('@remotion/renderer').then(m=>m.ensureBrowser()).then(()=>console.log('remotion browser ready')).catch(e=>{console.error(e);process.exit(1)})"

EXPOSE 3000
CMD ["node", "dist/server.js"]
