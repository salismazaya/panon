package wallet

import (
	"encoding/json"
	"log"
	"os"

	"github.com/gagliardetto/solana-go"
)

// WalletData represents a Solana wallet keypair.
type WalletData struct {
	PrivateKey string `json:"privateKey"`
	Address    string `json:"address"`
}

// Manager handles wallet generation and retrieval.
type Manager struct {
	walletFile   string
	defaultKey   string
	defaultAddr  string
	sessionID    string
}

// NewManager creates a new wallet manager.
func NewManager(walletFile string) *Manager {
	return &Manager{
		walletFile: walletFile,
	}
}

// Initialize loads or generates the default wallet.
func (m *Manager) Initialize() {
	var wallet WalletData

	if data, err := os.ReadFile(m.walletFile); err == nil {
		if err := json.Unmarshal(data, &wallet); err == nil {
			m.defaultAddr = wallet.Address
			m.defaultKey = wallet.PrivateKey

			log.Printf("Loaded existing Solana wallet from %s:", m.walletFile)
			log.Printf("  Address: %s", wallet.Address)
			return
		}
	}

	pk, err := solana.NewRandomPrivateKey()
	if err != nil {
		log.Fatalf("Failed to generate private key: %v", err)
	}

	newPrivateKey := pk.String()
	newAddress := pk.PublicKey().String()

	wallet = WalletData{
		PrivateKey: newPrivateKey,
		Address:    newAddress,
	}

	data, _ := json.MarshalIndent(wallet, "", "  ")
	if err := os.WriteFile(m.walletFile, data, 0644); err != nil {
		log.Printf("Warning: Failed to save wallet.json: %v", err)
	}

	m.sessionID = "default_session"
	m.defaultAddr = newAddress
	m.defaultKey = newPrivateKey

	log.Printf("Generated new default Solana wallet and saved to %s:", m.walletFile)
	log.Printf("  Address: %s", newAddress)
	log.Printf("  Private Key: %s", newPrivateKey)
}

// GetDefaultAddress returns the default wallet address.
func (m *Manager) GetDefaultAddress() string {
	return m.defaultAddr
}

// GetDefaultPrivateKey returns the default private key.
func (m *Manager) GetDefaultPrivateKey() string {
	return m.defaultKey
}

// GetSessionID returns the default session ID.
func (m *Manager) GetSessionID() string {
	return m.sessionID
}
