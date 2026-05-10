package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"strconv"

	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/handlers"
	"github.com/salismazaya/panon/internal/listener"
	"github.com/salismazaya/panon/internal/middleware"
	"github.com/salismazaya/panon/internal/models"
	"github.com/redis/go-redis/v9"
	"os"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	// Initialize database
	db := database.GetDatabase()

	// Initialize Redis
	var opt *redis.Options
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		var err error
		opt, err = redis.ParseURL(redisURL)
		if err != nil {
			log.Fatalf("Failed to parse Redis URL: %v", err)
		}
	} else {
		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		password := os.Getenv("REDIS_PASSWORD")
		dbStr := os.Getenv("REDIS_DB")
		db, _ := strconv.Atoi(dbStr)

		opt = &redis.Options{
			Addr:     fmt.Sprintf("%s:%s", host, port),
			Password: password,
			DB:       db,
		}
	}
	rdb := redis.NewClient(opt)

	// Initialize Lua Pool
	poolSizeStr := os.Getenv("LUA_POOL_SIZE")
	poolSize, _ := strconv.Atoi(poolSizeStr)
	if poolSize <= 0 {
		poolSize = 10 // Default
	}
	handlers.InitLuaPool(poolSize)

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

	// Create Solana listeners for both Mainnet and Devnet
	mainnetRpc := os.Getenv("SOLANA_MAINNET_RPC")
	if mainnetRpc == "" {
		mainnetRpc = "https://api.mainnet-beta.solana.com"
	}
	mainnetWs := os.Getenv("SOLANA_MAINNET_WS")
	if mainnetWs == "" {
		mainnetWs = "wss://api.mainnet-beta.solana.com"
	}

	devnetRpc := os.Getenv("SOLANA_DEVNET_RPC")
	if devnetRpc == "" {
		devnetRpc = "https://api.devnet.solana.com"
	}
	devnetWs := os.Getenv("SOLANA_DEVNET_WS")
	if devnetWs == "" {
		devnetWs = "wss://api.devnet.solana.com"
	}

	mainnetCfg := listener.Config{
		RpcUrl: mainnetRpc,
		WSUrl:  mainnetWs,
	}
	devnetCfg := listener.Config{
		RpcUrl: devnetRpc,
		WSUrl:  devnetWs,
	}

	// Initialize handlers and auth (without solListener for now)
	authHandlers := handlers.NewAuthHandlers()
	h := handlers.New("", func() string { return "" }, authHandlers.TokenService, nil, rdb)

	solListener, err := listener.NewMulti(mainnetCfg, devnetCfg, func(ctx context.Context, input models.ExecutorInput) {
		h.ExecuteLuaTrigger(ctx, input)
	})
	if err != nil {
		log.Fatalf("Failed to create Solana listener: %v", err)
	}

	// Set solListener to handler
	h.SolListener = solListener

	// Initialize auth middleware with token validation from authHandlers
	auth := middleware.NewAuth(authHandlers.ValidateToken)
	h.Auth = auth

	h.RegisterRoutes(app, authHandlers)

	fmt.Println("Panon API Server is live at http://localhost:3333")

	// Register all existing workspaces to the listener
	var workspaces []models.Workspace
	db.Preload("Wallet").Find(&workspaces)
	for _, ws := range workspaces {
		err := solListener.RegisterWorkspace(ws, func(ctx context.Context, input models.ExecutorInput) {
			h.ExecuteLuaTrigger(ctx, input)
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
