FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11.1.2

# Copy monorepo (respects .dockerignore)
COPY . .

# Install all workspace deps (devDeps needed to build TS)
RUN pnpm install

# Build worker + its workspace dependencies
RUN pnpm --filter @openbox/worker... --if-present build

# Start the worker
CMD ["pnpm", "run", "--filter", "@openbox/worker", "start"]
