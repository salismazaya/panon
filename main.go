package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/salismazaya/panon/panon"
	lua "github.com/yuin/gopher-lua"
)

type ExecuteRequest struct {
	Code       string `json:"code" xml:"code" form:"code"`
	RPCURL     string `json:"rpcUrl" xml:"rpcUrl" form:"rpcUrl"`
	PrivateKey string `json:"privateKey" xml:"privateKey" form:"privateKey"`
}

type SaveRequest struct {
	Code string      `json:"code"`
	Flow interface{} `json:"flow"`
}

type WalletData struct {
	PrivateKey string `json:"privateKey"`
	Address    string `json:"address"`
}

// Store for private keys (in-memory, per-session)
var (
	privateKey = ""
	// storeMutex       sync.RWMutex
	defaultSessionID = ""
	defaultAddress   = ""
)

// Global de-duplication cache for transaction signatures
var processedSignatures sync.Map

// generateDefaultKey creates or loads a Solana keypair
func generateDefaultKey() {
	walletFile := "wallet.json"
	var wallet WalletData

	// Try to load existing wallet
	if data, err := os.ReadFile(walletFile); err == nil {
		if err := json.Unmarshal(data, &wallet); err == nil {
			defaultAddress = wallet.Address
			privateKey = wallet.PrivateKey

			log.Printf("Loaded existing Solana wallet from %s:", walletFile)
			log.Printf("  Address: %s", wallet.Address)
			return
		}
	}

	// Generate a new random private key if none exists
	pk, err := solana.NewRandomPrivateKey()
	if err != nil {
		log.Fatalf("Failed to generate private key: %v", err)
	}

	newPrivateKey := pk.String()
	newAddress := pk.PublicKey().String()

	wallet = WalletData{
		PrivateKey: newPrivateKey,
		Address:    newAddress,
	}

	// Save the new wallet to file
	data, _ := json.MarshalIndent(wallet, "", "  ")
	if err := os.WriteFile(walletFile, data, 0644); err != nil {
		log.Printf("Warning: Failed to save wallet.json: %v", err)
	}

	defaultSessionID = "default_session"
	defaultAddress = newAddress
	privateKey = newPrivateKey

	log.Printf("Generated new default Solana wallet and saved to %s:", walletFile)
	log.Printf("  Address: %s", newAddress)
	log.Printf("  Private Key: %s", newPrivateKey)
}

func main() {
	// Generate default wallet on startup
	generateDefaultKey()

	app := fiber.New()

	// Enable CORS to allow frontend requests
	app.Use(cors.New())

	// Endpoint to get default wallet address
	app.Get("/wallet", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"address": defaultAddress,
		})
	})

	// Endpoint to store private key and return session ID
	// app.Post("/store-key", func(c *fiber.Ctx) error {
	// 	type Request struct {
	// 		PrivateKey string `json:"privateKey"`
	// 	}
	// 	req := new(Request)
	// 	if err := c.BodyParser(req); err != nil {
	// 		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	// 	}

	// 	if req.PrivateKey == "" {
	// 		return c.Status(400).JSON(fiber.Map{"error": "Private key is required"})
	// 	}

	// 	// Validate private key format
	// 	_, err := solana.PrivateKeyFromBase58(req.PrivateKey)
	// 	if err != nil {
	// 		return c.Status(400).JSON(fiber.Map{"error": "Invalid private key format"})
	// 	}

	// 	// Generate a session ID (in production, use proper session management)
	// 	sessionID := fmt.Sprintf("session_%d", c.Context().ID())

	// 	storeMutex.Lock()
	// 	privateKeyStore[sessionID] = req.PrivateKey
	// 	storeMutex.Unlock()

	// 	// Derive address from private key
	// 	pk, _ := solana.PrivateKeyFromBase58(req.PrivateKey)
	// 	address := pk.PublicKey().String()

	// 	return c.JSON(fiber.Map{
	// 		"sessionId": sessionID,
	// 		"address":   address,
	// 	})
	// })

	// Endpoint to get stored private key by session ID
	// app.Get("/get-key/:sessionId", func(c *fiber.Ctx) error {
	// 	sessionID := c.Params("sessionId")

	// 	storeMutex.RLock()
	// 	privateKey, exists := privateKeyStore[sessionID]
	// 	storeMutex.RUnlock()

	// 	if !exists || privateKey == "" {
	// 		return c.Status(404).JSON(fiber.Map{"error": "Private key not found"})
	// 	}

	// 	pk, _ := solana.PrivateKeyFromBase58(privateKey)
	// 	return c.JSON(fiber.Map{"address": pk.PublicKey().String()})
	// })

	// Endpoint to derive public address from private key (legacy, for backward compatibility)
	app.Post("/derive-address", func(c *fiber.Ctx) error {
		type Request struct {
			PrivateKey string `json:"privateKey"`
		}
		req := new(Request)
		if err := c.BodyParser(req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.PrivateKey == "" {
			return c.JSON(fiber.Map{"address": ""})
		}

		pk, err := solana.PrivateKeyFromBase58(req.PrivateKey)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid private key format"})
		}

		return c.JSON(fiber.Map{"address": pk.PublicKey().String()})
	})

	// Endpoint to save the generated Lua flow to a file
	app.Post("/save", func(c *fiber.Ctx) error {
		req := new(SaveRequest)
		if err := c.BodyParser(req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		// Save everything as JSON
		data, err := json.MarshalIndent(req, "", "  ")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to marshal JSON: " + err.Error()})
		}

		err = os.WriteFile("panon_saved.json", data, 0644)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save file: " + err.Error()})
		}

		log.Printf("Successfully saved to panon_saved.json")

		return c.JSON(fiber.Map{
			"status":  "success",
			"message": "Saved to panon_saved.json",
		})
	})

	// Endpoint to load the saved flow
	app.Get("/load", func(c *fiber.Ctx) error {
		data, err := os.ReadFile("panon_saved.json")
		if err != nil {
			if os.IsNotExist(err) {
				return c.JSON(fiber.Map{"status": "not_found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "Failed to read file: " + err.Error()})
		}

		var saved SaveRequest
		if err := json.Unmarshal(data, &saved); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to parse JSON: " + err.Error()})
		}

		return c.JSON(saved)
	})

	fmt.Println("Panon API Server is live at http://localhost:3333")

	// Start signature cleanup routine (every 5 minutes)
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			processedSignatures.Range(func(key, value interface{}) bool {
				processedSignatures.Delete(key)
				return true
			})
			log.Printf("🧹 Cleared transaction signature cache (de-duplication map)")
		}
	}()

	// Start Solana Listener in the background to monitor the default wallet
	go startSolanaListener(
		"https://api.devnet.solana.com",
		"wss://api.devnet.solana.com",
		defaultAddress,
		privateKey,
	)

	// Serve compiled frontend files from the 'dist' directory
	app.Static("/", "./dist")

	// Catch-all route for SPA (React Router support)
	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./dist/index.html")
	})

	log.Fatal(app.Listen(":3333"))
}

// startSolanaListener connects to a WebSocket and listens for transactions involving the given wallet.
func startSolanaListener(rpcURL, wsURL, walletAddress, privateKey string) {
	pubkey, err := solana.PublicKeyFromBase58(walletAddress)
	if err != nil {
		log.Fatalf("Invalid monitoring address: %v", err)
	}

	// Connect to WebSocket
	for {
		client, err := ws.Connect(context.Background(), wsURL)
		if err != nil {
			log.Printf("WebSocket connection failed (%s), retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		// Subscribe to logs mentioning our wallet
		sub, err := client.LogsSubscribeMentions(
			pubkey,
			rpc.CommitmentFinalized,
		)
		if err != nil {
			log.Printf("LogsSubscribe failed: %v", err)
			client.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		log.Printf("🚀 Solana Listener Active: Monitoring %s", walletAddress)

		for {
			got, err := sub.Recv(context.Background())
			if err != nil {
				log.Printf("Subscription receive error: %v", err)
				break // Reconnect
			}

			// In a separate goroutine, fetch transaction details and trigger Lua
			go processTransaction(got.Value.Signature, pubkey, rpcURL, privateKey)
		}

		sub.Unsubscribe()
		client.Close()
		time.Sleep(2 * time.Second)
	}
}

func processTransaction(sig solana.Signature, myPubkey solana.PublicKey, rpcURL, privateKey string) {
	// De-duplication check: if signature is already being processed or done, skip
	if _, loaded := processedSignatures.LoadOrStore(sig.String(), time.Now()); loaded {
		return
	}

	rpcClient := rpc.New(rpcURL)

	// Fetch transaction with commitment finalized
	// Use small retry logic because sometimes GetTransaction is not immediately indexed
	var tx *rpc.GetTransactionResult
	var err error
	for i := 0; i < 3; i++ {
		tx, err = rpcClient.GetTransaction(
			context.Background(),
			sig,
			&rpc.GetTransactionOpts{
				Commitment: rpc.CommitmentFinalized,
				Encoding:   solana.EncodingBase64,
			},
		)
		if err == nil && tx != nil {
			break
		}
		time.Sleep(1 * time.Second)
	}

	if err != nil || tx == nil || tx.Meta == nil {
		return
	}

	// Verify if SOL balance increased for our address
	parsedTx, err := tx.Transaction.GetTransaction()
	if err != nil {
		return
	}

	accountKeys := parsedTx.Message.AccountKeys
	accountIndex := -1
	for i, acc := range accountKeys {
		if acc.Equals(myPubkey) {
			accountIndex = i
			break
		}
	}

	if accountIndex == -1 {
		return
	}

	pre := tx.Meta.PreBalances[accountIndex]
	post := tx.Meta.PostBalances[accountIndex]

	if post > pre {
		amountSOL := float64(post-pre) / 1e9
		sender := accountKeys[0].String() // Payer is usually first

		log.Printf("💰 Detected Inbound Transaction!")
		log.Printf("   Amount: %f SOL", amountSOL)
		log.Printf("   Sender: %s", sender)
		log.Printf("   Signature: %s", sig)

		executeLuaTrigger(amountSOL, sender, rpcURL, privateKey)
	}
}

func executeLuaTrigger(amount float64, sender string, rpcURL, privateKey string) {
	// Read saved Lua code from JSON
	data, err := os.ReadFile("panon_saved.json")
	if err != nil {
		log.Printf("Error: 'panon_saved.json' not found. Save your flow in the UI first.")
		return
	}

	var saved SaveRequest
	if err := json.Unmarshal(data, &saved); err != nil {
		log.Printf("Error parsing 'panon_saved.json': %v", err)
		return
	}

	code := saved.Code
	if code == "" {
		log.Printf("Error: No Lua code found in 'panon_saved.json'")
		return
	}

	L := lua.NewState()
	defer L.Close()

	// Derive public address from private key
	pk, err := solana.PrivateKeyFromBase58(privateKey)
	if err != nil {
		log.Printf("❌ Invalid private key for Lua execution: %v", err)
		return
	}
	address := pk.PublicKey().String()

	// Initialize Panon environment
	client := panon.New(rpcURL, privateKey)
	client.Register(L)

	// Set global variables for scripts to use
	L.SetGlobal("rpcUrl", lua.LString(rpcURL))
	L.SetGlobal("privateKey", lua.LString(privateKey))
	L.SetGlobal("my_address", lua.LString(address))

	// Execute the saved script (defines the function)
	if err := L.DoString(string(code)); err != nil {
		log.Printf("❌ Lua Script Runtime Error: %v", err)
		return
	}

	// Look for 'on_sol_received' function
	fn := L.GetGlobal("on_sol_received")
	if fn.Type() != lua.LTFunction {
		log.Printf("⚠️  Script loaded but 'on_sol_received' is missing or not a function")
		return
	}

	// Call function: on_sol_received(amount, sender)
	err = L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, lua.LNumber(amount), lua.LString(sender))

	if err != nil {
		log.Printf("❌ Error executing on_sol_received: %v", err)
	} else {
		log.Printf("✅ Lua Flow Execution Complete")
	}
}
