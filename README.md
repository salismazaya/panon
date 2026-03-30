# Panon - No-Code Solana Automation Builder

**"Panon"** means **"Eye"** in Sundanese (a regional language from Indonesia). This project acts as the "eyes" for your Solana wallet, monitoring inbound transactions and triggering automated workflows in real-time.

Panon is a modular, visual no-code builder designed to automate Solana transactions. It allows you to build complex logic (like "If balance > X transfer to Y") using a drag-and-drop interface, which then generates and executes Lua scripts in response to real-time on-chain events.

## 🚀 Features

- **Visual Flow Builder**: Create automation logic using hierarchical blocks (powered by React Flow).
- **Real-Time Monitoring**: Automatically listens for inbound SOL transactions on a dedicated wallet.
- **Lua Execution Engine**: Compiles visual flows into efficient Lua scripts executed by a Go backend.
- **Persistent State**: Save and load your visual flows and wallet configurations automatically.
- **Smart De-duplication**: Ensures each transaction signature triggers your workflow exactly once.

---

## 🛠️ Installation

### Prerequisites

- **Go**: v1.26 or higher
- **Node.js**: v18 or higher
- **npm**: v9 or higher

### 1. Backend Setup

From the root directory of the project:

```bash
# Install Go dependencies
make tidy

# Migrate database
make migrate-up

# Run the backend server
make run
```

The backend will start at `http://localhost:3333`

### 2. Frontend Setup

From the project root:

```bash
# Install npm dependencies
make frontend-install

# Start the development server
make frontend-dev
```

Or run **both** backend and frontend together:

```bash
make dev
```

```env
VITE_API_URL=http://your-backend-api:3333
```

---

### 3. Integration Tests (Optional)

To run the Go integration tests (which execute Lua scripts against a local Solana environment), you need to install **Surfpool**, a lightweight `solana-test-validator` replacement.

**Install Surfpool:**
```bash
curl -sL https://run.surfpool.run/ | bash
```

**Running Tests:**
```bash
# 1. Start Surfpool in the background
make test-surfpool

# 2. Run the integration tests
make test-integration

# 3. Stop Surfpool when finished
make test-surfpool-stop
```

---

## 📖 Usage

1. **Connect Wallet**: Open the browser and click "Connect Wallet" (or view the default generated wallet) in the header.
2. **Build Your Flow**:
   - Drag a **Trigger** (e.g., "On Solana Received") to the canvas.
   - Connect it to **Logic** (e.g., "If Condition") or **Actions** (e.g., "Transfer").
   - Configure the parameters by clicking on the nodes.a
3. **Save**: The builder has **Autosave** enabled. Your flow will be synced to database 2 seconds after your last change.
4. **Deploy**: Once your flow is "Ready to Compile" (green status), the backend is already monitoring your wallet in the background.
5. **Test**: Send some Devnet SOL to the address shown in the "Wallet" modal to trigger your automation.

---

## 📁 Project Structure

- `main.go`: The core API server and Solana transaction listener.
- `panon/`: A Go package containing the Lua-Solana binding library.
- `frontend/`: React + Vite application for the visual builder.
- `internal/`: Internal packages including models, database migrations, and handlers.
- `cmd/`: Command-line utilities (e.g., migration tool).

---

## 🧰 Makefile Commands

### General

| Command | Description |
|---------|-------------|
| `make dev` | Run backend + frontend dev servers concurrently |
| `make run` | Run the backend server only |
| `make build` | Build the application binary to `bin/panon` |
| `make tidy` | Tidy Go modules |
| `make vet` | Run Go vet for code quality |

### Database Migrations

| Command | Description |
|---------|-------------|
| `make migrate-up` | Run all pending database migrations |
| `make migrate-down` | Rollback the last migration |
| `make make-migration` | Create a new database migration file |

### Frontend

| Command | Description |
|---------|-------------|
| `make frontend-install` | Install frontend npm dependencies |
| `make frontend-dev` | Start Vite dev server |
| `make frontend-build` | Build frontend for production |
| `make frontend-test` | Run frontend tests once |
| `make frontend-test-watch` | Run frontend tests in watch mode |
| `make frontend-test-coverage` | Run frontend tests with coverage report |
| `make frontend-lint` | Run ESLint on frontend code |

### Integration Tests

| Command | Description |
|---------|-------------|
| `make test-surfpool` | Start Surfpool daemon (background) |
| `make test-integration` | Run Go integration tests (with build tags) |
| `make test-surfpool-stop` | Stop the Surfpool daemon |
