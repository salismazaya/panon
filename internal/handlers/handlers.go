package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	lua "github.com/yuin/gopher-lua"

	"github.com/gagliardetto/solana-go"
	"github.com/salismazaya/panon/internal/helpers"
	"github.com/salismazaya/panon/internal/models"
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
	Broadcast      chan models.Notification
	SolListener    interface {
		RegisterWorkspace(workspace models.Workspace, executor func(workspace models.Workspace, input models.ExecutorInput)) error
	}
}

// New creates a new Handlers instance.
func New(defaultAddress string, getPrivateKey func() string) *Handlers {
	return &Handlers{
		DefaultAddress: defaultAddress,
		GetPrivateKey:  getPrivateKey,
		Broadcast:      make(chan models.Notification),
	}
}

// ExecuteLuaTrigger executes the Lua trigger when SOL is received.
func (h *Handlers) ExecuteLuaTrigger(amount float64, sender string, rpcURL, privateKey string, flowState string) {
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

	pk, err := solana.PrivateKeyFromBase58(privateKey)
	if err != nil {
		return
	}
	address := pk.PublicKey().String()

	client := panon.New(rpcURL, privateKey)
	client.Register(L)

	L.SetGlobal("rpcUrl", lua.LString(rpcURL))
	L.SetGlobal("privateKey", lua.LString(privateKey))
	L.SetGlobal("my_address", lua.LString(address))

	log.Println("Executing Lua code: ", code)
	if err := L.DoString(string(code)); err != nil {
		return
	}

	fn := L.GetGlobal("on_sol_received")
	if fn.Type() != lua.LTFunction {
		return
	}

	err = L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, lua.LNumber(amount), lua.LString(sender))

	if err != nil {
		return
	}
}

// RegisterRoutes registers all HTTP routes on the Fiber app.
func (h *Handlers) RegisterRoutes(app *fiber.App) {
	// Endpoint to get default wallet address
	app.Get("/workspace/:workspaceId", h.GetWorkspace)

	// Endpoint to derive public address from private key
	app.Post("/derive-address", h.DeriveAddress)

	// Endpoint to save the generated Lua flow to the database
	app.Post("/save", h.SaveFlow)

	// Endpoint to load the saved flow from the database
	app.Get("/load", h.LoadFlow)

	// Endpoint to create a new workspace
	app.Post("/workspace", h.CreateWorkspace)

	// Endpoint to update/rename a workspace
	app.Put("/workspace/:workspaceId", h.UpdateWorkspace)

	// Endpoint to list all workspaces
	app.Get("/workspaces", h.ListWorkspaces)

	// Endpoint to get all wallets
	app.Get("/wallets", h.ListWallets)

	// SSE Endpoint for real-time notifications
	app.Get("/events", h.HandleEvents)
}

func (h *Handlers) ListWorkspaces(c *fiber.Ctx) error {
	db := helpers.GetDatabase()

	var workspaces []models.Workspace
	if err := db.Find(&workspaces).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch workspaces"})
	}

	result := make([]fiber.Map, 0)
	for _, ws := range workspaces {
		result = append(result, fiber.Map{
			"workspaceId": ws.ID,
			"name":        ws.Name,
		})
	}

	return c.JSON(result)
}

func (h *Handlers) UpdateWorkspace(c *fiber.Ctx) error {
	workspaceID := c.Params("workspaceId")
	db := helpers.GetDatabase()

	type Request struct {
		Name string `json:"name"`
	}
	req := new(Request)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := db.Model(&models.Workspace{}).Where("id = ?", workspaceID).Update("name", req.Name).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update workspace"})
	}

	return c.JSON(fiber.Map{"status": "success"})
}

func (h *Handlers) HandleEvents(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		for {
			notification := <-h.Broadcast
			data, _ := json.Marshal(notification)
			fmt.Fprintf(w, "data: %s\n\n", string(data))
			w.Flush()
		}
	})

	return nil
}

// ListWallets returns all wallets with their addresses.
func (h *Handlers) ListWallets(c *fiber.Ctx) error {
	db := helpers.GetDatabase()

	var wallets []models.Wallet
	if err := db.Find(&wallets).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch wallets"})
	}

	result := make([]fiber.Map, 0)
	for _, wallet := range wallets {
		pk, err := solana.PrivateKeyFromBase58(wallet.PrivateKey)
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

	db := helpers.GetDatabase()

	var workspace models.Workspace
	if err := db.Preload("Wallet").First(&workspace, workspaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Workspace not found"})
	}

	wallet := workspace.Wallet
	account, err := solana.PrivateKeyFromBase58(wallet.PrivateKey)

	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid private key"})
	}

	address := account.PublicKey().String()

	return c.JSON(fiber.Map{
		"address":     address,
		"workspaceId": workspace.ID,
		"name":        workspace.Name,
	})
}

func (h *Handlers) CreateWorkspace(c *fiber.Ctx) error {
	db := helpers.GetDatabase()

	type Request struct {
		Name string `json:"name"`
	}
	req := new(Request)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	privKey := solana.NewWallet().PrivateKey.String()

	wallet := &models.Wallet{PrivateKey: privKey}
	db.Create(wallet)

	workspace := &models.Workspace{Name: req.Name, Wallet: *wallet}
	db.Create(workspace)

	// Register the new workspace to the listener dynamically
	if h.SolListener != nil {
		h.SolListener.RegisterWorkspace(*workspace, func(workspace models.Workspace, input models.ExecutorInput) {
			// We need a reference to rpcUrl here, usually we should store it in Handlers or models
			// For now, use the devnet default
			h.ExecuteLuaTrigger(input.SolAmountIn, input.Signer, "https://api.devnet.solana.com", workspace.Wallet.PrivateKey, workspace.FlowState)
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

// SaveFlow saves the Lua flow to the database.
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

	db := helpers.GetDatabase()
	if err := db.Model(&models.Workspace{}).Where("id = ?", req.WorkspaceID).Update("flow_state", string(data)).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save to database"})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Saved to database",
	})
}

// LoadFlow loads the saved flow from the database.
func (h *Handlers) LoadFlow(c *fiber.Ctx) error {
	workspaceID := c.Query("workspaceId")
	if workspaceID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "workspaceId is required"})
	}

	db := helpers.GetDatabase()
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
