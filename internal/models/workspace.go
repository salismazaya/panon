package models

import (
	"gorm.io/gorm"
)

type Workspace struct {
	gorm.Model
	Name      string
	WalletID  uint
	Wallet    Wallet `gorm:"foreignKey:WalletID"`
	FlowState string `gorm:"type:text"`
}
