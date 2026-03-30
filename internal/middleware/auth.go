package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ValidateTokenFunc is the function signature for token validation.
type ValidateTokenFunc func(token string) (valid bool, err error)

// AuthMiddleware holds the authentication logic.
type AuthMiddleware struct {
	validateToken ValidateTokenFunc
}

// NewAuth creates a new AuthMiddleware instance with a token validation function.
func NewAuth(validateToken ValidateTokenFunc) *AuthMiddleware {
	return &AuthMiddleware{
		validateToken: validateToken,
	}
}

// Protect is a middleware function that protects routes with token authentication.
// It expects the Authorization header in the format: "Bearer <token>"
func (m *AuthMiddleware) Protect() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authorization header",
			})
		}

		// Extract token from "Bearer <token>" format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization format. Use: Bearer <token>",
			})
		}

		token := parts[1]

		// Validate token using the provided validation function
		if m.validateToken == nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Authentication not configured",
			})
		}

		valid, err := m.validateToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Token validation failed",
			})
		}

		if !valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		// Token is valid, proceed to the next handler
		return c.Next()
	}
}

// ValidateToken is a helper function to validate a token directly.
func (m *AuthMiddleware) ValidateToken(token string) (bool, error) {
	if m.validateToken == nil {
		return false, nil
	}
	return m.validateToken(token)
}
