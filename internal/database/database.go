package database

import (
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func GetDatabase() *gorm.DB {
	var dialector gorm.Dialector
	dbUrl := os.Getenv("DATABASE_URL")

	if strings.HasPrefix(dbUrl, "postgres://") || strings.HasPrefix(dbUrl, "postgresql://") {
		dialector = postgres.Open(dbUrl)
	} else {
		// Default to SQLite
		dbPath := "database.db"
		if dbUrl != "" && !strings.Contains(dbUrl, "://") {
			dbPath = dbUrl
		}
		dialector = sqlite.Open(dbPath)
	}

	db, err := gorm.Open(dialector, &gorm.Config{})

	if err != nil {
		panic("Connection to database error: " + err.Error())
	}

	return db
}
