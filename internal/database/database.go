package database

import (
	"sync"

	"github.com/salismazaya/panon/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func migrateDatabase(db *gorm.DB) {
	db.AutoMigrate(&models.Workspace{}, &models.Wallet{})
}

var once sync.Once

func GetDatabase() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("database.db"))

	if err != nil {
		panic("Connection to database error: " + err.Error())
	}

	once.Do(func() { migrateDatabase(db) })

	return db
}
