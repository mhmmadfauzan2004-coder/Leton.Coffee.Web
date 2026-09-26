# Production Dockerfile for Leton Coffee Backend & Static Engine
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies for build
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build Vite frontend bundle and compile Express server.ts into dist/server.cjs
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled artifacts and static assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public

# Create uploads directory if not present
RUN mkdir -p /app/uploads /app/data /app/public/uploads

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
