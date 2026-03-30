.PHONY: run build dev migrate-up migrate-down make-migration tidy vet \
        frontend-install frontend-dev frontend-build frontend-test \
        frontend-test-watch frontend-test-coverage frontend-lint \
        test-surfpool test-integration test-surfpool-stop

# Default environment variables
PORT ?= 3333

# Run the application
run:
	go run main.go

# Build the application
build:
	go build -o bin/panon main.go

# Run tests/vet
vet:
	go vet ./...

# Manage Go modules
tidy:
	go mod tidy

# --- Database Migrations ---

# Run all pending migrations
migrate-up:
	go run cmd/migrate/main.go up

# Rollback the last migration
migrate-down:
	go run cmd/migrate/main.go down

# Create a new blank migration file
make-migration:
	@read -p "Enter migration name (e.g., create_users_table): " name; \
	if [ -z "$$name" ]; then \
		echo "Migration name is required"; \
		exit 1; \
	fi; \
	go run cmd/migrate/main.go make $$name

# --- Frontend ---

# Install frontend dependencies
frontend-install:
	cd frontend && npm install

# Start Vite dev server
frontend-dev:
	cd frontend && npm run dev

# Build frontend for production
frontend-build:
	cd frontend && npm run build

# Run frontend tests once
frontend-test:
	cd frontend && npm test

# Run frontend tests in watch mode
frontend-test-watch:
	cd frontend && npm run test:watch

# Run frontend tests with coverage
frontend-test-coverage:
	cd frontend && npm run test:coverage

# Run frontend linter
frontend-lint:
	cd frontend && npm run lint

# Run backend + frontend dev servers concurrently
dev:
	@echo "Starting backend and frontend..."
	@$(MAKE) run & $(MAKE) frontend-dev & wait

# --- Integration Tests ---

# Start Surfpool in daemon mode (background)
test-surfpool:
	surfpool start

# Run Go integration tests (requires running Surfpool)
test-integration:
	go test -tags integration -v -count=1 ./panon/...

# Stop Surfpool
test-surfpool-stop:
	pkill -f surfpool || true
