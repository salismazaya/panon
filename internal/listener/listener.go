package listener

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/models"
	"golang.org/x/time/rate"
)

type Executor func(ctx context.Context, input models.ExecutorInput)

type Config struct {
	RpcUrl string
	WSUrl  string
}

type Listener struct {
	config              Config
	rpcClient           *rpc.Client
	wsClient            *ws.Client
	mu                  sync.RWMutex
	lastWSReconnect     time.Time
	subscriptions       map[solana.PublicKey]chan struct{}
	processedSignatures map[string]bool
	limiter             *rate.Limiter
}

func New(config Config) (*Listener, error) {
	wsClient, err := ws.Connect(context.Background(), config.WSUrl)
	if err != nil {
		return nil, errors.New("failed connect to ws")
	}

	rpcClient := rpc.New(config.RpcUrl)

	listener := &Listener{
		config:              config,
		wsClient:            wsClient,
		rpcClient:           rpcClient,
		subscriptions:       make(map[solana.PublicKey]chan struct{}),
		processedSignatures: make(map[string]bool),
		limiter:             rate.NewLimiter(5, 5),
	}

	return listener, nil
}

func (l *Listener) UnregisterWorkspace(workspaceID uint) error {
	var workspace models.Workspace

	db := database.GetDatabase()

	db.Preload("Wallet").First(&workspace, workspaceID)

	account, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}

	pubkey := account.PublicKey()

	l.DisconnectPubKey(pubkey)

	log.Printf("🔌 Unregistered workspace %d from listener", workspaceID)
	return nil
}

func (l *Listener) ListenPubKey(pubkey solana.PublicKey, callback func(context.Context, *solana.Signature)) {
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

		var sub *ws.LogSubscription
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

				sub, err = wsClient.LogsSubscribeMentions(
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
			// Jika dalam 2 menit tidak ada data sama sekali, kita anggap koneksi bermasalah.
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
				
				// Langsung pemicu re-koneksi client utama tanpa menunggu iterasi berikutnya
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

			go callback(ctx, &got.Value.Signature)
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

// ensureWSConnection mendeteksi dan mencoba memperbaiki koneksi WebSocket utama jika diperlukan.
// Hanya satu goroutine yang bisa melakukan re-koneksi dalam rentang waktu tertentu.
func (l *Listener) ensureWSConnection(ctx context.Context, source string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Jangan re-connect terlalu sering (minimal jeda 5 detik antar percobaan global)
	if time.Since(l.lastWSReconnect) < 5*time.Second {
		return
	}

	log.Printf("Reconnecting main WebSocket client (triggered by %s)...", source)
	
	// Gunakan timeout 10 detik untuk proses koneksi agar tidak hang
	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	newWS, err := ws.Connect(connectCtx, l.config.WSUrl)
	if err != nil {
		log.Printf("Failed to reconnect main WebSocket (triggered by %s): %v", source, err)
		l.lastWSReconnect = time.Now() // Tetap update agar tidak spamming
		return
	}

	oldWS := l.wsClient
	l.wsClient = newWS
	l.lastWSReconnect = time.Now()

	// Tutup yang lama secara asynchronous agar tidak blocking
	if oldWS != nil {
		go oldWS.Close()
	}
	log.Printf("Main WebSocket client reconnected successfully (triggered by %s)", source)
}

func (l *Listener) RegisterWorkspace(workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) error {
	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}
	pubkey := pk.PublicKey()

	l.ListenPubKey(pubkey, func(ctx context.Context, sig *solana.Signature) {
		l.processTransaction(ctx, *sig, workspace, executor)
	})

	return nil
}

// ClearSignatures clears the processed signatures cache.
func (l *Listener) ClearSignatures() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.processedSignatures = make(map[string]bool)
}

func (l *Listener) GetRPCURL(_ models.Network) string {
	return l.config.RpcUrl
}

func (l *Listener) GetRPCClient() *rpc.Client {
	return l.rpcClient
}

func (l *Listener) processTransaction(ctx context.Context, sig solana.Signature, workspace models.Workspace, executor Executor) {
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

	if err := l.limiter.Wait(ctx); err != nil {
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

func (ml *MultiListener) ListenPubKey(network models.Network, pubkey solana.PublicKey, callback func(context.Context, *solana.Signature)) error {
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
