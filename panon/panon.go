package panon

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"encoding/json"

	"github.com/gagliardetto/solana-go"
	associatedtokenaccount "github.com/gagliardetto/solana-go/programs/associated-token-account"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/redis/go-redis/v9"
	lua "github.com/yuin/gopher-lua"
)

var (
	TokenProgramID     = solana.TokenProgramID
	Token2022ProgramID = solana.MustPublicKeyFromBase58("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
)

// FindAssociatedTokenAddressByProgram finds the associated token address for a given wallet, mint, and token program.
func FindAssociatedTokenAddressByProgram(wallet solana.PublicKey, mint solana.PublicKey, programID solana.PublicKey) (solana.PublicKey, uint8, error) {
	seeds := [][]byte{
		wallet.Bytes(),
		programID.Bytes(),
		mint.Bytes(),
	}
	return solana.FindProgramAddress(seeds, solana.SPLAssociatedTokenAccountProgramID)
}

// Client represents a Solana client with a specific RPC client and private key.
type Client struct {
	RPCClient      *rpc.Client
	PrivateKey     string
	DurableContext context.Context
	RedisClient    *redis.Client
	WorkspaceID    uint
	JupiterAPIKey  string
}

// New creates a new panon Client with a durable context for persistent operations.
func New(ctx context.Context, rpcClient *rpc.Client, privateKey string, rdb *redis.Client, wsID uint, jupiterAPIKey string) *Client {
	return &Client{
		RPCClient:      rpcClient,
		PrivateKey:     privateKey,
		DurableContext: ctx,
		RedisClient:    rdb,
		WorkspaceID:    wsID,
		JupiterAPIKey:  jupiterAPIKey,
	}
}

// ensureValidBlockhash ensures that the client has a valid recent blockhash.
// It retrieves it from the Lua global "recentBlockhash". If it's missing or stale,
// it fetches a new one and updates the global variable.
func (c *Client) ensureValidBlockhash(L *lua.LState) (solana.Hash, error) {
	val := L.GetGlobal("recentBlockhash")
	if hashStr, ok := val.(lua.LString); ok && string(hashStr) != "" {
		hash, err := solana.HashFromBase58(string(hashStr))
		if err == nil && !hash.IsZero() {
			return hash, nil
		}
	}

	latestBlockhash, err := c.RPCClient.GetLatestBlockhash(c.DurableContext, rpc.CommitmentFinalized)
	if err != nil {
		return solana.Hash{}, err
	}
	newHash := latestBlockhash.Value.Blockhash
	L.SetGlobal("recentBlockhash", lua.LString(newHash.String()))
	return newHash, nil
}

// Register registers all Solana-related functions to the provided Lua state.
func (c *Client) Register(L *lua.LState) {
	L.SetGlobal("getBalance", L.NewFunction(c.getBalance))
	L.SetGlobal("transferSol", L.NewFunction(c.transferSol))
	L.SetGlobal("getTokenBalance", L.NewFunction(c.getTokenBalance))
	L.SetGlobal("transferToken", L.NewFunction(c.transferToken))
	L.SetGlobal("transfer", L.NewFunction(c.transfer))
	L.SetGlobal("createTokenAccount", L.NewFunction(c.createTokenAccount))
	L.SetGlobal("mintTokens", L.NewFunction(c.mintTokens))
	L.SetGlobal("httpRequest", L.NewFunction(c.httpRequest))
	L.SetGlobal("setMemory", L.NewFunction(c.setMemory))
	L.SetGlobal("getMemory", L.NewFunction(c.getMemory))
	L.SetGlobal("jsonExtract", L.NewFunction(c.jsonExtract))
	L.SetGlobal("getRentExemptBalance", L.NewFunction(c.getRentExemptBalance))
	L.SetGlobal("waitForTransaction", L.NewFunction(c.waitForTransaction))
	L.SetGlobal("jupiterSwap", L.NewFunction(c.jupiterSwap))
}

// getBalance returns the SOL balance of a given address.
func (c *Client) getBalance(L *lua.LState) int {
	address := L.ToString(1)

	client := c.RPCClient
	pubkey, err := solana.PublicKeyFromBase58(address)

	if err != nil {
		L.RaiseError("account error")
		return 0
	}

	balance, err := client.GetBalance(
		c.DurableContext,
		pubkey,
		rpc.CommitmentConfirmed,
	)

	if err != nil {
		L.RaiseError("http request failed")
		return 0
	}

	L.Push(lua.LNumber(float64(balance.Value) / 1e9))
	return 1
}

// getRentExemptBalance returns the standard rent-exempt minimum for a system account in SOL.
func (c *Client) getRentExemptBalance(L *lua.LState) int {
	resp, err := c.RPCClient.GetMinimumBalanceForRentExemption(
		c.DurableContext,
		0, // System account data size
		rpc.CommitmentConfirmed,
	)
	if err != nil {
		L.Push(lua.LNumber(0.00089088))
		return 1
	}

	L.Push(lua.LNumber(float64(resp) / 1e9))
	return 1
}

// transferSol executes a SOL transfer.

// func (c *Client) registerCron(L *lua.LState) int {
// 	spec := L.ToString(1)
// 	callback := L.ToFunction(2)

// 	scheduler.AddFunc(spec, func() {
// 		L.DoString(callback.String())
// 	})
// 	return 0
// }

// func (c *Client) stopAllCron() int {
// 	scheduler.Stop()
// 	return 0
// }

// transferSol executes a SOL transfer.
func (c *Client) transferSol(L *lua.LState) int {
	toAddress := L.ToString(1)
	amount := L.ToNumber(2)

	client := c.RPCClient

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("%s", "invalid private key: "+err.Error())
		return 0
	}

	toPubkey, err := solana.PublicKeyFromBase58(toAddress)
	if err != nil {
		L.RaiseError("%s", "invalid recipient address: "+err.Error())
		return 0
	}

	if amount <= 0 {
		L.RaiseError("transfer amount must be greater than zero")
		return 0
	}

	amountLamports := uint64(math.Round(float64(amount) * 1e9))

	var sig solana.Signature
	var tx *solana.Transaction

	for i := 0; i < 5; i++ {
		// 1. Fetch Fresh Balance & Rent Exemption
		balanceResult, errBal := client.GetBalance(c.DurableContext, account.PublicKey(), rpc.CommitmentProcessed)
		currAmountLamports := amountLamports
		if errBal == nil {
			balance := balanceResult.Value
			rentExempt, _ := client.GetMinimumBalanceForRentExemption(c.DurableContext, 0, rpc.CommitmentConfirmed)
			if rentExempt == 0 {
				rentExempt = 890880
			}

			fee := uint64(5000)
			if balance < fee {
				log.Printf("⚠️ [transferSol] Attempt %d: Insufficient balance for fee (%d < %d)", i+1, balance, fee)
			} else {
				if balance >= currAmountLamports+fee {
					remaining := balance - currAmountLamports - fee
					if remaining > 0 && remaining < rentExempt {
						if remaining > rentExempt/2 {
							currAmountLamports -= (rentExempt - remaining)
						} else {
							currAmountLamports = balance - fee
						}
					}
				} else {
					currAmountLamports = balance - fee
				}
			}
		}

		// 2. Get Blockhash
		recentBlockhash, errHash := c.ensureValidBlockhash(L)
		if errHash != nil {
			log.Printf("⚠️ [transferSol] Attempt %d: Failed to get blockhash: %v", i+1, errHash)
			time.Sleep(2 * time.Second)
			continue
		}

		// 3. Create & Sign Transaction
		tx, err = solana.NewTransaction(
			[]solana.Instruction{
				system.NewTransferInstruction(
					currAmountLamports,
					account.PublicKey(),
					toPubkey,
				).Build(),
			},
			recentBlockhash,
			solana.TransactionPayer(account.PublicKey()),
		)
		if err != nil {
			L.RaiseError("failed to create transaction: %v", err)
			return 0
		}

		_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
			if key == account.PublicKey() {
				return &account
			}
			return nil
		})

		// 4. Send Transaction
		sig, err = client.SendTransaction(c.DurableContext, tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "rent") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [transferSol] Attempt %d/5 failed: %v. Retrying in 2s...", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}

		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 5 attempts: %v", err)
	return 0
}

// transfer executes a unified transfer (SOL or SPL Token).
// Usage: transfer(receiver, "SOL" | mint_address, amount)
func (c *Client) transfer(L *lua.LState) int {
	toAddress := L.ToString(1)
	tokenType := L.ToString(2)
	amount := L.ToNumber(3)

	if tokenType == "SOL" {
		// Native SOL Transfer
		client := c.RPCClient

		account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
		if err != nil {
			L.RaiseError("invalid private key: %v", err)
			return 0
		}

		toPubkey, err := solana.PublicKeyFromBase58(toAddress)
		if err != nil {
			L.RaiseError("invalid recipient address: %v", err)
			return 0
		}

		if amount <= 0 {
			L.RaiseError("transfer amount must be greater than zero")
			return 0
		}

		amountLamports := uint64(math.Round(float64(amount) * 1e9))
		var signature solana.Signature
		var tx *solana.Transaction

		for i := 0; i < 5; i++ {
			// 1. Fetch Fresh Balance & Rent Exemption
			balanceResult, errBal := client.GetBalance(c.DurableContext, account.PublicKey(), rpc.CommitmentProcessed)
			currAmountLamports := amountLamports
			if errBal == nil {
				balance := balanceResult.Value
				rentExempt, _ := client.GetMinimumBalanceForRentExemption(c.DurableContext, 0, rpc.CommitmentConfirmed)
				if rentExempt == 0 {
					rentExempt = 890880
				}

				fee := uint64(5000)
				if balance < fee {
					log.Printf("⚠️ [transfer SOL] Attempt %d: Insufficient balance for fee (%d < %d)", i+1, balance, fee)
				} else {
					if balance >= currAmountLamports+fee {
						remaining := balance - currAmountLamports - fee
						if remaining > 0 && remaining < rentExempt {
							if remaining > rentExempt/2 {
								currAmountLamports -= (rentExempt - remaining)
							} else {
								currAmountLamports = balance - fee
							}
						}
					} else {
						currAmountLamports = balance - fee
					}
				}
			}

			// 2. Get Blockhash
			recentBlockhash, errHash := c.ensureValidBlockhash(L)
			if errHash != nil {
				log.Printf("⚠️ [transfer SOL] Attempt %d: Failed to get blockhash: %v", i+1, errHash)
				time.Sleep(2 * time.Second)
				continue
			}

			// 3. Create & Sign Transaction
			tx, err = solana.NewTransaction(
				[]solana.Instruction{
					system.NewTransferInstruction(
						currAmountLamports,
						account.PublicKey(),
						toPubkey,
					).Build(),
				},
				recentBlockhash,
				solana.TransactionPayer(account.PublicKey()),
			)
			if err != nil {
				L.RaiseError("failed to create transaction: %v", err)
				return 0
			}

			_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
				if key == account.PublicKey() {
					return &account
				}
				return nil
			})

			// 4. Send Transaction
			signature, err = client.SendTransaction(c.DurableContext, tx)
			if err == nil {
				L.Push(lua.LString(signature.String()))
				return 1
			}

			errStr := err.Error()
			if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "rent") || strings.Contains(errStr, "Blockhash") {
				log.Printf("⚠️ [transfer SOL] Attempt %d/5 failed: %v. Retrying in 2s...", i+1, err)
				time.Sleep(2 * time.Second)
				continue
			}

			L.RaiseError("failed to send transaction: %v", err)
			return 0
		}

		L.RaiseError("failed to send transaction after 5 attempts: %v", err)
		return 0
	}

	if amount <= 0 {
		L.RaiseError("transfer amount must be greater than zero")
		return 0
	}

	// Treat tokenType as the mint address (e.g., for USDC)
	tokenMint := tokenType
	client := c.RPCClient

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("invalid private key: %v", err)
		return 0
	}

	toPubkey, err := solana.PublicKeyFromBase58(toAddress)
	if err != nil {
		L.RaiseError("invalid recipient address: %v", err)
		return 0
	}

	tokenMintPubkey, err := solana.PublicKeyFromBase58(tokenMint)
	if err != nil {
		L.RaiseError("invalid token mint: %v", err)
		return 0
	}

	// Fetch mint info to determine token program
	mintAccount, err := client.GetAccountInfo(c.DurableContext, tokenMintPubkey)
	if err != nil {
		L.RaiseError("failed to get mint info: %v", err)
		return 0
	}
	tokenProgram := mintAccount.Value.Owner

	// Derive ATAs using the correct program
	fromATA, _, err := FindAssociatedTokenAddressByProgram(account.PublicKey(), tokenMintPubkey, tokenProgram)
	if err != nil {
		L.RaiseError("failed to find sender ATA: %v", err)
		return 0
	}

	toATA, _, err := FindAssociatedTokenAddressByProgram(toPubkey, tokenMintPubkey, tokenProgram)
	if err != nil {
		L.RaiseError("failed to find recipient ATA: %v", err)
		return 0
	}

	instructions := []solana.Instruction{}
	_, err = client.GetAccountInfo(c.DurableContext, toATA)
	if err != nil { // Account likely missing, bundle creation instruction
		createInst := associatedtokenaccount.NewCreateInstruction(
			account.PublicKey(),
			toPubkey,
			tokenMintPubkey,
		)
		// Manual fix for Token-2022 program setting if needed
		if tokenProgram.Equals(Token2022ProgramID) {
			createInst.AccountMetaSlice[5].PublicKey = Token2022ProgramID
		}
		instructions = append(instructions, createInst.Build())
	}

	time.Sleep(1 * time.Second)
	recentBlockhash, err := c.ensureValidBlockhash(L)
	if err != nil {
		L.RaiseError("%s", "failed to get blockhash: "+err.Error())
		return 0
	}

	transferAmountRaw := amount

	// Switch to TransferChecked to support Token-2022
	// For robust decimal detection, especially for large Token-2022 accounts with extensions,
	// we'll extract the decimal value directly from the 44th byte of the data.
	mintData := mintAccount.Value.Data.GetBinary()
	if len(mintData) < 45 {
		L.RaiseError("failed to decode mint info: invalid account data size %d", len(mintData))
		return 0
	}
	mintDecimals := mintData[44]

	// Use decimals to calculate the actual amount in lamports with rounding
	transferAmount := uint64(math.Round(float64(transferAmountRaw) * math.Pow10(int(mintDecimals))))
	log.Printf("🚀 Preparing Token Transfer: %.6f (%d units) to %s", transferAmountRaw, transferAmount, toAddress)

	legacyInst, err := token.NewTransferCheckedInstruction(
		transferAmount,
		mintDecimals,
		fromATA,
		tokenMintPubkey,
		toATA,
		account.PublicKey(),
		[]solana.PublicKey{},
	).ValidateAndBuild()

	if err != nil {
		L.RaiseError("failed to build transfer instruction: %v", err)
		return 0
	}

	data, err := legacyInst.Data()
	if err != nil {
		L.RaiseError("failed to get instruction data: %v", err)
		return 0
	}

	transferInst := solana.NewInstruction(
		tokenProgram,
		legacyInst.Accounts(),
		data,
	)

	instructions = append(instructions, transferInst)

	tx, err := solana.NewTransaction(
		instructions,
		recentBlockhash,
		solana.TransactionPayer(account.PublicKey()),
	)

	if err != nil {
		L.RaiseError("%s", "failed to create transaction: "+err.Error())
		return 0
	}

	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if key == account.PublicKey() {
				return &account
			}
			return nil
		},
	)

	if err != nil {
		L.RaiseError("failed to sign transaction: %v", err)
		return 0
	}

	var sig solana.Signature
	for i := 0; i < 5; i++ {
		sig, err = client.SendTransaction(c.DurableContext, tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		if strings.Contains(err.Error(), "insufficient funds") || strings.Contains(err.Error(), "0x1") || strings.Contains(err.Error(), "Blockhash") {
			log.Printf("⚠️ [transfer] Token Attempt %d/5 failed for %s: %v. Retrying in 2s (possible RPC lag)...", i+1, tokenMint, err)
			time.Sleep(2 * time.Second)
			if i < 4 {
				latestBlockhash, errHash := client.GetLatestBlockhash(c.DurableContext, rpc.CommitmentFinalized)
				if errHash == nil {
					newHash := latestBlockhash.Value.Blockhash
					L.SetGlobal("recentBlockhash", lua.LString(newHash.String()))
					tx.Message.RecentBlockhash = newHash
					_, _ = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
						if key == account.PublicKey() {
							return &account
						}
						return nil
					})
				}
			}
			continue
		}
		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 5 attempts (check balance or RPC lag): %v", err)
	return 0
}

// getTokenBalance returns the token balance for a given owner and mint.
func (c *Client) getTokenBalance(L *lua.LState) int {
	accountAddress := L.ToString(1)
	tokenMint := L.ToString(2)

	client := c.RPCClient

	accountPubkey, err := solana.PublicKeyFromBase58(accountAddress)
	if err != nil {
		L.RaiseError("%s", "invalid account address: "+err.Error())
		return 0
	}

	tokenMintPubkey, err := solana.PublicKeyFromBase58(tokenMint)
	if err != nil {
		L.RaiseError("%s", "invalid token mint: "+err.Error())
		return 0
	}

	// Fetch mint info to determine token program
	mintAccount, err := client.GetAccountInfo(c.DurableContext, tokenMintPubkey)
	if err != nil {
		L.RaiseError("%s", "failed to get mint info: "+err.Error())
		return 0
	}
	tokenProgram := mintAccount.Value.Owner

	// Derive ATAs using the correct program
	ata, _, err := FindAssociatedTokenAddressByProgram(accountPubkey, tokenMintPubkey, tokenProgram)
	if err != nil {
		L.RaiseError("%s", "failed to find ATA: "+err.Error())
		return 0
	}

	accountInfo, err := client.GetTokenAccountBalance(c.DurableContext, ata, rpc.CommitmentFinalized)
	if err != nil {
		if strings.Contains(err.Error(), "could not find account") {
			// If account doesn't exist, return balance 0 with correct decimals from mint
			mintData := mintAccount.Value.Data.GetBinary()
			if len(mintData) < 45 {
				L.RaiseError("failed to decode mint info: invalid account data size")
				return 0
			}
			mintDecimals := mintData[44]
			L.Push(lua.LNumber(0))
			L.Push(lua.LString(strconv.Itoa(int(mintDecimals))))
			return 2
		}
		L.RaiseError("%s", "failed to get token balance: "+err.Error())
		return 0
	}

	if accountInfo.Value.UiAmount != nil {
		L.Push(lua.LNumber(*accountInfo.Value.UiAmount))
	} else {
		amountRaw, _ := strconv.ParseFloat(accountInfo.Value.Amount, 64)
		L.Push(lua.LNumber(amountRaw / math.Pow10(int(accountInfo.Value.Decimals))))
	}
	L.Push(lua.LString(fmt.Sprintf("%v", accountInfo.Value.Decimals)))
	return 2
}

// transferToken executes an SPL token transfer.
func (c *Client) transferToken(L *lua.LState) int {
	toAddress := L.ToString(1)
	tokenMint := L.ToString(2)
	amount := L.ToNumber(3)

	client := c.RPCClient

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("%s", "invalid private key: "+err.Error())
		return 0
	}

	toPubkey, err := solana.PublicKeyFromBase58(toAddress)
	if err != nil {
		L.RaiseError("%s", "invalid recipient address: "+err.Error())
		return 0
	}

	tokenMintPubkey, err := solana.PublicKeyFromBase58(tokenMint)
	if err != nil {
		L.RaiseError("%s", "invalid token mint: "+err.Error())
		return 0
	}

	// Fetch mint info to determine token program
	mintAccount, err := client.GetAccountInfo(c.DurableContext, tokenMintPubkey)
	if err != nil {
		L.RaiseError("%s", "failed to get mint info: "+err.Error())
		return 0
	}
	tokenProgram := mintAccount.Value.Owner

	// Derive ATAs using the correct program
	fromATA, _, err := FindAssociatedTokenAddressByProgram(account.PublicKey(), tokenMintPubkey, tokenProgram)
	if err != nil {
		L.RaiseError("%s", "failed to find sender ATA: "+err.Error())
		return 0
	}

	toATA, _, err := FindAssociatedTokenAddressByProgram(toPubkey, tokenMintPubkey, tokenProgram)
	if err != nil {
		L.RaiseError("%s", "failed to find recipient ATA: "+err.Error())
		return 0
	}

	instructions := []solana.Instruction{}
	_, err = client.GetAccountInfo(c.DurableContext, toATA)
	if err != nil { // Account likely missing, bundle creation instruction
		createInst := associatedtokenaccount.NewCreateInstruction(
			account.PublicKey(),
			toPubkey,
			tokenMintPubkey,
		)
		// Manual fix for Token-2022 program setting if needed
		if tokenProgram.Equals(Token2022ProgramID) {
			createInst.AccountMetaSlice[5].PublicKey = Token2022ProgramID
		}
		instructions = append(instructions, createInst.Build())
	}

	time.Sleep(1 * time.Second)
	recentBlockhash, err := c.ensureValidBlockhash(L)
	if err != nil {
		L.RaiseError("%s", "failed to get blockhash: "+err.Error())
		return 0
	}

	if amount <= 0 {
		L.RaiseError("transfer amount must be greater than zero")
		return 0
	}

	transferAmountRaw := amount

	// Switch to TransferChecked to support Token-2022
	// For robust decimal detection, especially for large Token-2022 accounts with extensions,
	// we'll extract the decimal value directly from the 44th byte of the data.
	mintData := mintAccount.Value.Data.GetBinary()
	if len(mintData) < 45 {
		L.RaiseError("%s", "failed to decode mint info: invalid account data size")
		return 0
	}
	mintDecimals := mintData[44]

	// Use decimals to calculate the actual amount in lamports with rounding
	transferAmount := uint64(math.Round(float64(transferAmountRaw) * math.Pow10(int(mintDecimals))))
	log.Printf("🚀 [transferToken] Preparing Token Transfer: %.6f (%d units) to %s", transferAmountRaw, transferAmount, toAddress)

	legacyInst, err := token.NewTransferCheckedInstruction(
		transferAmount,
		mintDecimals,
		fromATA,
		tokenMintPubkey,
		toATA,
		account.PublicKey(),
		[]solana.PublicKey{},
	).ValidateAndBuild()

	if err != nil {
		L.RaiseError("%s", "failed to build transfer instruction: "+err.Error())
		return 0
	}

	data, err := legacyInst.Data()
	if err != nil {
		L.RaiseError("%s", "failed to get instruction data: "+err.Error())
		return 0
	}

	transferInst := solana.NewInstruction(
		tokenProgram,
		legacyInst.Accounts(),
		data,
	)

	instructions = append(instructions, transferInst)

	tx, err := solana.NewTransaction(
		instructions,
		recentBlockhash,
		solana.TransactionPayer(account.PublicKey()),
	)

	if err != nil {
		L.RaiseError("%s", "failed to create transaction: "+err.Error())
		return 0
	}

	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if key == account.PublicKey() {
				return &account
			}
			return nil
		},
	)

	if err != nil {
		L.RaiseError("%s", "failed to sign transaction: "+err.Error())
		return 0
	}

	var sig solana.Signature
	for i := 0; i < 5; i++ {
		sig, err = client.SendTransaction(c.DurableContext, tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "prior credit") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [transferToken] Attempt %d/5 failed for %s: %v. Retrying in 2s (possible RPC lag)...", i+1, tokenMint, err)
			time.Sleep(2 * time.Second)
			if i < 4 {
				latestBlockhash, errHash := client.GetLatestBlockhash(c.DurableContext, rpc.CommitmentFinalized)
				if errHash == nil {
					newHash := latestBlockhash.Value.Blockhash
					L.SetGlobal("recentBlockhash", lua.LString(newHash.String()))
					tx.Message.RecentBlockhash = newHash
					_, _ = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
						if key == account.PublicKey() {
							return &account
						}
						return nil
					})
				}
			}
			continue
		}
		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 5 attempts (check balance or RPC lag): %v", err)
	return 0
}

// createTokenAccount creates a new Associated Token Account.
func (c *Client) createTokenAccount(L *lua.LState) int {
	ownerAddress := L.ToString(1)
	tokenMint := L.ToString(2)

	client := c.RPCClient

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("%s", "invalid private key: "+err.Error())
		return 0
	}

	ownerPubkey, err := solana.PublicKeyFromBase58(ownerAddress)
	if err != nil {
		L.RaiseError("%s", "invalid owner address: "+err.Error())
		return 0
	}

	tokenMintPubkey, err := solana.PublicKeyFromBase58(tokenMint)
	if err != nil {
		L.RaiseError("%s", "invalid token mint: "+err.Error())
		return 0
	}

	ata, _, err := solana.FindAssociatedTokenAddress(ownerPubkey, tokenMintPubkey)
	if err != nil {
		L.RaiseError("%s", "failed to find ATA: "+err.Error())
		return 0
	}

	time.Sleep(1 * time.Second)
	recentBlockhash, err := c.ensureValidBlockhash(L)
	if err != nil {
		L.RaiseError("%s", "failed to get blockhash: "+err.Error())
		return 0
	}

	tx, err := solana.NewTransaction(
		[]solana.Instruction{
			associatedtokenaccount.NewCreateInstruction(
				account.PublicKey(),
				ownerPubkey,
				tokenMintPubkey,
			).Build(),
		},
		recentBlockhash,
		solana.TransactionPayer(account.PublicKey()),
	)

	if err != nil {
		L.RaiseError("%s", "failed to create transaction: "+err.Error())
		return 0
	}

	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if key == account.PublicKey() {
				return &account
			}
			return nil
		},
	)

	if err != nil {
		L.RaiseError("%s", "failed to sign transaction: "+err.Error())
		return 0
	}

	var signature solana.Signature
	for i := 0; i < 3; i++ {
		signature, err = client.SendTransaction(c.DurableContext, tx)
		if err == nil {
			L.Push(lua.LString(signature.String()))
			L.Push(lua.LString(ata.String()))
			return 2
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [createTokenAccount] Stale blockhash or account not ready (Attempt %d/3), retrying in 2s...", i+1)
			time.Sleep(2 * time.Second)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(c.DurableContext, rpc.CommitmentFinalized)
				if errHash == nil {
					newHash := latestBlockhash.Value.Blockhash
					L.SetGlobal("recentBlockhash", lua.LString(newHash.String()))
					tx.Message.RecentBlockhash = newHash
					// RE-SIGN REQUIRED!
					_, _ = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
						if key == account.PublicKey() {
							return &account
						}
						return nil
					})
				}
			}
			continue
		}
		L.RaiseError("%s", "failed to send transaction: "+err.Error())
		return 0
	}

	L.RaiseError("failed to create token account after 3 attempts: %v", err)
	return 0
}

// mintTokens mints new SPL tokens to a recipient.
func (c *Client) mintTokens(L *lua.LState) int {
	toAddress := L.ToString(1)
	tokenMint := L.ToString(2)
	amount := L.ToNumber(3)

	client := c.RPCClient

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("%s", "invalid private key: "+err.Error())
		return 0
	}

	toPubkey, err := solana.PublicKeyFromBase58(toAddress)
	if err != nil {
		L.RaiseError("%s", "invalid recipient address: "+err.Error())
		return 0
	}

	tokenMintPubkey, err := solana.PublicKeyFromBase58(tokenMint)
	if err != nil {
		L.RaiseError("%s", "invalid token mint: "+err.Error())
		return 0
	}

	toATA, _, err := solana.FindAssociatedTokenAddress(toPubkey, tokenMintPubkey)
	if err != nil {
		L.RaiseError("%s", "failed to find recipient ATA: "+err.Error())
		return 0
	}

	time.Sleep(1 * time.Second)
	recentBlockhash, err := c.ensureValidBlockhash(L)
	if err != nil {
		L.RaiseError("%s", "failed to get blockhash: "+err.Error())
		return 0
	}

	mintAmount := uint64(amount)

	tx, err := solana.NewTransaction(
		[]solana.Instruction{
			token.NewMintToInstruction(
				mintAmount,
				tokenMintPubkey,
				toATA,
				account.PublicKey(),
				[]solana.PublicKey{},
			).Build(),
		},
		recentBlockhash,
		solana.TransactionPayer(account.PublicKey()),
	)

	if err != nil {
		L.RaiseError("%s", "failed to create transaction: "+err.Error())
		return 0
	}

	var signature solana.Signature
	for i := 0; i < 3; i++ {
		signature, err = client.SendTransaction(c.DurableContext, tx)
		if err == nil {
			L.Push(lua.LString(signature.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [mintTokens] Stale blockhash or insufficient funds (Attempt %d/3), retrying in 2s...", i+1)
			time.Sleep(2 * time.Second)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(c.DurableContext, rpc.CommitmentFinalized)
				if errHash == nil {
					newHash := latestBlockhash.Value.Blockhash
					L.SetGlobal("recentBlockhash", lua.LString(newHash.String()))
					tx.Message.RecentBlockhash = newHash
					// RE-SIGN REQUIRED!
					_, _ = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
						if key == account.PublicKey() {
							return &account
						}
						return nil
					})
				}
			}
			continue
		}
		L.RaiseError("%s", "failed to send transaction: "+err.Error())
		return 0
	}

	L.RaiseError("failed to mint tokens after 3 attempts: %v", err)
	return 0
}

// httpRequest performs a generic HTTP request.
// Usage: body, status = httpRequest(url, method, headers, payload)
func (c *Client) httpRequest(L *lua.LState) int {
	url := L.ToString(1)
	method := strings.ToUpper(L.ToString(2))
	headersTable := L.ToTable(3)
	payload := L.ToString(4)

	var bodyReader io.Reader
	if payload != "" {
		bodyReader = bytes.NewBufferString(payload)
	}

	req, err := http.NewRequestWithContext(c.DurableContext, method, url, bodyReader)
	if err != nil {
		L.RaiseError("failed to create request: %v", err)
		return 0
	}

	if headersTable != nil {
		headersTable.ForEach(func(k, v lua.LValue) {
			req.Header.Set(k.String(), v.String())
		})
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		L.RaiseError("http request failed: %v", err)
		return 0
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		L.RaiseError("failed to read response body: %v", err)
		return 0
	}

	L.Push(lua.LString(string(body)))
	L.Push(lua.LNumber(float64(resp.StatusCode)))
	return 2
}

func (c *Client) setMemory(L *lua.LState) int {
	name := L.ToString(1)
	value := L.Get(2)

	if c.RedisClient == nil {
		L.RaiseError("redis client not initialized")
		return 0
	}

	var stringValue string
	switch v := value.(type) {
	case lua.LString:
		stringValue = string(v)
	case lua.LNumber:
		stringValue = v.String()
	case *lua.LTable:
		// Convert table to JSON string
		data := tableToMap(v)
		b, _ := json.Marshal(data)
		stringValue = string(b)
	case lua.LBool:
		if bool(v) {
			stringValue = "true"
		} else {
			stringValue = "false"
		}
	case *lua.LNilType:
		stringValue = ""
	default:
		stringValue = value.String()
	}

	key := fmt.Sprintf("%d_%s", c.WorkspaceID, name)
	err := c.RedisClient.Set(c.DurableContext, key, stringValue, 0).Err()
	if err != nil {
		L.RaiseError("failed to set memory: %v", err)
	}
	return 0
}

func (c *Client) getMemory(L *lua.LState) int {
	name := L.ToString(1)

	if c.RedisClient == nil {
		L.RaiseError("redis client not initialized")
		return 0
	}

	key := fmt.Sprintf("%d_%s", c.WorkspaceID, name)
	val, err := c.RedisClient.Get(c.DurableContext, key).Result()
	if err != nil {
		if err == redis.Nil {
			L.Push(lua.LNil)
			return 1
		}
		L.RaiseError("failed to get memory: %v", err)
		return 0
	}

	// Auto-convert types
	if val == "true" {
		L.Push(lua.LBool(true))
	} else if val == "false" {
		L.Push(lua.LBool(false))
	} else if n, err := strconv.ParseFloat(val, 64); err == nil {
		L.Push(lua.LNumber(n))
	} else if strings.HasPrefix(val, "{") || strings.HasPrefix(val, "[") {
		// Attempt to parse as JSON table
		var data interface{}
		if err := json.Unmarshal([]byte(val), &data); err == nil {
			L.Push(mapToTable(L, data))
		} else {
			L.Push(lua.LString(val))
		}
	} else {
		L.Push(lua.LString(val))
	}

	return 1
}

func tableToMap(t *lua.LTable) interface{} {
	if t.MaxN() > 0 {
		// Array-like
		ret := make([]interface{}, 0, t.MaxN())
		t.ForEach(func(_, v lua.LValue) {
			ret = append(ret, lValueToInterface(v))
		})
		return ret
	}
	// Map-like
	ret := make(map[string]interface{})
	t.ForEach(func(k, v lua.LValue) {
		ret[k.String()] = lValueToInterface(v)
	})
	return ret
}

func lValueToInterface(v lua.LValue) interface{} {
	switch val := v.(type) {
	case lua.LString:
		return string(val)
	case lua.LNumber:
		return float64(val)
	case lua.LBool:
		return bool(val)
	case *lua.LTable:
		return tableToMap(val)
	default:
		return nil
	}
}

func mapToTable(L *lua.LState, data interface{}) lua.LValue {
	switch v := data.(type) {
	case map[string]interface{}:
		t := L.NewTable()
		for k, val := range v {
			L.SetTable(t, lua.LString(k), mapToTable(L, val))
		}
		return t
	case []interface{}:
		t := L.NewTable()
		for _, val := range v {
			t.Append(mapToTable(L, val))
		}
		return t
	case string:
		return lua.LString(v)
	case float64:
		return lua.LNumber(v)
	case bool:
		return lua.LBool(v)
	case nil:
		return lua.LNil
	default:
		return lua.LString(fmt.Sprintf("%v", v))
	}
}

// jsonExtract extracts a value from a JSON string using a path.
// Usage: value = jsonExtract(json_string, path)
// Example: name = jsonExtract(body, "user.name")
func (c *Client) jsonExtract(L *lua.LState) int {
	jsonStr := L.ToString(1)
	path := L.ToString(2)

	if jsonStr == "" || path == "" {
		L.Push(lua.LNil)
		return 1
	}

	// Parse JSON
	var data interface{}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		L.Push(lua.LNil)
		return 1
	}

	// Handle paths like "data.list[0].name" by converting to ["data", "list", "0", "name"]
	normalizedPath := strings.ReplaceAll(path, "[", ".")
	normalizedPath = strings.ReplaceAll(normalizedPath, "]", "")
	parts := strings.Split(normalizedPath, ".")

	// Traversal
	current := data
	for _, part := range parts {
		if part == "" {
			continue
		}

		found := false
		// Try as map/object
		if m, ok := current.(map[string]interface{}); ok {
			if next, ok := m[part]; ok {
				current = next
				found = true
			}
		}

		// Try as array if not found in map and part is numeric
		if !found {
			if idx, err := strconv.Atoi(part); err == nil {
				if arr, ok := current.([]interface{}); ok {
					if idx >= 0 && idx < len(arr) {
						current = arr[idx]
						found = true
					}
				}
			}
		}

		if !found {
			L.Push(lua.LNil)
			return 1
		}
	}

	// Push result to Lua
	switch v := current.(type) {
	case string:
		L.Push(lua.LString(v))
	case float64:
		L.Push(lua.LNumber(v))
	case int:
		L.Push(lua.LNumber(float64(v)))
	case bool:
		L.Push(lua.LBool(v))
	case nil:
		L.Push(lua.LNil)
	default:
		// For objects or arrays, return as JSON string
		b, _ := json.Marshal(v)
		L.Push(lua.LString(string(b)))
	}

	return 1
}

// waitForTransaction waits for a transaction to reach the desired commitment level.
// Usage: success = waitForTransaction(signature, [commitment])
func (c *Client) waitForTransaction(L *lua.LState) int {
	sigStr := L.ToString(1)
	commitmentStr := L.OptString(2, "finalized")

	sig, err := solana.SignatureFromBase58(sigStr)
	if err != nil {
		L.RaiseError("invalid signature: %v", err)
		return 0
	}

	commitment := rpc.CommitmentFinalized
	switch strings.ToLower(commitmentStr) {
	case "processed":
		commitment = rpc.CommitmentProcessed
	case "confirmed":
		commitment = rpc.CommitmentConfirmed
	case "finalized":
		commitment = rpc.CommitmentFinalized
	}

	log.Printf("⏳ Waiting for transaction %s to be %s...", sigStr, commitment)

	for i := 0; i < 60; i++ { // Wait up to 60 seconds
		resp, err := c.RPCClient.GetSignatureStatuses(c.DurableContext, false, sig)
		if err == nil && len(resp.Value) > 0 && resp.Value[0] != nil {
			status := resp.Value[0]
			
			if status.Err != nil {
				log.Printf("❌ Transaction %s failed: %v", sigStr, status.Err)
				L.Push(lua.LBool(false))
				return 1
			}

			reached := false
			current := status.ConfirmationStatus
			if current != "" {
				switch commitment {
				case rpc.CommitmentProcessed:
					reached = true // If we see it, it's at least processed
				case rpc.CommitmentConfirmed:
					if current == rpc.ConfirmationStatusConfirmed || current == rpc.ConfirmationStatusFinalized {
						reached = true
					}
				case rpc.CommitmentFinalized:
					if current == rpc.ConfirmationStatusFinalized {
						reached = true
					}
				}
			}

			if reached {
				log.Printf("✅ Transaction %s reached %s", sigStr, commitment)
				L.Push(lua.LBool(true))
				return 1
			}
		}

		time.Sleep(1 * time.Second)
	}

	log.Printf("⚠️ Timeout waiting for transaction %s", sigStr)
	L.Push(lua.LBool(false))
	return 1
}

// jupiterSwap executes a token swap using Jupiter Aggregator.
// Usage: signature = jupiterSwap(inputMint, outputMint, amount, slippageBps)
func (c *Client) jupiterSwap(L *lua.LState) int {
	inputMint := L.ToString(1)
	outputMint := L.ToString(2)
	amount := L.ToNumber(3)
	slippageBps := L.OptInt(4, 50) // Default 0.5%

	account, err := solana.PrivateKeyFromBase58(c.PrivateKey)
	if err != nil {
		L.RaiseError("invalid private key: %v", err)
		return 0
	}

	// 1. Get Decimals for inputMint
	decimals := uint8(9) // Default for SOL
	if inputMint != "So11111111111111111111111111111111111111112" {
		mintPubkey, _ := solana.PublicKeyFromBase58(inputMint)
		mintAccount, err := c.RPCClient.GetAccountInfo(c.DurableContext, mintPubkey)
		if err == nil && mintAccount != nil {
			data := mintAccount.Value.Data.GetBinary()
			if len(data) >= 45 {
				decimals = data[44]
			}
		}
	}

	amountInUnits := uint64(math.Round(float64(amount) * math.Pow10(int(decimals))))

	// If swapping SOL, ensure we leave enough for fees/rent (~0.004 SOL)
	if inputMint == "So11111111111111111111111111111111111111112" {
		balanceResult, errBal := c.RPCClient.GetBalance(c.DurableContext, account.PublicKey(), rpc.CommitmentProcessed)
		if errBal == nil {
			balance := balanceResult.Value
			estimatedFees := uint64(4500000) // 0.0045 SOL to be safe for WSOL + ATA rent + gas
			if amountInUnits+estimatedFees > balance {
				if balance > estimatedFees {
					log.Printf("⚠️ Adjusting swap amount from %d to %d to leave room for rent/fees", amountInUnits, balance-estimatedFees)
					amountInUnits = balance - estimatedFees
				} else {
					L.RaiseError("insufficient SOL balance for swap and network fees (wallet has %d, need at least %d lamports for fees alone)", balance, estimatedFees)
					return 0
				}
			}
		}
	}

	// 2. Get Quote
	quoteURL := fmt.Sprintf("https://api.jup.ag/swap/v1/quote?inputMint=%s&outputMint=%s&amount=%d&slippageBps=%d",
		inputMint, outputMint, amountInUnits, slippageBps)

	req, err := http.NewRequestWithContext(c.DurableContext, "GET", quoteURL, nil)
	if err != nil {
		L.RaiseError("failed to create quote request: %v", err)
		return 0
	}
	if c.JupiterAPIKey != "" {
		req.Header.Set("x-api-key", c.JupiterAPIKey)
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		L.RaiseError("failed to get quote from Jupiter: %v", err)
		return 0
	}
	defer resp.Body.Close()

	var quoteResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&quoteResponse); err != nil {
		L.RaiseError("failed to decode Jupiter quote: %v", err)
		return 0
	}

	if quoteResponse["errorCode"] != nil {
		L.RaiseError("Jupiter Quote Error: %v", quoteResponse["message"])
		return 0
	}

	// 3. Get Swap Transaction
	swapURL := "https://api.jup.ag/swap/v1/swap"
	swapRequest := map[string]interface{}{
		"quoteResponse":    quoteResponse,
		"userPublicKey":    account.PublicKey().String(),
		"wrapAndUnwrapSol": true,
	}

	reqBody, _ := json.Marshal(swapRequest)
	req, err = http.NewRequestWithContext(c.DurableContext, "POST", swapURL, bytes.NewBuffer(reqBody))
	if err != nil {
		L.RaiseError("failed to create swap request: %v", err)
		return 0
	}
	req.Header.Set("Content-Type", "application/json")
	if c.JupiterAPIKey != "" {
		req.Header.Set("x-api-key", c.JupiterAPIKey)
	}

	resp, err = httpClient.Do(req)
	if err != nil {
		L.RaiseError("failed to get swap transaction: %v", err)
		return 0
	}
	defer resp.Body.Close()

	var swapResponse struct {
		SwapTransaction string `json:"swapTransaction"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&swapResponse); err != nil {
		L.RaiseError("failed to decode Jupiter swap response: %v", err)
		return 0
	}

	// 4. Deserialize, Sign, and Send
	txData, err := solana.TransactionFromBase64(swapResponse.SwapTransaction)
	if err != nil {
		L.RaiseError("failed to deserialize swap transaction: %v", err)
		return 0
	}

	// Sign the transaction
	_, err = txData.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(account.PublicKey()) {
			return &account
		}
		return nil
	})
	if err != nil {
		L.RaiseError("failed to sign swap transaction: %v", err)
		return 0
	}

	// Send the transaction
	sig, err := c.RPCClient.SendTransaction(c.DurableContext, txData)
	if err != nil {
		L.RaiseError("failed to send swap transaction: %v", err)
		return 0
	}

	// Wait for finalization
	log.Printf("⏳ Waiting for swap transaction %s to be finalized...", sig.String())
	finalized := false
	for i := 0; i < 60; i++ {
		status, err := c.RPCClient.GetSignatureStatuses(c.DurableContext, false, sig)
		if err == nil && len(status.Value) > 0 && status.Value[0] != nil {
			if status.Value[0].Err != nil {
				L.RaiseError("swap transaction failed: %v", status.Value[0].Err)
				return 0
			}
			if status.Value[0].ConfirmationStatus == rpc.ConfirmationStatusFinalized {
				finalized = true
				break
			}
		}
		time.Sleep(1 * time.Second)
	}

	if !finalized {
		log.Printf("⚠️ Swap transaction %s did not reach finalized status in 60s", sig.String())
	} else {
		log.Printf("✅ Swap transaction %s finalized!", sig.String())
	}

	L.SetGlobal("tx_hash", lua.LString(sig.String()))
	L.Push(lua.LString(sig.String()))
	return 1
}
