package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"

	"github.com/salismazaya/panon/internal/database"
	"github.com/salismazaya/panon/internal/models"
	"github.com/salismazaya/panon/internal/service"
)

// LoginRequest represents a login request.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents a login response.
type LoginResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}

// UserInfo represents user information in response.
type UserInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

// UpdateProfileRequest represents a profile update request.
type UpdateProfileRequest struct {
	Username        string `json:"username"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// AuthHandlers holds authentication handlers and their dependencies.
type AuthHandlers struct {
	TokenService *service.TokenService
}

// NewAuthHandlers creates a new AuthHandlers instance.
func NewAuthHandlers() *AuthHandlers {
	return &AuthHandlers{
		TokenService: service.NewTokenService(),
	}
}

// Login handles user login and returns a JWT token.
func (h *AuthHandlers) Login(c *fiber.Ctx) error {
	req := new(LoginRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Username == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Username and password are required",
		})
	}

	db := database.GetDatabase()

	var user models.User
	if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{
			"error": "Invalid username or password",
		})
	}

	if !user.CheckPassword(req.Password) {
		return c.Status(401).JSON(fiber.Map{
			"error": "Invalid username or password",
		})
	}

	token, err := h.TokenService.GenerateToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	return c.JSON(LoginResponse{
		Token: token,
		User: UserInfo{
			ID:       user.ID,
			Username: user.Username,
		},
	})
}

// UpdateProfile handles updating user username and/or password.
func (h *AuthHandlers) UpdateProfile(c *fiber.Ctx) error {
	// Extract user from token
	authHeader := c.Get("Authorization")
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid authorization"})
	}

	claims, err := h.TokenService.ValidateToken(parts[1])
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	req := new(UpdateProfileRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.CurrentPassword == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Current password is required"})
	}

	db := database.GetDatabase()

	var user models.User
	if err := db.First(&user, claims.UserID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Verify current password
	if !user.CheckPassword(req.CurrentPassword) {
		return c.Status(401).JSON(fiber.Map{"error": "Current password is incorrect"})
	}

	// Update username if provided
	if req.Username != "" {
		// Check if username is already taken by another user
		var existing models.User
		if err := db.Where("username = ? AND id != ?", req.Username, user.ID).First(&existing).Error; err == nil {
			return c.Status(409).JSON(fiber.Map{"error": "Username is already taken"})
		}
		user.Username = req.Username
	}

	// Update password if provided
	if req.NewPassword != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
		}
		user.Password = string(hashedPassword)
	}

	if err := db.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	// Generate a new token (in case username changed, the token claims update)
	newToken, err := h.TokenService.GenerateToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate new token"})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"token":  newToken,
		"user": UserInfo{
			ID:       user.ID,
			Username: user.Username,
		},
	})
}

// ValidateToken validates a JWT token.
func (h *AuthHandlers) ValidateToken(token string) (bool, error) {
	_, err := h.TokenService.ValidateToken(token)
	if err != nil {
		return false, nil
	}
	return true, nil
}
