package database

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/salismazaya/panon/internal/database/migrations"
	"gorm.io/gorm"
)

// GetMigrator returns the gormigrate instance with all defined migrations
func GetMigrator(db *gorm.DB) *gormigrate.Gormigrate {
	m := gormigrate.New(db, gormigrate.DefaultOptions, migrations.List)
	return m
}

