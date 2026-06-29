package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

var logger *slog.Logger

func initLogger() {
	levelStr := os.Getenv("LOG_LEVEL")
	var level slog.Level

	switch strings.ToUpper(levelStr) {
	case "DEBUG":
		level = slog.LevelDebug
	case "INFO":
		level = slog.LevelInfo
	case "WARN":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level:     level,
		AddSource: true,
	}))

	slog.SetDefault(logger)
}

func Debug(ctx context.Context, msg string, args ...any) {
	logger.DebugContext(ctx, msg, args...)
}

func Info(ctx context.Context, msg string, args ...any) {
	logger.InfoContext(ctx, msg, args...)
}

func Warn(ctx context.Context, msg string, args ...any) {
	logger.WarnContext(ctx, msg, args...)
}

func Error(ctx context.Context, msg string, args ...any) {
	logger.ErrorContext(ctx, msg, args...)
}

func WithErr(err error) slog.Attr {
	return slog.Attr{Key: "error", Value: slog.StringValue(err.Error())}
}
