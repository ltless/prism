package system

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"

	"github.com/ltless/prism/internal/db"
)

type SystemStats struct {
	CPU     int    `json:"cpu"`
	RAM     int    `json:"ram"`
	RAMText string `json:"ramText"`
}

type LogEntry struct {
	ID        int     `json:"id"`
	Level     string  `json:"level"`
	Message   string  `json:"message"`
	Meta      *string `json:"meta"`
	Source    *string `json:"source"`
	Timestamp string  `json:"timestamp"`
}

type LogResponse struct {
	Items []LogEntry `json:"items"`
	Total int        `json:"total"`
}

type Service struct {
	pool *db.TenantPool
}

func NewService(pool *db.TenantPool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Stats(ctx context.Context, userID string) (*SystemStats, error) {
	cpuUsage := 0
	loadData, err := os.ReadFile("/proc/loadavg")
	if err == nil {
		fields := strings.Fields(string(loadData))
		if len(fields) > 0 {
			if load, err := strconv.ParseFloat(fields[0], 64); err == nil {
				cpuUsage = int(math.Round(load / float64(runtime.NumCPU()) * 100))
				if cpuUsage > 100 {
					cpuUsage = 100
				}
			}
		}
	}

	totalMem := uint64(0)
	availMem := uint64(0)
	memData, err := os.ReadFile("/proc/meminfo")
	if err == nil {
		for _, line := range strings.Split(string(memData), "\n") {
			if strings.HasPrefix(line, "MemTotal:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					totalMem, _ = strconv.ParseUint(fields[1], 10, 64)
				}
			}
			if strings.HasPrefix(line, "MemAvailable:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					availMem, _ = strconv.ParseUint(fields[1], 10, 64)
				}
			}
		}
	}

	ram := 0
	ramText := "0/0GB"
	if totalMem > 0 {
		usedMem := totalMem - availMem
		ram = int(math.Round(float64(usedMem) / float64(totalMem) * 100))
		usedGB := float64(usedMem) * 1024 / 1073741824
		totalGB := float64(totalMem) * 1024 / 1073741824
		ramText = fmt.Sprintf("%.1f/%.0fGB", usedGB, totalGB)
	}

	return &SystemStats{
		CPU:     cpuUsage,
		RAM:     ram,
		RAMText: ramText,
	}, nil
}

func (s *Service) Logs(ctx context.Context, userID, level string, page, limit int) (*LogResponse, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	where := []string{"user_id = $1"}
	args := []interface{}{userID}
	argIdx := 2

	if level != "" {
		where = append(where, fmt.Sprintf("level = $%d", argIdx))
		args = append(args, level)
		argIdx++
	}

	whereClause := " WHERE " + strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM error_logs" + whereClause
	if err := tdb.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		total = 0
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit
	queryArgs := append(args, limit, offset)

	query := fmt.Sprintf("SELECT id, level, message, meta, source, timestamp FROM error_logs%s ORDER BY id DESC LIMIT $%d OFFSET $%d", whereClause, argIdx, argIdx+1)
	rows, err := tdb.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("query logs: %w", err)
	}
	defer rows.Close()

	var items []LogEntry
	for rows.Next() {
		var entry LogEntry
		var meta, source sql.NullString
		if err := rows.Scan(&entry.ID, &entry.Level, &entry.Message, &meta, &source, &entry.Timestamp); err != nil {
			return nil, fmt.Errorf("scan log: %w", err)
		}
		if meta.Valid {
			entry.Meta = &meta.String
		}
		if source.Valid {
			entry.Source = &source.String
		}
		items = append(items, entry)
	}

	if items == nil {
		items = []LogEntry{}
	}

	return &LogResponse{Items: items, Total: total}, nil
}

func (s *Service) CreateLogEntry(ctx context.Context, userID, level, message string, source, meta *string, timestamp string) error {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	_, err = tdb.Exec(ctx,
		"INSERT INTO error_logs (user_id, level, message, meta, source, timestamp) VALUES ($1, $2, $3, $4, $5, $6)",
		userID, level, message, meta, source, timestamp,
	)
	return err
}
