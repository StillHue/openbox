FROM node:22-alpine

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Install pnpm
RUN npm install -g pnpm@11.1.2

# Copy monorepo (respects .dockerignore)
COPY . .

# Install all workspace deps (devDeps needed to build)
RUN pnpm install

# Build the UI
RUN pnpm --filter @openbox/ui build

EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "--filter", "@openbox/ui", "start"]
