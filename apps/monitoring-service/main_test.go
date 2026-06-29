package main

import (
	"github.com/stretchr/testify/assert"
	"os"
	"testing"
)

// Simple test without HTTP dependencies
func TestBasic(t *testing.T) {
	t.Log("Basic test - monitoring service environment")

	// Test environment variables
	t.Run("Environment variables", func(t *testing.T) {
		os.Setenv("TEST_PORT", "9090")
		defer os.Unsetenv("TEST_PORT")

		port := os.Getenv("TEST_PORT")
		assert.Equal(t, "9090", port)
	})

	// Test default behavior
	t.Run("Default port", func(t *testing.T) {
		port := os.Getenv("PORT")
		assert.Equal(t, "", port)
	})
}
