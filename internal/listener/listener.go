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
	subscriptions       map[solana.PublicKey]chan struct{}
	processedSignatures map[string]bool
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
			if sub == nil {
				sub, err = l.wsClient.LogsSubscribeMentions(
					pubkey,
					rpc.CommitmentConfirmed,
				)
				if err != nil {
					log.Printf("Subscription error: %s", pubkey)
					select {
					case <-ctx.Done():
						return
					case <-time.After(1 * time.Second):
						continue
					}
				}
			}

			got, err := sub.Recv(ctx)
			if err != nil {
				if ctx.Err() != nil {
					// DisconnectPubkey dipanggil sehingga context menjadi Done()
					if sub != nil {
						sub.Unsubscribe()
					}
					return
				}

				log.Printf("Subscription receive error: %s, reconnecting...", pubkey)
				if sub != nil {
					sub.Unsubscribe()
				}
				sub = nil
				time.Sleep(1 * time.Second)
				continue
			}

			if got == nil {
				log.Printf("Subscription closed %s, reconnecting...", pubkey)
				if sub != nil {
					sub.Unsubscribe()
				}
				sub = nil
				time.Sleep(1 * time.Second)
				continue
			}

			callback(ctx, &got.Value.Signature)
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

func (l *Listener) RegisterWorkspace(workspace models.Workspace, executor func(context.Context, models.ExecutorInput)) error {
	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}
	pubkey := pk.PublicKey()

	l.ListenPubKey(pubkey, func(ctx context.Context, sig *solana.Signature) {
		l.processTransaction(ctx, *sig, workspace, executor)
	})

	log.Printf("WORKSPACE REGISTER")

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
