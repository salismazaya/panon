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

type Executor func(workspace models.Workspace, input models.ExecutorInput)

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

func (l *Listener) RegisterWorkspace(workspace models.Workspace, executor func(models.Workspace, models.ExecutorInput)) error {
	pk, err := solana.PrivateKeyFromBase58(workspace.Wallet.GetPrivateKey())
	if err != nil {
		return err
	}
	pubkey := pk.PublicKey()

	sub, err := l.wsClient.LogsSubscribeMentions(
		pubkey,
		rpc.CommitmentFinalized,
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
				Commitment: rpc.CommitmentFinalized,
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

		executor(workspace, models.ExecutorInput{
			Signature:   sig.String(),
			SolAmountIn: amountSOL,
			Signer:      sender,
		})
	}
}
