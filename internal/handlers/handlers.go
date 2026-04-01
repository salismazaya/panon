package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	lua "github.com/yuin/gopher-lua"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/helpers"
	"github.com/salismazaya/panon/internal/middleware"
	"github.com/salismazaya/panon/internal/models"
	"github.com/salismazaya/panon/internal/service"
	"github.com/salismazaya/panon/panon"
)

// ExecuteRequest represents a code execution request.
type ExecuteRequest struct {
	Code       string `json:"code" xml:"code" form:"code"`
	RPCURL     string `json:"rpcUrl" xml:"rpcUrl" form:"rpcUrl"`
	PrivateKey string `json:"privateKey" xml:"privateKey" form:"privateKey"`
}

// SaveRequest represents a save flow request.
type SaveRequest struct {
	WorkspaceID uint        `json:"workspaceId"`
	Code        string      `json:"code"`
	Flow        interface{} `json:"flow"`
}

// WalletData represents a Solana wallet keypair.
type WalletData struct {
	PrivateKey string `json:"privateKey"`
	Address    string `json:"address"`
}

// Handlers holds the HTTP handlers and their dependencies.
type Handlers struct {
	DefaultAddress string
	GetPrivateKey  func() string
	SolListener    interface {
		RegisterWorkspace(workspace models.Workspace, executor func(ctx context.Context, input models.ExecutorInput)) error
		UnregisterWorkspace(workspaceID uint) error
		GetRPCURL(network models.Network) string
		GetRPCClient(network models.Network) *rpc.Client
		ListenPubKey(network models.Network, pubkey solana.PublicKey, callback func(context.Context, *ws.AccountResult)) error
		DisconnectPubKey(pubkey solana.PublicKey)
	}
	Auth         *middleware.AuthMiddleware
	TokenService *service.TokenService
}

// New creates a new Handlers instance.
func New(defaultAddress string, getPrivateKey func() string, tokenService *service.TokenService, solListener interface {
	RegisterWorkspace(workspace models.Workspace, executor func(ctx context.Context, input models.ExecutorInput)) error
	UnregisterWorkspace(workspaceID uint) error
	GetRPCURL(network models.Network) string
	GetRPCClient(network models.Network) *rpc.Client
	ListenPubKey(network models.Network, pubkey solana.PublicKey, callback func(context.Context, *ws.AccountResult)) error
	DisconnectPubKey(pubkey solana.PublicKey)
}) *Handlers {
	return &Handlers{
		DefaultAddress: defaultAddress,
		GetPrivateKey:  getPrivateKey,
		TokenService:   tokenService,
		SolListener:    solListener,
	}
}

// ExecuteLuaTrigger executes the Lua trigger when SOL or Token is received.
func (h *Handlers) ExecuteLuaTrigger(ctx context.Context, input models.ExecutorInput) {
	workspace := input.Workspace
	flowState := workspace.FlowState

	if flowState == "" {
		return
	}

	var saved SaveRequest
	if err := json.Unmarshal([]byte(flowState), &saved); err != nil {
		return
	}

	code := saved.Code
	if code == "" {
		return
	}

	L := lua.NewState()
	defer L.Close()
	L.SetContext(ctx)

	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return
	}
	address := pk.PublicKey().String()

	rpcClient := h.SolListener.GetRPCClient(workspace.Network)
	client := panon.New(rpcClient, workspace.Wallet.GetPrivateKey())
	client.Register(L)

	L.SetGlobal("rpcUrl", lua.LString(h.SolListener.GetRPCURL(workspace.Network)))
	L.SetGlobal("privateKey", lua.LString(workspace.Wallet.GetPrivateKey()))
	L.SetGlobal("my_address", lua.LString(address))

	if err := L.DoString(string(code)); err != nil {
		log.Printf("❌ Lua Error: %v", err)
		return
	}

	var fn lua.LValue
	var amount float64
	var triggerName string

	if input.TokenMint != "" {
		// Token transfer
		triggerName = fmt.Sprintf("on_token_%s_received", input.TokenMint)
		fn = L.GetGlobal(triggerName)
		amount = input.TokenAmountIn
	} else {
		// SOL transfer
		triggerName = "on_sol_received"
		fn = L.GetGlobal(triggerName)
		amount = input.SolAmountIn
	}

	if fn.Type() != lua.LTFunction {
		return
	}

	err = L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, lua.LNumber(amount), lua.LString(input.Signer))

	if err != nil {
		log.Printf("❌ Error executing Lua callback %s: %v", triggerName, err)
	} else {
		log.Printf("✅ Lua callback %s executed successfully", triggerName)
	}
}

// RegisterRoutes registers all HTTP routes on the Fiber app.
func (h *Handlers) RegisterRoutes(app *fiber.App, authHandlers *AuthHandlers) {
	// Public routes (no authentication required)
	app.Post("/login", authHandlers.Login)

	// All routes below require authentication
	auth := h.Auth.Protect()

	// Endpoint to get default wallet address
	app.Get("/workspace/:workspaceId", auth, h.GetWorkspace)

	// Endpoint to derive public address from private key
	app.Post("/derive-address", auth, h.DeriveAddress)

	// Endpoint to save the generated Lua flow to the database
	app.Post("/save", auth, h.SaveFlow)

	// Endpoint to load the saved flow from the database
	app.Get("/load", auth, h.LoadFlow)

	// Endpoint to create a new workspace
	app.Post("/workspace", auth, h.CreateWorkspace)

	// Endpoint to update/rename a workspace
	app.Put("/workspace/:workspaceId", auth, h.UpdateWorkspace)

	// Endpoint to list all workspaces
	app.Get("/workspaces", auth, h.ListWorkspaces)

	// Endpoint to get all wallets
	app.Get("/wallets", auth, h.ListWallets)

	// Endpoint to update user profile (username/password)
	app.Put("/user", auth, authHandlers.UpdateProfile)

	// Endpoint to reveal private key (requires password)
	app.Post("/wallet/:walletId/reveal", auth, h.RevealPrivateKey)
}

func (h *Handlers) ListWorkspaces(c *fiber.Ctx) error {
	db := database.GetDatabase()

	var workspaces []models.Workspace
	if err := db.Find(&workspaces).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch workspaces"})
	}

	result := make([]fiber.Map, 0)
	for _, ws := range workspaces {
		result = append(result, fiber.Map{
			"workspaceId": ws.ID,
			"name":        ws.Name,
			"network":     ws.Network,
		})
	}

	return c.JSON(result)
}

func (h *Handlers) UpdateWorkspace(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("workspaceId")
	workspaceID, err := strconv.Atoi(workspaceIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid workspace ID"})
	}

	db := database.GetDatabase()

	type Request struct {
		Name    string         `json:"name"`
		Network models.Network `json:"network"`
	}
	req := new(Request)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var workspace models.Workspace
	if err := db.Preload("Wallet").First(&workspace, workspaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Workspace not found"})
	}

	networkChanged := false
	if req.Network != "" && req.Network.IsValid() && req.Network != workspace.Network {
		networkChanged = true
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Network != "" && req.Network.IsValid() {
		updates["network"] = req.Network
	}

	if len(updates) > 0 {
		if err := db.Model(&models.Workspace{}).Where("id = ?", workspaceID).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update workspace"})
		}
	}

	// Reload workspace with updated values for listener re-registration
	if err := db.Preload("Wallet").First(&workspace, workspaceID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reload workspace"})
	}

	if networkChanged && h.SolListener != nil {
		_ = h.SolListener.UnregisterWorkspace(uint(workspaceID))
		_ = h.SolListener.RegisterWorkspace(workspace, func(ctx context.Context, input models.ExecutorInput) {
			h.ExecuteLuaTrigger(ctx, input)
		})
	}

	return c.JSON(fiber.Map{"status": "success"})
}

// ListWallets returns all wallets with their addresses.
func (h *Handlers) ListWallets(c *fiber.Ctx) error {
	db := database.GetDatabase()

	var wallets []models.Wallet
	if err := db.Find(&wallets).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch wallets"})
	}

	result := make([]fiber.Map, 0)
	for _, wallet := range wallets {
		pk, err := solana.PrivateKeyFromBase58(wallet.GetPrivateKey())
		if err != nil {
			continue
		}

		result = append(result, fiber.Map{
			"id":      wallet.ID,
			"address": pk.PublicKey().String(),
		})
	}

	return c.JSON(result)
}

// GetWorkspace returns the default wallet address.
func (h *Handlers) GetWorkspace(c *fiber.Ctx) error {
	workspaceID := c.Params("workspaceId")

	db := database.GetDatabase()

	var workspace models.Workspace
	if err := db.Preload("Wallet").First(&workspace, workspaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Workspace not found"})
	}

	wallet := workspace.Wallet
	account, err := solana.PrivateKeyFromBase58(wallet.GetPrivateKey())

	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid private key"})
	}

	address := account.PublicKey().String()

	return c.JSON(fiber.Map{
		"address":     address,
		"workspaceId": workspace.ID,
		"walletId":    wallet.ID,
		"name":        workspace.Name,
		"network":     workspace.Network,
	})
}

func (h *Handlers) CreateWorkspace(c *fiber.Ctx) error {
	db := database.GetDatabase()

	type Request struct {
		Name    string         `json:"name"`
		Network models.Network `json:"network"`
	}
	req := new(Request)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Network == "" {
		req.Network = models.NetworkMainnet
	}
	if !req.Network.IsValid() {
		return c.Status(400).JSON(fiber.Map{"error": "Network must be 'mainnet' or 'devnet'"})
	}

	privKey := solana.NewWallet().PrivateKey.String()
	encryptedPrivKey, err := helpers.Encrypt(privKey)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "bad secret key"})
	}

	wallet := &models.Wallet{EncryptedPrivateKey: encryptedPrivKey}
	db.Create(wallet)

	workspace := &models.Workspace{Name: req.Name, Wallet: *wallet, Network: req.Network}
	db.Create(workspace)

	// Register the new workspace to the listener dynamically
	if h.SolListener != nil {
		h.SolListener.RegisterWorkspace(*workspace, func(ctx context.Context, input models.ExecutorInput) {
			h.ExecuteLuaTrigger(ctx, input)
		})
	}

	return c.JSON(fiber.Map{
		"workspaceId": workspace.ID,
		"walletId":    wallet.ID,
	})
}

// DeriveAddress derives a public address from a private key.
func (h *Handlers) DeriveAddress(c *fiber.Ctx) error {
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
}

// SaveFlow saves the Lua flow to the database and refreshes the listener.
func (h *Handlers) SaveFlow(c *fiber.Ctx) error {
	req := new(SaveRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.WorkspaceID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "workspaceId is required"})
	}

	data, err := json.Marshal(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to marshal JSON: " + err.Error()})
	}

	db := database.GetDatabase()
	var workspace models.Workspace
	if err := db.Preload("Wallet").First(&workspace, req.WorkspaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Workspace not found"})
	}

	// Update FlowState
	workspace.FlowState = string(data)
	if err := db.Save(&workspace).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save to database"})
	}

	// Refresh listener (otomatis memparse triggers baru)
	if h.SolListener != nil {
		h.SolListener.RegisterWorkspace(workspace, func(ctx context.Context, input models.ExecutorInput) {
			h.ExecuteLuaTrigger(ctx, input)
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Saved to database and listener refreshed",
	})
}

// LoadFlow loads the saved flow from the database.
func (h *Handlers) LoadFlow(c *fiber.Ctx) error {
	workspaceID := c.Query("workspaceId")
	if workspaceID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "workspaceId is required"})
	}

	db := database.GetDatabase()
	var workspace models.Workspace
	if err := db.First(&workspace, workspaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Workspace not found"})
	}

	if workspace.FlowState == "" {
		return c.JSON(fiber.Map{"status": "not_found"})
	}

	var saved SaveRequest
	if err := json.Unmarshal([]byte(workspace.FlowState), &saved); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse JSON: " + err.Error()})
	}

	return c.JSON(saved)
}

// RevealPrivateKey returns decrypted private key after verifying user password.
func (h *Handlers) RevealPrivateKey(c *fiber.Ctx) error {
	walletID := c.Params("walletId")
	if walletID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "walletId is required"})
	}

	type Request struct {
		Password string `json:"password"`
	}
	req := new(Request)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Password is required"})
	}

	// Extract user ID from token
	authHeader := c.Get("Authorization")
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	token := parts[1]

	claims, err := h.TokenService.ValidateToken(token)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	db := database.GetDatabase()

	// Verify user password
	var user models.User
	if err := db.First(&user, claims.UserID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if !user.CheckPassword(req.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "Incorrect password"})
	}

	// Fetch wallet and reveal private key
	var wallet models.Wallet
	if err := db.First(&wallet, walletID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Wallet not found"})
	}

	return c.JSON(fiber.Map{
		"walletId":   wallet.ID,
		"privateKey": wallet.GetPrivateKey(),
	})
}
