package luaexec

import (
	"encoding/json"
	"log"
	"os"

	"github.com/gagliardetto/solana-go"
	lua "github.com/yuin/gopher-lua"

	"github.com/salismazaya/panon/panon"
)

// Executor handles Lua script execution.
type Executor struct {
	rpcURL     string
	privateKey string
	address    string
}

// New creates a new Lua executor.
func New(rpcURL, privateKey string) (*Executor, error) {
	pk, err := solana.PrivateKeyFromBase58(privateKey)
	if err != nil {
		return nil, err
	}

	return &Executor{
		rpcURL:     rpcURL,
		privateKey: privateKey,
		address:    pk.PublicKey().String(),
	}, nil
}

// ExecuteTrigger executes the Lua trigger when SOL is received.
func (e *Executor) ExecuteTrigger(amount float64, sender string) {
	data, err := os.ReadFile("panon_saved.json")
	if err != nil {
		log.Printf("Error: 'panon_saved.json' not found. Save your flow in the UI first.")
		return
	}

	var saved struct {
		Code string      `json:"code"`
		Flow  interface{} `json:"flow"`
	}
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

	client := panon.New(e.rpcURL, e.privateKey)
	client.Register(L)

	L.SetGlobal("rpcUrl", lua.LString(e.rpcURL))
	L.SetGlobal("privateKey", lua.LString(e.privateKey))
	L.SetGlobal("my_address", lua.LString(e.address))

	if err := L.DoString(string(code)); err != nil {
		log.Printf("❌ Lua Script Runtime Error: %v", err)
		return
	}

	fn := L.GetGlobal("on_sol_received")
	if fn.Type() != lua.LTFunction {
		log.Printf("⚠️  Script loaded but 'on_sol_received' is missing or not a function")
		return
	}

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
