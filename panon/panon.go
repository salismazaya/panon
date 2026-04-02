package panon

import (
	"context"
	"log"
	"math"
	"strings"
	"time"

	"github.com/gagliardetto/solana-go"
	associatedtokenaccount "github.com/gagliardetto/solana-go/programs/associated-token-account"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
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
	RPCClient  *rpc.Client
	PrivateKey string
}

// New creates a new panon Client.
func New(rpcClient *rpc.Client, privateKey string) *Client {
	return &Client{
		RPCClient:  rpcClient,
		PrivateKey: privateKey,
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

	latestBlockhash, err := c.RPCClient.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
		context.Background(),
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

	amountLamports := uint64(amount * 1e9)
	time.Sleep(1 * time.Second)

	recentBlockhash, err := c.ensureValidBlockhash(L)
	if err != nil {
		L.RaiseError("%s", "failed to get blockhash: "+err.Error())
		return 0
	}

	tx, err := solana.NewTransaction(
		[]solana.Instruction{
			system.NewTransferInstruction(
				amountLamports,
				account.PublicKey(),
				toPubkey,
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

	var sig solana.Signature
	for i := 0; i < 3; i++ {
		sig, err = client.SendTransaction(context.Background(), tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "prior credit") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [transferSol] Account not ready, insufficient funds, or stale blockhash (Attempt %d/3), retrying in 2s...", i+1)
			time.Sleep(2 * time.Second)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 3 attempts: %v", err)
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

		amountLamports := uint64(amount * 1e9)
		time.Sleep(1 * time.Second)

		recentBlockhash, err := c.ensureValidBlockhash(L)
		if err != nil {
			L.RaiseError("failed to get blockhash: %v", err)
			return 0
		}

		tx, err := solana.NewTransaction(
			[]solana.Instruction{
				system.NewTransferInstruction(
					amountLamports,
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

		var signature solana.Signature
		for i := 0; i < 3; i++ {
			signature, err = client.SendTransaction(context.Background(), tx)
			if err == nil {
				L.Push(lua.LString(signature.String()))
				return 1
			}

			errStr := err.Error()
			if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "prior credit") || strings.Contains(errStr, "Blockhash") {
				log.Printf("⚠️ [transfer] SOL account not ready, insufficient funds, or stale blockhash (Attempt %d/3), retrying in 2s...", i+1)
				time.Sleep(2 * time.Second)
				if i < 2 {
					latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
			L.RaiseError("failed to send transaction: %v", err)
			return 0
		}

		L.RaiseError("failed to send transaction after 3 attempts: %v", err)
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
	mintAccount, err := client.GetAccountInfo(context.Background(), tokenMintPubkey)
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
	_, err = client.GetAccountInfo(context.Background(), toATA)
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
	for i := 0; i < 3; i++ {
		sig, err = client.SendTransaction(context.Background(), tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		if strings.Contains(err.Error(), "insufficient funds") || strings.Contains(err.Error(), "0x1") || strings.Contains(err.Error(), "Blockhash") {
			log.Printf("⚠️ Insufficient funds or stale blockhash detected for %s transfer (Attempt %d/3), retrying in 2s...", tokenMint, i+1)
			time.Sleep(2 * time.Second)
			// Re-fetch blockhash if it's potentially stale (minor optimization)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 3 attempts: %v", err)
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
	mintAccount, err := client.GetAccountInfo(context.Background(), tokenMintPubkey)
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

	accountInfo, err := client.GetTokenAccountBalance(context.Background(), ata, rpc.CommitmentFinalized)
	if err != nil {
		L.RaiseError("%s", "failed to get token balance: "+err.Error())
		return 0
	}

	L.Push(lua.LString(accountInfo.Value.Amount))
	L.Push(lua.LString(accountInfo.Value.Decimals))
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
	mintAccount, err := client.GetAccountInfo(context.Background(), tokenMintPubkey)
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
	_, err = client.GetAccountInfo(context.Background(), toATA)
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
	for i := 0; i < 3; i++ {
		sig, err = client.SendTransaction(context.Background(), tx)
		if err == nil {
			L.Push(lua.LString(sig.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "AccountNotFound") || strings.Contains(errStr, "prior credit") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [transferToken] Account not ready, insufficient funds, or stale blockhash for %s (Attempt %d/3), retrying in 2s...", tokenMint, i+1)
			time.Sleep(2 * time.Second)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
		L.RaiseError("failed to send transaction: %v", err)
		return 0
	}

	L.RaiseError("failed to send transaction after 3 attempts: %v", err)
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
		signature, err = client.SendTransaction(context.Background(), tx)
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
				latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
		signature, err = client.SendTransaction(context.Background(), tx)
		if err == nil {
			L.Push(lua.LString(signature.String()))
			return 1
		}

		errStr := err.Error()
		if strings.Contains(errStr, "insufficient funds") || strings.Contains(errStr, "0x1") || strings.Contains(errStr, "Blockhash") {
			log.Printf("⚠️ [mintTokens] Stale blockhash or insufficient funds (Attempt %d/3), retrying in 2s...", i+1)
			time.Sleep(2 * time.Second)
			if i < 2 {
				latestBlockhash, errHash := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
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
