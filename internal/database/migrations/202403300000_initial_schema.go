package migrations

import (
	"log"

	"github.com/gagliardetto/solana-go"
	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/salismazaya/panon/internal/helpers"
	"github.com/salismazaya/panon/internal/models"
	"gorm.io/gorm"
)

func init() {
	List = append(List, &gormigrate.Migration{
		ID: "202403300000_initial_schema",
		Migrate: func(tx *gorm.DB) error {
			// 1. Create tables
			if err := tx.AutoMigrate(&models.Wallet{}, &models.Workspace{}); err != nil {
				return err
			}

			// 2. Seed default workspace if none exists
			var count int64
			if err := tx.Model(&models.Workspace{}).Count(&count).Error; err != nil {
				return err
			}

			if count == 0 {
				privKey := solana.NewWallet().PrivateKey.String()
				encryptedPrivKey, err := helpers.Encrypt(privKey)
				if err != nil {
					return err
				}

				wallet := &models.Wallet{EncryptedPrivateKey: encryptedPrivKey}
				if err := tx.Create(wallet).Error; err != nil {
					return err
				}

				workspace := &models.Workspace{
					Name:     "Default Workspace",
					Wallet:   *wallet,
					WalletID: wallet.ID,
				}
				if err := tx.Create(workspace).Error; err != nil {
					return err
				}
				log.Println("✨ Created fresh Default Workspace during migration")
			}
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			// Drop tables on rollback
			return tx.Migrator().DropTable(&models.Workspace{}, &models.Wallet{})
		},
	})
}
