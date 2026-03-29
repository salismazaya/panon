package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/salismazaya/panon/internal/handlers"
	"github.com/salismazaya/panon/internal/helpers"
	"github.com/salismazaya/panon/internal/listener"
	"github.com/salismazaya/panon/internal/models"
)

func main() {
	// Initialize database
	db := helpers.GetDatabase()

	// Ensure at least one workspace exists
	var count int64
	db.Model(&models.Workspace{}).Count(&count)
	if count == 0 {
		// Create a fresh default workspace
		privKey := solana.NewWallet().PrivateKey.String()
		wallet := &models.Wallet{PrivateKey: privKey}
		db.Create(wallet)

		workspace := &models.Workspace{
			Name:     "Default Workspace",
			Wallet:   *wallet,
			WalletID: wallet.ID,
		}
		db.Create(workspace)
		log.Println("✨ Created fresh Default Workspace")
	}

	// Create Fiber app
	app := fiber.New()
	app.Use(cors.New())

	// Initialize handlers
	h := handlers.New("", func() string { return "" })
	h.RegisterRoutes(app)

	fmt.Println("Panon API Server is live at http://localhost:3333")

	// Create Solana listener
	cfg := listener.Config{
		RpcUrl: "https://api.devnet.solana.com",
		WSUrl:  "wss://api.devnet.solana.com",
	}

	solListener, err := listener.New(cfg, h.Broadcast)
	if err != nil {
		log.Fatalf("Failed to create Solana listener: %v", err)
	}
	h.SolListener = solListener

	// Register all existing workspaces to the listener
	var workspaces []models.Workspace
	db.Preload("Wallet").Find(&workspaces)
	for _, ws := range workspaces {
		err := solListener.RegisterWorkspace(ws, func(workspace models.Workspace, input models.ExecutorInput) {
			h.ExecuteLuaTrigger(input.SolAmountIn, input.Signer, cfg.RpcUrl, workspace.Wallet.PrivateKey, workspace.FlowState)
		})
		if err != nil {
			log.Printf("Failed to register workspace %s: %v", ws.Name, err)
		}
	}

	// Start signature cleanup routine (every 5 minutes)
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			solListener.ClearSignatures()
			log.Printf("🧹 Cleared transaction signature cache (de-duplication map)")
		}
	}()

	// Serve compiled frontend files from the 'dist' directory
	app.Static("/", "./dist")

	// Catch-all route for SPA (React Router support)
	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./dist/index.html")
	})

	log.Fatal(app.Listen(":3333"))
}
