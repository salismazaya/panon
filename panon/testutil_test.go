//go:build integration

package panon

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

const localRPC = "http://localhost:8899"

// ensureValidator skips the test if the local Surfpool/validator is not reachable.
func ensureValidator(t *testing.T) {
	t.Helper()

	client := &http.Client{Timeout: 2 * time.Second}
	body := `{"jsonrpc":"2.0","id":1,"method":"getHealth"}`
	resp, err := client.Post(localRPC, "application/json", strings.NewReader(body))
	if err != nil {
		t.Skipf("Surfpool not running at %s: %v", localRPC, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Skipf("Surfpool not healthy at %s (status %d)", localRPC, resp.StatusCode)
	}
}

// airdrop requests an airdrop and waits for confirmation.
func airdrop(t *testing.T, pubkey solana.PublicKey, lamports uint64) {
	t.Helper()

	client := rpc.New(localRPC)
	sig, err := client.RequestAirdrop(
		context.Background(),
		pubkey,
		lamports,
		rpc.CommitmentFinalized,
	)
	if err != nil {
		t.Fatalf("Airdrop request failed: %v", err)
	}

	// Poll for confirmation
	for i := 0; i < 30; i++ {
		time.Sleep(500 * time.Millisecond)
		status, err := client.GetSignatureStatuses(
			context.Background(),
			true, // search transaction history
			sig,
		)
		if err != nil {
			continue
		}
		if status != nil && len(status.Value) > 0 && status.Value[0] != nil {
			if status.Value[0].ConfirmationStatus == rpc.ConfirmationStatusFinalized ||
				status.Value[0].ConfirmationStatus == rpc.ConfirmationStatusConfirmed {
				return
			}
		}
	}

	t.Fatalf("Airdrop confirmation timed out for sig %s", sig)
}

// getBalanceSOL fetches the SOL balance for a pubkey.
func getBalanceSOL(t *testing.T, pubkey solana.PublicKey) float64 {
	t.Helper()

	client := rpc.New(localRPC)
	result, err := client.GetBalance(
		context.Background(),
		pubkey,
		rpc.CommitmentFinalized,
	)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}

	return float64(result.Value) / 1e9
}

// waitForBalance polls until the balance of pubkey is >= minSOL.
func waitForBalance(t *testing.T, pubkey solana.PublicKey, minSOL float64) float64 {
	t.Helper()

	for i := 0; i < 30; i++ {
		bal := getBalanceSOL(t, pubkey)
		if bal >= minSOL {
			return bal
		}
		time.Sleep(500 * time.Millisecond)
	}

	t.Fatalf("Balance for %s never reached %.4f SOL", pubkey, minSOL)
	return 0
}

// clientInfo holds a funded client and its keypair info for tests.
type clientInfo struct {
	Client     *Client
	PrivateKey solana.PrivateKey
	PublicKey  solana.PublicKey
	Address    string
}

// newFundedClient creates a new keypair, airdrops 2 SOL, and returns a panon Client.
func newFundedClient(t *testing.T) clientInfo {
	t.Helper()

	pk, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("Failed to generate keypair: %v", err)
	}

	pubkey := pk.PublicKey()
	t.Logf("Created test wallet: %s", pubkey)

	// Airdrop 2 SOL
	airdrop(t, pubkey, 2*solana.LAMPORTS_PER_SOL)
	waitForBalance(t, pubkey, 1.9)

	rpcClient := rpc.New(localRPC)
	client := New(rpcClient, pk.String())

	return clientInfo{
		Client:     client,
		PrivateKey: pk,
		PublicKey:  pubkey,
		Address:    pubkey.String(),
	}
}

// newFundedAddress creates a new keypair, airdrops some SOL, and returns just the address.
func newFundedAddress(t *testing.T, solAmount float64) string {
	t.Helper()

	pk, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("Failed to generate keypair: %v", err)
	}

	pubkey := pk.PublicKey()
	lamports := uint64(solAmount * float64(solana.LAMPORTS_PER_SOL))
	airdrop(t, pubkey, lamports)
	waitForBalance(t, pubkey, solAmount*0.9)

	return pubkey.String()
}

// newAddress creates a new keypair and returns the address (no funding).
func newAddress(t *testing.T) string {
	t.Helper()

	pk, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("Failed to generate keypair: %v", err)
	}

	return pk.PublicKey().String()
}

// luaScript is a helper to format a lua script with arguments.
func luaScript(format string, args ...interface{}) string {
	return fmt.Sprintf(format, args...)
}
