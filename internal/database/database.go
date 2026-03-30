package database

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func GetDatabase() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("database.db"))

	if err != nil {
		panic("Connection to database error: " + err.Error())
	}

	return db
}
