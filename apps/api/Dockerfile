FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11.1.2

# Copy monorepo (respects .dockerignore)
COPY . .

# Install all workspace deps (devDeps needed to build TS)
RUN pnpm install

# Build API + its workspace dependencies
RUN pnpm --filter @openbox/api... --if-present build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "--filter", "@openbox/api", "start"]
