package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	lua "github.com/yuin/gopher-lua"

	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/models"
	"github.com/salismazaya/panon/panon"
)

// HandleTokenTransaction handles token transactions detected by the listener.
func (h *Handlers) HandleTokenTransaction(ctx context.Context, sig *solana.Signature, network models.Network, workspaceID uint, tokenMint string) {
	rpcClient := h.SolListener.GetRPCClient(network)

	// Fetch transaction metadata to verify the token transfer
	var tx *rpc.GetTransactionResult
	var err error
	for i := 0; i < 3; i++ {
		tx, err = rpcClient.GetTransaction(
			ctx,
			*sig,
			&rpc.GetTransactionOpts{
				Commitment: rpc.CommitmentConfirmed,
				Encoding:   solana.EncodingBase64,
			},
		)
		if err == nil && tx != nil && tx.Meta != nil {
			break
		}
		// If transaction not found immediately, retry a few times (it might be fresh)
	}

	if err != nil || tx == nil || tx.Meta == nil {
		return
	}

	db := database.GetDatabase()
	var workspace models.Workspace
	if err := db.Preload("Wallet").First(&workspace, workspaceID).Error; err != nil {
		return
	}

	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return
	}
	myPubkey := pk.PublicKey()

	// Find token amount difference for my wallet in this transaction
	var preAmount, postAmount float64
	found := false

	// Iterate through pre and post token balances
	for _, b := range tx.Meta.PreTokenBalances {
		if b.Mint.String() == tokenMint && b.Owner != nil && b.Owner.Equals(myPubkey) {
			if b.UiTokenAmount.UiAmount != nil {
				preAmount = *b.UiTokenAmount.UiAmount
			}
		}
	}

	for _, b := range tx.Meta.PostTokenBalances {
		if b.Mint.String() == tokenMint && b.Owner != nil && b.Owner.Equals(myPubkey) {
			if b.UiTokenAmount.UiAmount != nil {
				postAmount = *b.UiTokenAmount.UiAmount
				found = true
			}
		}
	}

	// If post-balance > pre-balance, it's an inbound transfer
	if found && postAmount > preAmount {
		amountReceived := postAmount - preAmount
		sender := "unknown"

		txParsed, err := tx.Transaction.GetTransaction()
		if err == nil && len(txParsed.Message.AccountKeys) > 0 {
			sender = txParsed.Message.AccountKeys[0].String()
		}

		log.Printf("🪙 Detected Inbound Token Transfer: %.6f of %s", amountReceived, tokenMint)
		h.ExecuteTokenLuaTrigger(ctx, amountReceived, sender, network, workspace.Wallet.GetPrivateKey(), workspace.ID, tokenMint)
	}
}

// ExecuteTokenLuaTrigger executes the Lua trigger specifically for token transfers.
func (h *Handlers) ExecuteTokenLuaTrigger(ctx context.Context, amount float64, sender string, network models.Network, privateKey string, workspaceId uint, tokenMint string) {
	db := database.GetDatabase()
	var workspace models.Workspace
	if err := db.First(&workspace, workspaceId).Error; err != nil {
		return
	}

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

	pk, err := solana.PrivateKeyFromBase58(privateKey)
	if err != nil {
		return
	}
	address := pk.PublicKey().String()

	// Use shared RPC client from listener
	rpcClient := h.SolListener.GetRPCClient(network)
	client := panon.New(rpcClient, privateKey)
	client.Register(L)

	L.SetGlobal("rpcUrl", lua.LString(h.SolListener.GetRPCURL(network)))
	L.SetGlobal("privateKey", lua.LString(privateKey))
	L.SetGlobal("my_address", lua.LString(address))

	if err := L.DoString(code); err != nil {
		log.Printf("❌ Lua Script Error: %v", err)
		return
	}

	// Trigger format: on_token_<address>_received
	triggerName := fmt.Sprintf("on_token_%s_received", tokenMint)
	fn := L.GetGlobal(triggerName)
	if fn.Type() != lua.LTFunction {
		return
	}

	err = L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, lua.LNumber(amount), lua.LString(sender))

	if err != nil {
		log.Printf("❌ Error executing Lua callback %s: %v", triggerName, err)
	} else {
		log.Printf("✅ Lua callback %s executed successfully", triggerName)
	}
}
