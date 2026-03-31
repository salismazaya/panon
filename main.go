package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"

	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/handlers"
	"github.com/salismazaya/panon/internal/listener"
	"github.com/salismazaya/panon/internal/middleware"
	"github.com/salismazaya/panon/internal/models"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	// Initialize database
	db := database.GetDatabase()

	// Ensure at least one workspace exists (and that migrations have been run)
	var count int64
	if err := db.Model(&models.Workspace{}).Count(&count).Error; err != nil {
		log.Fatalf("❌ Error querying workspaces. Please ensure you have run migrations: %v", err)
	}
	if count == 0 {
		log.Fatal("❌ No workspaces found. Please run migrations to seed the default workspace.")
	}

	// Create Fiber app
	app := fiber.New()
	app.Use(cors.New())

	// Initialize handlers and auth
	authHandlers := handlers.NewAuthHandlers()
	h := handlers.New("", func() string { return "" }, authHandlers.TokenService)

	// Initialize auth middleware with token validation from authHandlers
	auth := middleware.NewAuth(authHandlers.ValidateToken)
	h.Auth = auth

	h.RegisterRoutes(app, authHandlers)

	fmt.Println("Panon API Server is live at http://localhost:3333")

	// Create Solana listeners for both Mainnet and Devnet
	mainnetCfg := listener.Config{
		RpcUrl: "https://api.mainnet-beta.solana.com",
		WSUrl:  "wss://api.mainnet-beta.solana.com",
	}
	devnetCfg := listener.Config{
		RpcUrl: "https://api.devnet.solana.com",
		WSUrl:  "wss://api.devnet.solana.com",
	}

	solListener, err := listener.NewMulti(mainnetCfg, devnetCfg)
	if err != nil {
		log.Fatalf("Failed to create Solana listener: %v", err)
	}
	h.SolListener = solListener

	// Register all existing workspaces to the listener
	var workspaces []models.Workspace
	db.Preload("Wallet").Find(&workspaces)
	for _, ws := range workspaces {
		err := solListener.RegisterWorkspace(ws, func(input models.ExecutorInput) {
			workspace := input.Workspace
			rpcURL := solListener.GetRPCURL(workspace.Network)
			h.ExecuteLuaTrigger(input.SolAmountIn, input.Signer, rpcURL, workspace.Wallet.GetPrivateKey(), workspace.ID)
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
