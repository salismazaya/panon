package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/salismazaya/panon/internal/models"
	"gorm.io/gorm"
)

func init() {
	List = append(List, &gormigrate.Migration{
		ID: "20260330144012_workspace_network",
		Migrate: func(tx *gorm.DB) error {
			if !tx.Migrator().HasColumn(&models.Workspace{}, "network") {
				tx.Migrator().AddColumn(&models.Workspace{}, "Network")
			}
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			if tx.Migrator().HasColumn(&models.Workspace{}, "_network_recyle") {
				tx.Migrator().DropColumn(&models.Workspace{}, "_network_recyle")
			}
			tx.Migrator().RenameColumn(&models.Workspace{}, "network", "_network_recyle")
			return nil
		},
	})
}
