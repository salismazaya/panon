.PHONY: run build dev migrate-up migrate-down make-migration tidy vet

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
