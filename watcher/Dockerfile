FROM node:20-alpine

WORKDIR /app

# Install all deps (including devDependencies needed for tsc)
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev deps after build — keeps the image lean
RUN npm prune --omit=dev

CMD ["node", "dist/index.js"]
