package listener

import (
	"context"
	"errors"
	"log"
	"math/rand"
	"regexp"
	"sync"
	"time"

	bin "github.com/gagliardetto/binary"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"github.com/salismazaya/panon/internal/models"
	"golang.org/x/time/rate"
)

var tokenAddrRegex = regexp.MustCompile(`on_token_([1-9A-HJ-NP-Za-km-z]{32,44})_received`)

type Config struct {
	RpcUrl string
	WSUrl  string
}

type Listener struct {
	config                     Config
	rpcClient                  *rpc.Client
	wsClient                   *ws.Client
	mu                         sync.RWMutex
	lastWSReconnect            time.Time
	reconnectDelay             time.Duration
	subscriptions              map[solana.PublicKey]chan struct{}
	workspaceSubscribedPubkeys map[uint][]solana.PublicKey
	processedSignatures        map[string]bool
	limiter                    *rate.Limiter
}

func New(config Config) (*Listener, error) {
	wsClient, err := ws.Connect(context.Background(), config.WSUrl)
	if err != nil {
		return nil, errors.New("failed connect to ws")
	}

	rpcClient := rpc.New(config.RpcUrl)

	listener := &Listener{
		config:                     config,
		wsClient:                   wsClient,
		rpcClient:                  rpcClient,
		reconnectDelay:             2 * time.Second,
		subscriptions:              make(map[solana.PublicKey]chan struct{}),
		workspaceSubscribedPubkeys: make(map[uint][]solana.PublicKey),
		processedSignatures:        make(map[string]bool),
		limiter:                    rate.NewLimiter(5, 5),
	}

	return listener, nil
}

func (l *Listener) RegisterWorkspace(workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) error {
	// 1. Bersihkan listener lama untuk workspace ini jika ada
	l.UnregisterWorkspace(workspace.ID)

	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}
	pubkey := pk.PublicKey()

	// 2. Setup Monitor SOL
	var lastLamports uint64
	account, err := l.rpcClient.GetAccountInfo(context.Background(), pubkey)
	if err == nil && account != nil {
		lastLamports = account.Value.Lamports
	}

	l.ListenPubKey(pubkey, func(ctx context.Context, got *ws.AccountResult) {
		if got == nil || got.Value == nil {
			return
		}
		newLamports := got.Value.Lamports
		if newLamports > lastLamports {
			l.processSOLChange(ctx, lastLamports, newLamports, pubkey, workspace, executor)
		}
		lastLamports = newLamports
	})

	l.mu.Lock()
	l.workspaceSubscribedPubkeys[workspace.ID] = append(l.workspaceSubscribedPubkeys[workspace.ID], pubkey)
	l.mu.Unlock()

	// 3. Setup Monitor Token-token yang didaftarkan di Lua
	tokenMatches := tokenAddrRegex.FindAllStringSubmatch(workspace.FlowState, -1)
	for _, match := range tokenMatches {
		mint := solana.MustPublicKeyFromBase58(match[1])
		l.registerTokenMonitor(context.Background(), workspace, pubkey, mint, executor)
	}

	return nil
}

func (l *Listener) registerTokenMonitor(ctx context.Context, workspace models.Workspace, walletPubkey solana.PublicKey, mint solana.PublicKey, executor func(context.Context, models.ExecutorInput)) {
	// Identifikasi Program ID (Token atau Token-2022)
	tokenProgram := solana.TokenProgramID
	mintAccount, _ := l.rpcClient.GetAccountInfo(ctx, mint)
	if mintAccount != nil && mintAccount.Value.Owner.String() == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" {
		tokenProgram = solana.MustPublicKeyFromBase58("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
	}

	// ATA seeds: [wallet, token_program, mint]
	ata, _, _ := solana.FindProgramAddress(
		[][]byte{
			walletPubkey.Bytes(),
			tokenProgram.Bytes(),
			mint.Bytes(),
		},
		solana.SPLAssociatedTokenAccountProgramID,
	)

	l.mu.Lock()
	l.workspaceSubscribedPubkeys[workspace.ID] = append(l.workspaceSubscribedPubkeys[workspace.ID], ata)
	l.mu.Unlock()

	var lastAmount uint64
	account, err := l.rpcClient.GetAccountInfo(ctx, ata)
	if err == nil && account != nil {
		var tokenAccount token.Account
		if err := tokenAccount.UnmarshalWithDecoder(bin.NewBinDecoder(account.Value.Data.GetBinary())); err == nil {
			lastAmount = tokenAccount.Amount
		}
	}

	l.ListenPubKey(ata, func(ctx context.Context, res *ws.AccountResult) {
		if res == nil || res.Value == nil {
			return
		}

		var tokenAccount token.Account
		if err := tokenAccount.UnmarshalWithDecoder(bin.NewBinDecoder(res.Value.Data.GetBinary())); err != nil {
			return
		}

		newAmount := tokenAccount.Amount
		if newAmount > lastAmount {
			l.processTokenChange(ctx, lastAmount, newAmount, ata, mint, workspace, executor)
		}
		lastAmount = newAmount
	})

	log.Printf("📥 Registered token monitor for workspace %s, Mint: %s, ATA: %s", workspace.Name, mint, ata)
}

func (l *Listener) processTokenChange(ctx context.Context, pre uint64, post uint64, ata solana.PublicKey, mint solana.PublicKey, workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) {
	// Berikan waktu sedikit agar indexer RPC sempat mencatat signature-nya
	time.Sleep(2 * time.Second)

	sigs, err := l.rpcClient.GetSignaturesForAddressWithOpts(
		ctx,
		ata,
		&rpc.GetSignaturesForAddressOpts{
			Limit:      pointer(1),
			Commitment: rpc.CommitmentConfirmed,
		},
	)

	if err != nil || len(sigs) == 0 {
		return
	}

	sig := sigs[0].Signature

	// Cek duplikasi signature
	l.mu.Lock()
	if l.processedSignatures[sig.String()] {
		l.mu.Unlock()
		return
	}
	l.processedSignatures[sig.String()] = true
	l.mu.Unlock()

	// Fetch transaction untuk mendapatkan sender
	tx, err := l.rpcClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{Commitment: rpc.CommitmentConfirmed, Encoding: solana.EncodingBase64})
	if err != nil || tx == nil || tx.Meta == nil {
		return
	}

	parsedTx, err := tx.Transaction.GetTransaction()
	if err != nil {
		return
	}

	sender := "unknown"
	if len(parsedTx.Message.AccountKeys) > 0 {
		sender = parsedTx.Message.AccountKeys[0].String()
	}

	// Fetch decimals
	decimals := uint8(9) // default
	mintAccount, err := l.rpcClient.GetAccountInfo(ctx, mint)
	if err == nil && mintAccount != nil {
		mintData := mintAccount.Value.Data.GetBinary()
		if len(mintData) >= 45 {
			decimals = mintData[44]
		}
	}

	uiAmount := float64(post-pre) / math_Pow10(int(decimals))

	log.Printf("🪙 Detected Token Inbound: %.6f of %s", uiAmount, mint)

	executor(ctx, models.ExecutorInput{
		Workspace:     workspace,
		Signature:     sig.String(),
		TokenAmountIn: uiAmount,
		TokenMint:     mint.String(),
		Signer:        sender,
	})
}

func math_Pow10(n int) float64 {
	res := 1.0
	for i := 0; i < n; i++ {
		res *= 10
	}
	return res
}

func (l *Listener) UnregisterWorkspace(workspaceID uint) error {
	l.mu.Lock()
	pubkeys, ok := l.workspaceSubscribedPubkeys[workspaceID]
	if !ok {
		l.mu.Unlock()
		return nil
	}

	log.Printf("🔌 Unregistering workspace %d, disconnecting %d accounts...", workspaceID, len(pubkeys))
	for _, pk := range pubkeys {
		channel, ok := l.subscriptions[pk]
		if ok {
			close(channel)
			delete(l.subscriptions, pk)
		}
	}
	delete(l.workspaceSubscribedPubkeys, workspaceID)
	l.mu.Unlock()

	return nil
}

func (l *Listener) ListenPubKey(pubkey solana.PublicKey, callback func(context.Context, *ws.AccountResult)) {
	l.mu.Lock()
	_, ok := l.subscriptions[pubkey]

	if !ok {
		l.subscriptions[pubkey] = make(chan struct{})
	} else {
		l.mu.Unlock()
		return
	}
	done := l.subscriptions[pubkey]
	l.mu.Unlock()

	go func() {
		ctx, cancel := context.WithCancel(context.Background())

		// Menunggu sinyal disconnect
		go func() {
			<-done
			cancel()
		}()

		var sub *ws.AccountSubscription
		var err error

		for {
			// Pengecekan apakah context sudah dibatalkan
			select {
			case <-ctx.Done():
				if sub != nil {
					go sub.Unsubscribe()
				}
				return
			default:
			}

			if sub == nil {
				l.mu.RLock()
				wsClient := l.wsClient
				l.mu.RUnlock()

				sub, err = wsClient.AccountSubscribe(
					pubkey,
					rpc.CommitmentConfirmed,
				)
				if err != nil {
					log.Printf("Subscription error for %s: %v", pubkey, err)
					l.ensureWSConnection(ctx, pubkey.String())
					time.Sleep(2 * time.Second)
					continue
				}
			}

			// Menggunakan timeout 2 menit untuk mendeteksi koneksi "hang" (idle)
			recvCtx, cancelRecv := context.WithTimeout(ctx, 2*time.Minute)
			got, err := sub.Recv(recvCtx)
			cancelRecv()

			if err != nil {
				if ctx.Err() != nil {
					return
				}

				log.Printf("Subscription receive error for %s: %v, reconnecting...", pubkey, err)
				if sub != nil {
					go sub.Unsubscribe()
				}
				sub = nil

				l.ensureWSConnection(ctx, pubkey.String())
				time.Sleep(1 * time.Second)
				continue
			}

			if got == nil {
				log.Printf("Subscription closed for %s, reconnecting...", pubkey)
				if sub != nil {
					go sub.Unsubscribe()
				}
				sub = nil
				l.ensureWSConnection(ctx, pubkey.String())
				time.Sleep(1 * time.Second)
				continue
			}

			go callback(ctx, got)
		}
	}()
}

func (l *Listener) DisconnectPubKey(pubkey solana.PublicKey) {
	l.mu.Lock()
	channel, ok := l.subscriptions[pubkey]
	if ok {
		close(channel)
		delete(l.subscriptions, pubkey)
	}
	l.mu.Unlock()
}

func (l *Listener) ensureWSConnection(ctx context.Context, source string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if time.Since(l.lastWSReconnect) < l.reconnectDelay {
		return
	}

	log.Printf("Reconnecting main WebSocket client (triggered by %s). Current backoff: %v...", source, l.reconnectDelay)

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	newWS, err := ws.Connect(connectCtx, l.config.WSUrl)
	if err != nil {
		log.Printf("Failed to reconnect main WebSocket (triggered by %s): %v", source, err)
		l.reconnectDelay *= 2
		if l.reconnectDelay > 60*time.Second {
			l.reconnectDelay = 60 * time.Second
		}
		jitter := time.Duration(rand.Int63n(int64(l.reconnectDelay / 10)))
		l.reconnectDelay += jitter
		l.lastWSReconnect = time.Now()
		return
	}

	oldWS := l.wsClient
	l.wsClient = newWS
	l.lastWSReconnect = time.Now()
	l.reconnectDelay = 2 * time.Second

	if oldWS != nil {
		go oldWS.Close()
	}
	log.Printf("Main WebSocket client reconnected successfully (triggered by %s)", source)
}

func (l *Listener) ClearSignatures() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.processedSignatures = make(map[string]bool)
}

func (l *Listener) GetRPCURL(_ models.Network) string {
	return l.config.RpcUrl
}

func (l *Listener) GetRPCClient() *rpc.Client {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.rpcClient
}

func (l *Listener) processSOLChange(ctx context.Context, preLamports, postLamports uint64, myPubkey solana.PublicKey, workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) {
	sigs, err := l.rpcClient.GetSignaturesForAddressWithOpts(
		ctx,
		myPubkey,
		&rpc.GetSignaturesForAddressOpts{
			Limit:      pointer(1),
			Commitment: rpc.CommitmentConfirmed,
		},
	)
	if err != nil || len(sigs) == 0 {
		return
	}

	sig := sigs[0].Signature
	l.processTransactionBySignature(ctx, sig, workspace, executor)
}

func (l *Listener) processTransactionBySignature(ctx context.Context, sig solana.Signature, workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) {
	l.mu.Lock()
	if l.processedSignatures[sig.String()] {
		l.mu.Unlock()
		return
	}
	l.processedSignatures[sig.String()] = true
	l.mu.Unlock()

	var tx *rpc.GetTransactionResult
	var err error
	for i := 0; i < 3; i++ {
		if err := l.limiter.Wait(ctx); err != nil {
			return
		}
		tx, err = l.rpcClient.GetTransaction(
			ctx,
			sig,
			&rpc.GetTransactionOpts{
				Commitment: rpc.CommitmentConfirmed,
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

	parsedTx, err := tx.Transaction.GetTransaction()
	if err != nil {
		return
	}

	pk, _ := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	myPubkey := pk.PublicKey()

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
		sender := accountKeys[0].String()

		log.Printf("💰 Detected Inbound Transaction for workspace %s!", workspace.Name)
		log.Printf("   Amount: %f SOL", amountSOL)
		log.Printf("   Sender: %s", sender)
		log.Printf("   Signature: %s", sig)

		executor(ctx, models.ExecutorInput{
			Signature:   sig.String(),
			SolAmountIn: amountSOL,
			Signer:      sender,
			Workspace:   workspace,
		})
	}
}

type MultiListener struct {
	listeners map[models.Network]*Listener
}

func NewMulti(mainnetConfig Config, devnetConfig Config) (*MultiListener, error) {
	mainnet, err := New(mainnetConfig)
	if err != nil {
		return nil, err
	}

	devnet, err := New(devnetConfig)
	if err != nil {
		return nil, err
	}

	return &MultiListener{
		listeners: map[models.Network]*Listener{
			models.NetworkMainnet: mainnet,
			models.NetworkDevnet:  devnet,
		},
	}, nil
}

func (ml *MultiListener) RegisterWorkspace(workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) error {
	l, ok := ml.listeners[workspace.Network]
	if !ok {
		return errors.New("unsupported network: " + string(workspace.Network))
	}
	return l.RegisterWorkspace(workspace, executor)
}

func (ml *MultiListener) ClearSignatures() {
	for _, l := range ml.listeners {
		l.ClearSignatures()
	}
}

func (ml *MultiListener) UnregisterWorkspace(workspaceID uint) error {
	for _, l := range ml.listeners {
		if err := l.UnregisterWorkspace(workspaceID); err != nil {
			return err
		}
	}
	return nil
}

func (ml *MultiListener) GetRPCURL(network models.Network) string {
	if l, ok := ml.listeners[network]; ok {
		return l.config.RpcUrl
	}
	return ""
}

func (ml *MultiListener) GetRPCClient(network models.Network) *rpc.Client {
	if l, ok := ml.listeners[network]; ok {
		return l.rpcClient
	}
	return nil
}

func (ml *MultiListener) ListenPubKey(network models.Network, pubkey solana.PublicKey, callback func(context.Context, *ws.AccountResult)) error {
	l, ok := ml.listeners[network]
	if !ok {
		return errors.New("unsupported network: " + string(network))
	}
	l.ListenPubKey(pubkey, callback)
	return nil
}

func (ml *MultiListener) DisconnectPubKey(pubkey solana.PublicKey) {
	for _, l := range ml.listeners {
		l.DisconnectPubKey(pubkey)
	}
}

func pointer[T any](v T) *T {
	return &v
}
