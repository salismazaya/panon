# Panon - No-Code Solana Automation Builder
Preview: https://youtu.be/aeLU4qg-FAs?si=1TxohuzTmQyVSuN-
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
go mod tidy

# Run the backend server
go run main.go
```

The backend will start at `http://localhost:3333`. On the first run, it will generate a `wallet.json` file in the root directory containing your monitored Solana address and private key.

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
- `panon_saved.json`: Stores your visual flow and generated Lua code.
- `wallet.json`: Stores your persistent Solana keypair (keep this safe!).

---

## ⚠️ Security Note

The `wallet.json` file contains a plain-text private key for your automation wallet. **Never commit this file to a public repository.** It is included in `.gitignore` by default. Use only on Devnet for testing.
