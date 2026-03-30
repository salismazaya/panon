package models

import (
	"errors"

	"gorm.io/gorm"
)

type Network string

const (
	NetworkMainnet Network = "mainnet"
	NetworkDevnet  Network = "devnet"
)

func (n Network) IsValid() bool {
	return n == NetworkMainnet || n == NetworkDevnet
}

type Workspace struct {
	gorm.Model
	Name      string
	WalletID  uint
	Wallet    Wallet  `gorm:"foreignKey:WalletID"`
	FlowState string  `gorm:"type:text"`
	Network   Network `gorm:"default:'mainnet'"`
}

func (w *Workspace) BeforeSave(tx *gorm.DB) error {
	if w.Network == "" {
		w.Network = NetworkMainnet
	}
	if !w.Network.IsValid() {
		return errors.New("network must be 'mainnet' or 'devnet'")
	}
	return nil
}
