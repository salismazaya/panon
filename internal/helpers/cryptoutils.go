package helpers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"io"
	"os"
)

func getSecretKey() []byte {
	return []byte(os.Getenv("SECRET_KEY"))
}

func Encrypt(text string) (string, error) {
	key := getSecretKey()
	textBytes := []byte(text)

	c, err := aes.NewCipher(key)

	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())

	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	sealed := gcm.Seal(nonce, nonce, textBytes, nil)
	return hex.EncodeToString(sealed), nil
}

func Decrypt(ciphertext string) (string, error) {
	key := getSecretKey()
	keyBytes := []byte(key)

	c, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	ciphertextBytes, err := hex.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertextBytes) < nonceSize {
		return "", err
	}

	nonce, ciphertextBytes := ciphertextBytes[:nonceSize], ciphertextBytes[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
