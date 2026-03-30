package models

import (
	"github.com/salismazaya/panon/internal/helpers"
	"gorm.io/gorm"
)

type Wallet struct {
	gorm.Model
	EncryptedPrivateKey string
}

func (w *Wallet) GetPrivateKey() string {
	privateKey, err := helpers.Decrypt(w.EncryptedPrivateKey)

	if err != nil {
		// tidak di-encrypt
		return w.EncryptedPrivateKey
	}

	return privateKey
}
