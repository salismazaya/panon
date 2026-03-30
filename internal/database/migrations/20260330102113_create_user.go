package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/salismazaya/panon/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func init() {
	List = append(List, &gormigrate.Migration{
		ID: "20260330102113_create_user",
		Migrate: func(tx *gorm.DB) error {
			tx.AutoMigrate(&models.User{})

			// hash password
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte("1234"), bcrypt.DefaultCost)
			if err != nil {
				return err
			}

			// create user
			user := models.User{
				Username: "panon",
				Password: string(hashedPassword),
			}

			tx.Create(&user)

			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			tx.Migrator().DropTable(&models.User{})
			return nil
		},
	})
}
