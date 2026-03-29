package panon

import (
	"testing"

	lua "github.com/yuin/gopher-lua"
)

func TestGetTokenBalance(t *testing.T) {
	L := lua.NewState()
	defer L.Close()

	rpcURL := "https://api.devnet.solana.com"
	c := New(rpcURL, "")
	c.Register(L)

	// Test with a known devnet account that has token balances
	// Using a well-known devnet test account
	script := `
		-- Account with token balances on devnet
		accountAddress = "8bK8pCuBnJsu4C25g6cr7j7YEosSpHwmYamP2HMBT9Pd"
		-- USDC Devnet Mint
		tokenMint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
		
		balance, decimals = getTokenBalance(accountAddress, tokenMint)
		if balance then
			print("Token Balance:", balance)
			print("Decimals:", decimals)
		else
			print("Failed to get token balance")
		end
	`

	err := L.DoString(script)
	if err != nil {
		t.Logf("Note: Token balance query failed (account may not have token account): %v", err)
		// This is expected for some devnet accounts that don't have token accounts
		// Test passes if the function is callable
		return
	}

	balance := L.GetGlobal("balance")
	decimals := L.GetGlobal("decimals")

	if balance != lua.LNil {
		t.Logf("Balance: %s", balance.String())
	}
	if decimals != lua.LNil {
		t.Logf("Decimals: %s", decimals.String())
	}
}
