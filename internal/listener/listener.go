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
	"github.com/salismazaya/panon/internal/models"
)

type Executor func(input models.ExecutorInput)

type Config struct {
	RpcUrl string
	WSUrl  string
}

type Listener struct {
	config              Config
	rpcClient           *rpc.Client
	wsClient            *ws.Client
	mu                  sync.RWMutex
	subscriptions       map[uint]*ws.LogSubscription
	processedSignatures map[string]bool
}

func New(config Config) (*Listener, error) {
	wsClient, err := ws.Connect(context.Background(), config.WSUrl)
	if err != nil {
		return nil, errors.New("failed connect to ws")
	}

	rpcClient := rpc.New(config.RpcUrl)

	return &Listener{
		config:              config,
		wsClient:            wsClient,
		rpcClient:           rpcClient,
		subscriptions:       make(map[uint]*ws.LogSubscription),
		processedSignatures: make(map[string]bool),
	}, nil
}

func (l *Listener) UnregisterWorkspace(workspaceID uint) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	sub, ok := l.subscriptions[workspaceID]
	if !ok {
		return nil
	}

	sub.Unsubscribe()
	delete(l.subscriptions, workspaceID)
	log.Printf("🔌 Unregistered workspace %d from listener", workspaceID)
	return nil
}

func (l *Listener) RegisterWorkspace(workspace models.Workspace, executor func(models.ExecutorInput)) error {
	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}
	pubkey := pk.PublicKey()

	sub, err := l.wsClient.LogsSubscribeMentions(
		pubkey,
		rpc.CommitmentConfirmed,
	)

	if err != nil {
		return errors.New("failed to subscribe to logs")
	}

	l.mu.Lock()
	l.subscriptions[workspace.ID] = sub
	l.mu.Unlock()

	go func() {
		for {
			got, err := sub.Recv(context.Background())
			if err != nil {
				log.Printf("Subscription error for workspace %d: %v", workspace.ID, err)
				time.Sleep(1 * time.Second)
				continue
			}
			if got == nil {
				log.Printf("Subscription closed for workspace %d, reconnecting...", workspace.ID)
				
				newSub, err := l.wsClient.LogsSubscribeMentions(
					pubkey,
					rpc.CommitmentConfirmed,
				)
				if err != nil {
					log.Printf("Re-subscription error for workspace %d: %v", workspace.ID, err)
					time.Sleep(1 * time.Second)
					continue
				}

				// Sync the internal state
				l.mu.Lock()
				l.subscriptions[workspace.ID] = newSub
				l.mu.Unlock()

				sub = newSub
				continue
			}
			l.processTransaction(got.Value.Signature, workspace, executor)
		}
	}()

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

func (l *Listener) processTransaction(sig solana.Signature, workspace models.Workspace, executor Executor) {
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
			context.Background(),
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

		executor(models.ExecutorInput{
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

func (ml *MultiListener) RegisterWorkspace(workspace models.Workspace, executor func(models.ExecutorInput)) error {
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
