//go:build integration

package panon

import (
	"testing"

	"github.com/gagliardetto/solana-go"
	lua "github.com/yuin/gopher-lua"
)

// TestLua_GetBalance verifies that Lua getBalance() returns a positive balance
// for a freshly funded wallet on the local Surfpool validator.
func TestLua_GetBalance(t *testing.T) {
	ensureValidator(t)

	info := newFundedClient(t)

	L := lua.NewState()
	defer L.Close()
	info.Client.Register(L)

	script := luaScript(`
		balance = getBalance("%s")
	`, info.Address)

	if err := L.DoString(script); err != nil {
		t.Fatalf("Lua getBalance failed: %v", err)
	}

	balance := L.GetGlobal("balance")
	if balance.Type() != lua.LTNumber {
		t.Fatalf("Expected number, got %s", balance.Type())
	}

	bal := float64(balance.(lua.LNumber))
	t.Logf("Balance: %.9f SOL", bal)

	if bal < 1.9 {
		t.Errorf("Expected balance >= 1.9 SOL, got %.9f", bal)
	}
}

// TestLua_TransferSol verifies that Lua transferSol() sends SOL
// from one wallet to another on the local validator.
func TestLua_TransferSol(t *testing.T) {
	ensureValidator(t)

	sender := newFundedClient(t)
	receiver := newAddress(t)

	L := lua.NewState()
	defer L.Close()
	sender.Client.Register(L)

	script := luaScript(`
		sig = transferSol("%s", 0.5)
	`, receiver)

	if err := L.DoString(script); err != nil {
		t.Fatalf("Lua transferSol failed: %v", err)
	}

	// Verify signature was returned
	sig := L.GetGlobal("sig")
	if sig.Type() != lua.LTString {
		t.Fatalf("Expected string signature, got %s", sig.Type())
	}
	t.Logf("Transfer signature: %s", sig.String())

	// Verify receiver balance
	receiverPubkey, _ := parsePublicKey(receiver)
	bal := waitForBalance(t, receiverPubkey, 0.49)
	t.Logf("Receiver balance: %.9f SOL", bal)

	if bal < 0.49 {
		t.Errorf("Expected receiver balance >= 0.49 SOL, got %.9f", bal)
	}
}

// TestLua_Transfer_SOL verifies the unified transfer() function with "SOL" token type.
func TestLua_Transfer_SOL(t *testing.T) {
	ensureValidator(t)

	sender := newFundedClient(t)
	receiver := newAddress(t)

	L := lua.NewState()
	defer L.Close()
	sender.Client.Register(L)

	script := luaScript(`
		sig = transfer("%s", "SOL", 0.3)
	`, receiver)

	if err := L.DoString(script); err != nil {
		t.Fatalf("Lua transfer (SOL) failed: %v", err)
	}

	sig := L.GetGlobal("sig")
	if sig.Type() != lua.LTString {
		t.Fatalf("Expected string signature, got %s", sig.Type())
	}
	t.Logf("Transfer signature: %s", sig.String())

	receiverPubkey, _ := parsePublicKey(receiver)
	bal := waitForBalance(t, receiverPubkey, 0.29)
	t.Logf("Receiver balance: %.9f SOL", bal)

	if bal < 0.29 {
		t.Errorf("Expected receiver balance >= 0.29 SOL, got %.9f", bal)
	}
}

// TestLua_FullPipeline runs a complete Lua flow as the frontend would compile it:
//
//	OnSolReceived → Compute (subtract fee) → Transfer (send back)
//
// This simulates: when SOL is received, subtract 0.001 as fee, send back the rest.
func TestLua_FullPipeline(t *testing.T) {
	ensureValidator(t)

	// "sender" is the wallet that runs the automation (has the private key)
	sender := newFundedClient(t)
	// "origin" is the address that "sent" the SOL (we'll send back to this address)
	origin := newFundedAddress(t, 1.0)

	L := lua.NewState()
	defer L.Close()
	sender.Client.Register(L)

	// Set globals that the executor normally sets
	L.SetGlobal("rpcUrl", lua.LString(localRPC))
	L.SetGlobal("privateKey", lua.LString(sender.PrivateKey.String()))
	L.SetGlobal("my_address", lua.LString(sender.Address))

	// This is a Lua script matching what the frontend compiler would generate:
	// OnSolReceived trigger → Compute (amount - 0.001) → Transfer back to sender
	luaFlow := `
function on_sol_received(amount, sender_addr)
  local amount_to_send = amount - 0.001
  transfer(sender_addr, "SOL", amount_to_send)
end
`

	if err := L.DoString(luaFlow); err != nil {
		t.Fatalf("Failed to load Lua flow: %v", err)
	}

	// Verify the function was registered
	fn := L.GetGlobal("on_sol_received")
	if fn.Type() != lua.LTFunction {
		t.Fatalf("Expected on_sol_received to be a function, got %s", fn.Type())
	}

	// Get origin's balance before the call
	originPubkey, _ := parsePublicKey(origin)
	balBefore := getBalanceSOL(t, originPubkey)
	t.Logf("Origin balance before: %.9f SOL", balBefore)

	// Simulate: 0.5 SOL was received from "origin"
	err := L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, lua.LNumber(0.5), lua.LString(origin))

	if err != nil {
		t.Fatalf("on_sol_received execution failed: %v", err)
	}

	// Origin should have received ~0.499 SOL back (0.5 - 0.001 fee)
	balAfter := waitForBalance(t, originPubkey, balBefore+0.49)
	gained := balAfter - balBefore
	t.Logf("Origin balance after: %.9f SOL (gained %.9f)", balAfter, gained)

	if gained < 0.49 {
		t.Errorf("Expected origin to gain >= 0.49 SOL, got %.9f", gained)
	}
}

// parsePublicKey is a helper to parse a base58 public key (panics on error for tests).
func parsePublicKey(address string) (solana.PublicKey, error) {
	return solana.PublicKeyFromBase58(address)
}
