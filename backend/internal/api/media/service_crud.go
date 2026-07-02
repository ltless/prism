package media

import (
	"database/sql"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"strings"
	"time"
)

// ErrQuotaExceeded is returned by CreateWithinQuota when an upload would push
// the user's total usage past their configured storage_limit.
var ErrQuotaExceeded = errors.New("storage quota exceeded")

func (s *Service) List(userID string, folderID *string, favorites, trash, vault, dedup bool, search string, page, limit int) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	f := buildListWhere(userID, folderID, favorites, trash, vault, search)
	whereClause := strings.Join(f.where, " AND ")

	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	// ponytail: still OFFSET-based; all current callers use page 1 so deep-page
	// cost is moot. Switch to keyset (created_at < $last) when a UI pages deeply.
	// Total is computed in the same query via a window function — one round
	// trip and one scan instead of a separate COUNT(*) query per request.
	const totalCol = "__total"

	var total int
	var items []MediaItem
	if dedup {
		query := fmt.Sprintf(`SELECT %s, COUNT(*) OVER() AS %s FROM media WHERE id IN (
			SELECT MIN(id) FROM media WHERE %s GROUP BY hash
		) ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`, mediaSelectCols, totalCol, whereClause, limit, offset)
		items, total, err = scanMediaPageWithTotal(tdb, query, totalCol, f.args)
	} else {
		query := fmt.Sprintf(`SELECT %s, COUNT(*) OVER() AS %s FROM media WHERE %s ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`, mediaSelectCols, totalCol, whereClause, limit, offset)
		items, total, err = scanMediaPageWithTotal(tdb, query, totalCol, f.args)
	}
	if err != nil {
		return nil, err
	}
	return &ListResponse{Items: items, Total: total}, nil
}

func (s *Service) Get(userID, id string) (*MediaItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	row := tdb.QueryRow(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE user_id = $1 AND id = $2`, userID, id)

	item, err := scanMediaItemRow(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("media not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get media: %w", err)
	}

	return item, nil
}

func sanitizeTitle(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if r == '<' {
			b.WriteString("&lt;")
		} else if r == '>' {
			b.WriteString("&gt;")
		} else if r == '&' {
			b.WriteString("&amp;")
		} else if r == '"' {
			b.WriteString("&quot;")
		} else if r == '\'' {
			b.WriteString("&#39;")
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// mediaExecer is the shared Exec surface of *db.TenantDB and *sql.Tx, so the
// media insert can run either directly or inside the quota transaction.
type mediaExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// insertMedia inserts one media row, returning false when the hash conflict
// short-circuit (ON CONFLICT DO NOTHING) fired.
func insertMedia(e mediaExecer, id, userID, title, filePath, mimeType string, size int64, width, height *int, hash string, folderID *string, capturedAt *int64, metadata *string, duration *int, transcodeStatus *string, now int64) (bool, error) {
	res, err := e.Exec(
		`INSERT INTO media (id, user_id, title, file_path, mime_type, size, width, height, hash, folder_id, captured_at, metadata, duration, transcode_status, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT DO NOTHING`,
		id, userID, title, filePath, mimeType, size, width, height, hash, folderID, capturedAt, metadata, duration, transcodeStatus, now, now,
	)
	if err != nil {
		return false, fmt.Errorf("insert media: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	return rowsAffected > 0, nil
}

func (s *Service) Create(userID, folderID, filePath, title, mimeType, hash string, size int64, width, height *int, capturedAt *int64, metadata *string, duration *int, transcodeStatus *string) (*MediaItem, bool, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, false, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	id := uuid.New().String()
	now := time.Now().Unix()
	title = sanitizeTitle(title)

	var fID *string
	if folderID != "" {
		fID = &folderID
	}

	inserted, err := insertMedia(tdb, id, userID, title, filePath, mimeType, size, width, height, hash, fID, capturedAt, metadata, duration, transcodeStatus, now)
	if err != nil {
		return nil, false, err
	}
	if !inserted {
		return nil, true, nil
	}

	return &MediaItem{
		ID:              id,
		Title:           title,
		FilePath:        filePath,
		MimeType:        mimeType,
		Size:            size,
		Hash:            hash,
		FolderID:        fID,
		Duration:        duration,
		TranscodeStatus: transcodeStatus,
	}, false, nil
}

// CreateWithinQuota atomically checks the user's storage quota and inserts the
// media row in a single transaction. Concurrent uploads for the same user are
// serialized by a transaction-scoped advisory lock, so N parallel requests
// cannot all read the same "used" value and collectively blow past the limit.
// Returns ErrQuotaExceeded when the insert would exceed the limit, and
// (nil, true, nil) on hash conflict — same contract as Create.
func (s *Service) CreateWithinQuota(userID, folderID, filePath, title, mimeType, hash string, size int64, width, height *int, capturedAt *int64, metadata *string, duration *int, transcodeStatus *string) (*MediaItem, bool, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, false, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	tx, err := tdb.Begin()
	if err != nil {
		return nil, false, fmt.Errorf("begin media txn: %w", err)
	}
	defer tx.Rollback()

	// Serialize check+insert per user. hashtext keeps the lock key bounded.
	if _, err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext($1))", userID); err != nil {
		return nil, false, fmt.Errorf("quota lock: %w", err)
	}

	if size > 0 {
		var limit sql.NullInt64
		if err := tx.QueryRow("SELECT storage_limit FROM users WHERE id = $1", userID).Scan(&limit); err != nil {
			return nil, false, fmt.Errorf("query storage limit: %w", err)
		}
		if limit.Valid && limit.Int64 >= 0 {
			var used int64
			if err := tx.QueryRow("SELECT COALESCE(SUM(size), 0) FROM media WHERE user_id = $1", userID).Scan(&used); err != nil {
				return nil, false, fmt.Errorf("query storage usage: %w", err)
			}
			if used+size > limit.Int64 {
				return nil, false, ErrQuotaExceeded
			}
		}
	}

	id := uuid.New().String()
	now := time.Now().Unix()
	title = sanitizeTitle(title)

	var fID *string
	if folderID != "" {
		fID = &folderID
	}

	inserted, err := insertMedia(tx, id, userID, title, filePath, mimeType, size, width, height, hash, fID, capturedAt, metadata, duration, transcodeStatus, now)
	if err != nil {
		return nil, false, err
	}
	if !inserted {
		return nil, true, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, false, fmt.Errorf("commit media insert: %w", err)
	}

	return &MediaItem{
		ID:              id,
		Title:           title,
		FilePath:        filePath,
		MimeType:        mimeType,
		Size:            size,
		Hash:            hash,
		FolderID:        fID,
		Duration:        duration,
		TranscodeStatus: transcodeStatus,
	}, false, nil
}

var allowedUpdateColumns = map[string]bool{
	"title":            true,
	"folder_id":        true,
	"is_favorite":      true,
	"is_trash":         true,
	"is_vault":         true,
	"metadata":         true,
	"width":            true,
	"height":           true,
	"captured_at":      true,
	"duration":         true,
	"transcode_status": true,
}

func (s *Service) SaveEditorOverwrite(userID, mediaID, filePath, hash string, width, height int, size int64, mimeType, metadata string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	now := time.Now().Unix()
	_, err = tdb.Exec(
		`UPDATE media SET file_path = $1, hash = $2, width = $3, height = $4, size = $5, mime_type = $6, metadata = $7, updated_at = $8 WHERE user_id = $9 AND id = $10`,
		filePath, hash, width, height, size, mimeType, metadata, now, userID, mediaID,
	)
	return err
}

func (s *Service) Update(userID, id string, updates map[string]interface{}) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1
	for k, v := range updates {
		if !allowedUpdateColumns[k] {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, time.Now().Unix())
	argIdx++

	query := fmt.Sprintf("UPDATE media SET %s WHERE user_id = $%d AND id = $%d", strings.Join(setClauses, ", "), argIdx, argIdx+1)
	args = append(args, userID, id)
	_, err = tdb.Exec(query, args...)
	return err
}

func (s *Service) Delete(userID, id string) (*MediaItem, error) {
	item, err := s.Get(userID, id)
	if err != nil {
		return nil, err
	}

	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	res, err := tdb.Exec("DELETE FROM media WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return nil, fmt.Errorf("delete media: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return nil, fmt.Errorf("media not found")
	}

	return item, nil
}

// HashExists reports whether a media row with the given hash already exists
// for the user. Used to skip redundant file writes on duplicate uploads.
func (s *Service) HashExists(userID, hash string) (bool, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return false, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var existing string
	err = tdb.QueryRow("SELECT id FROM media WHERE user_id = $1 AND hash = $2 LIMIT 1", userID, hash).Scan(&existing)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check hash: %w", err)
	}
	return true, nil
}

func (s *Service) UpdateByHash(userID, hash string, updates map[string]interface{}) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	// First look up the media ID by hash
	var id string
	err = tdb.QueryRow("SELECT id FROM media WHERE user_id = $1 AND hash = $2", userID, hash).Scan(&id)
	if err == sql.ErrNoRows {
		return fmt.Errorf("media not found for hash: %s", hash)
	}
	if err != nil {
		return fmt.Errorf("lookup hash: %w", err)
	}

	// Now update by ID using the existing update logic
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1
	for k, v := range updates {
		if !allowedUpdateColumns[k] {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	if len(setClauses) == 0 {
		return nil
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, time.Now().Unix())
	argIdx++

	query := fmt.Sprintf("UPDATE media SET %s WHERE user_id = $%d AND id = $%d", strings.Join(setClauses, ", "), argIdx, argIdx+1)
	args = append(args, userID, id)
	_, err = tdb.Exec(query, args...)
	return err
}
