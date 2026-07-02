package media

import (
	"database/sql"
	"fmt"
	"strings"
)

type AICountResponse struct {
	Total  int `json:"total"`
	Tagged int `json:"tagged"`
}

type AIScoreResponse struct {
	Total  int `json:"total"`
	Scored int `json:"scored"`
}

func (s *Service) CountTagged(userID string) (*AICountResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var total, tagged int
	if err := tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND is_trash = FALSE", userID).Scan(&total); err != nil {
		return nil, fmt.Errorf("count media: %w", err)
	}
	if err := tdb.QueryRow("SELECT COUNT(DISTINCT media_id) FROM media_tags WHERE user_id = $1", userID).Scan(&tagged); err != nil {
		return nil, fmt.Errorf("count tagged media: %w", err)
	}
	return &AICountResponse{Total: total, Tagged: tagged}, nil
}

func (s *Service) CountScored(userID string) (*AIScoreResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var total, scored int
	if err := tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND is_trash = FALSE", userID).Scan(&total); err != nil {
		return nil, fmt.Errorf("count media: %w", err)
	}
	if err := tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND metadata IS NOT NULL AND metadata->>'aestheticScored' = 'true'", userID).Scan(&scored); err != nil {
		return nil, fmt.Errorf("count scored media: %w", err)
	}
	return &AIScoreResponse{Total: total, Scored: scored}, nil
}

type TranscodeStatusResult struct {
	Status   *string `json:"status"`
	Duration *int    `json:"duration"`
}

func (s *Service) BatchTranscodeStatus(userID string, ids []string) (map[string]TranscodeStatusResult, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	if len(ids) > 200 {
		ids = ids[:200]
	}
	if len(ids) == 0 {
		return map[string]TranscodeStatusResult{}, nil
	}

	placeholders := make([]string, len(ids))
	args := []interface{}{userID} // $1
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, id)
	}

	rows, err := tdb.Query(
		`SELECT id, transcode_status, duration FROM media WHERE user_id = $1 AND id IN (`+strings.Join(placeholders, ",")+`)`,
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	statuses := make(map[string]TranscodeStatusResult, len(ids))
	for rows.Next() {
		var id string
		var ts sql.NullString
		var dur sql.NullInt64
		if err := rows.Scan(&id, &ts, &dur); err != nil {
			continue
		}
		r := TranscodeStatusResult{}
		if ts.Valid {
			r.Status = &ts.String
		}
		if dur.Valid {
			d := int(dur.Int64)
			r.Duration = &d
		}
		statuses[id] = r
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return statuses, nil
}

func (s *Service) IsSharedPath(userID, filePath, excludeID string) (bool, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return false, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var count int
	err = tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND file_path = $2 AND id != $3", userID, filePath, excludeID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check shared path: %w", err)
	}
	return count > 0, nil
}

func (s *Service) FindByHash(userID, hash string) (*MediaItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	row := tdb.QueryRow(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE user_id = $1 AND hash = $2 LIMIT 1`, userID, hash)
	item, err := scanMediaItemRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find by hash: %w", err)
	}
	return item, nil
}
