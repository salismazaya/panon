# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/package*.json ./
RUN npm install

# Copy rest of frontend source
COPY frontend/ ./

# Build with empty VITE_API_URL so it uses relative paths (same origin)
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app

# Install build dependencies (build-base is REQUIRED for CGO/sqlite3)
RUN apk add --no-cache git build-base

# Copy go mod and sum
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build the binaries with CGO enabled for sqlite3
RUN CGO_ENABLED=1 GOOS=linux go build -o panon-server main.go
RUN CGO_ENABLED=1 GOOS=linux go build -o migrate cmd/migrate/main.go

# Stage 3: Final Image
FROM alpine:latest
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy from builders
COPY --from=backend-builder /app/panon-server .
COPY --from=backend-builder /app/migrate .
COPY --from=frontend-builder /app/frontend/dist ./dist

# Expose the API and UI port
EXPOSE 3333

# Start the server (run migrations first)
# Using sh -c is necessary to use the && operator
CMD ["sh", "-c", "./migrate up && ./panon-server"]
