package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/salismazaya/panon/internal/database"
)

func main() {
	// Load environment variables (mostly for consistency or DB URL in the future)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found (migrate tool)")
	}

	// Initialize the database connection (without AutoMigrate)
	db := database.GetDatabase()

	m := database.GetMigrator(db)

	if len(os.Args) < 2 {
		log.Fatalf("Usage: %s [up|down|make <name>]\n", os.Args[0])
	}

	action := os.Args[1]

	switch action {
	case "up":
		if err := m.Migrate(); err != nil {
			log.Fatalf("Could not migrate: %v", err)
		}
		log.Println("Migration did run successfully")
	case "down":
		if err := m.RollbackLast(); err != nil {
			log.Fatalf("Could not rollback: %v", err)
		}
		log.Println("Rollback did run successfully")
	case "make":
		if len(os.Args) < 3 {
			log.Fatalf("Usage: %s make <migration_name>\n", os.Args[0])
		}
		name := os.Args[2]
		timestamp := time.Now().Format("20060102150405")
		filename := fmt.Sprintf("internal/database/migrations/%s_%s.go", timestamp, name)
		
		content := fmt.Sprintf(`package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
)

func init() {
	List = append(List, &gormigrate.Migration{
		ID: "%s_%s",
		Migrate: func(tx *gorm.DB) error {
			// Write your up migration here
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			// Write your down migration here
			return nil
		},
	})
}`, timestamp, name)

		if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
			log.Fatalf("Could not create migration file: %v\n", err)
		}
		log.Printf("Successfully created migration: %s\n", filename)
	default:
		log.Fatalf("Unknown command: %s. Use up, down, or make.\n", action)
	}
}
