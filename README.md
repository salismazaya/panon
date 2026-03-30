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

In a new terminal, navigate to the `frontend` directory:

```bash
cd frontend

# Install npm dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start at `http://localhost:5173` (or the next available port). By default, it connects to the backend at `http://localhost:3333`. You can customize this by creating a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://your-backend-api:3333
```

---

## 📖 Usage

1. **Connect Wallet**: Open the browser and click "Connect Wallet" (or view the default generated wallet) in the header.
2. **Build Your Flow**:
   - Drag a **Trigger** (e.g., "On Solana Received") to the canvas.
   - Connect it to **Logic** (e.g., "If Condition") or **Actions** (e.g., "Transfer").
   - Configure the parameters by clicking on the nodes.
3. **Save**: The builder has **Autosave** enabled. Your flow will be synced to `panon_saved.json` 2 seconds after your last change.
4. **Deploy**: Once your flow is "Ready to Compile" (green status), the backend is already monitoring your wallet in the background.
5. **Test**: Send some Devnet SOL to the address shown in the "Wallet" modal to trigger your automation.

---

## 📁 Project Structure

- `main.go`: The core API server and Solana transaction listener.
- `panon/`: A Go package containing the Lua-Solana binding library.
- `frontend/`: React + Vite application for the visual builder.
- `internal/`: Internal packages including models, database migrations, and handlers.
- `cmd/`: Command-line utilities (e.g., migration tool).
- `panon_saved.json`: Stores your visual flow and generated Lua code.
- `wallet.json`: Stores your persistent Solana keypair (keep this safe!).

---

## 🧰 Makefile Commands

| Command | Description |
|---------|-------------|
| `make run` | Run the application |
| `make build` | Build the application binary to `bin/panon` |
| `make tidy` | Tidy Go modules |
| `make vet` | Run Go vet for code quality |
| `make migrate-up` | Run all pending database migrations |
| `make migrate-down` | Rollback the last migration |
| `make make-migration` | Create a new database migration file |
