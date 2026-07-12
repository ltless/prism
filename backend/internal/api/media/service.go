package media

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ltless/prism/internal/api/config"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/sidecar"
)

type MediaItem struct {
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	FilePath        string   `json:"filePath"`
	MimeType        string   `json:"mimeType"`
	Size            int64    `json:"size"`
	Width           *int     `json:"width"`
	Height          *int     `json:"height"`
	Hash            string   `json:"hash"`
	FolderID        *string  `json:"folderId"`
	IsFavorite      bool     `json:"isFavorite"`
	IsTrash         bool     `json:"isTrash"`
	IsVault         bool     `json:"isVault"`
	CapturedAt      *int64   `json:"capturedAt"`
	UpdatedAt       *int64   `json:"updatedAt"`
	CreatedAt       *int64   `json:"createdAt"`
	Metadata        *string  `json:"metadata"`
	Duration        *int     `json:"duration"`
	TranscodeStatus *string  `json:"transcodeStatus"`
}

type ListResponse struct {
	Items []MediaItem `json:"items"`
	Total int         `json:"total"`
}

type Service struct {
	pool          *db.TenantPool
	sidecarClient *sidecar.Client
	checker       config.ActiveChecker
}

func NewService(pool *db.TenantPool, checker config.ActiveChecker) *Service {
	return &Service{pool: pool, checker: checker}
}

func (s *Service) SetSidecarClient(c *sidecar.Client) {
	s.sidecarClient = c
}

func (s *Service) List(userID string, folderID *string, favorites, trash, vault, dedup bool, search string, page, limit int) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	where := []string{"1=1"}
	args := []interface{}{}

	if !vault {
		where = append(where, "is_vault = 0")
	}
	if folderID != nil {
		where = append(where, "folder_id = ?")
		args = append(args, *folderID)
	}
	if favorites {
		where = append(where, "is_favorite = 1")
	}
	if trash {
		where = append(where, "is_trash = 1")
	} else if !vault {
		where = append(where, "is_trash = 0")
	}
	if search != "" {
		where = append(where, "title LIKE ? ESCAPE '\\'")
		escaped := strings.ReplaceAll(search, "%", "\\%")
		escaped = strings.ReplaceAll(escaped, "_", "\\_")
		args = append(args, "%"+escaped+"%")
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	if dedup {
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE %s GROUP BY hash)", whereClause)
		if err := tdb.QueryRow(countQuery, args...).Scan(&total); err != nil {
			return nil, fmt.Errorf("count dedup: %w", err)
		}
		query := fmt.Sprintf(`SELECT %s FROM media WHERE id IN (
			SELECT MIN(id) FROM media WHERE %s GROUP BY hash
		) ORDER BY created_at DESC`, selectCols, whereClause)

		rows, err := tdb.Query(query, args...)
		if err != nil {
			return nil, fmt.Errorf("query media dedup: %w", err)
		}
		defer rows.Close()

		var items []MediaItem
		for rows.Next() {
			item, err := scanMediaItem(rows)
			if err != nil {
				return nil, fmt.Errorf("scan media: %w", err)
			}
			items = append(items, *item)
		}
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("rows iteration: %w", err)
		}
		if items == nil {
			items = []MediaItem{}
		}
		return &ListResponse{Items: items, Total: total}, nil
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media WHERE %s", whereClause)
	if err := tdb.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count media: %w", err)
	}

	query := fmt.Sprintf(`SELECT %s FROM media WHERE %s ORDER BY created_at DESC`, selectCols, whereClause)

	rows, err := tdb.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query media: %w", err)
	}
	defer rows.Close()

	var items []MediaItem
	for rows.Next() {
		item, err := scanMediaItem(rows)
		if err != nil {
			return nil, fmt.Errorf("scan media: %w", err)
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	if items == nil {
		items = []MediaItem{}
	}

	return &ListResponse{Items: items, Total: total}, nil
}

func (s *Service) Get(userID, id string) (*MediaItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	row := tdb.QueryRow(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE id = ?`, id)

	item, err := scanMediaItemRow(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("media not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get media: %w", err)
	}

	return item, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanMediaItemRow(row rowScanner) (*MediaItem, error) {
	var item MediaItem
	var fav, trashInt, vaultInt int
	var capturedAt, updatedAt, createdAt sql.NullInt64
	var meta, transcodeStatus sql.NullString
	var width, height, duration sql.NullInt64
	var folderID sql.NullString

	err := row.Scan(
		&item.ID, &item.Title, &item.FilePath, &item.MimeType, &item.Size,
		&width, &height, &item.Hash,
		&folderID, &fav, &trashInt, &vaultInt,
		&capturedAt, &updatedAt, &createdAt,
		&meta, &duration, &transcodeStatus,
	)
	if err != nil {
		return nil, err
	}

	item.IsFavorite = fav == 1
	item.IsTrash = trashInt == 1
	item.IsVault = vaultInt == 1
	if folderID.Valid { item.FolderID = &folderID.String }
	if capturedAt.Valid { item.CapturedAt = &capturedAt.Int64 }
	if updatedAt.Valid { item.UpdatedAt = &updatedAt.Int64 }
	if createdAt.Valid { item.CreatedAt = &createdAt.Int64 }
	if meta.Valid { item.Metadata = &meta.String }
	if width.Valid { w := int(width.Int64); item.Width = &w }
	if height.Valid { h := int(height.Int64); item.Height = &h }
	if duration.Valid { d := int(duration.Int64); item.Duration = &d }
	if transcodeStatus.Valid { item.TranscodeStatus = &transcodeStatus.String }

	return &item, nil
}

func scanMediaItem(rows *sql.Rows) (*MediaItem, error) {
	return scanMediaItemRow(rows)
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

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "database is locked") || strings.Contains(s, "SQLITE_BUSY")
}

func retryDB[T any](fn func() (T, error)) (T, error) {
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		result, err := fn()
		if err == nil {
			return result, nil
		}
		if !isRetryable(err) {
			return result, err
		}
		lastErr = err
		time.Sleep(time.Duration(50*(1<<i)) * time.Millisecond)
	}
	var zero T
	return zero, fmt.Errorf("retry exhausted: %w", lastErr)
}

func retryDBErr(fn func() error) error {
	_, err := retryDB(func() (struct{}, error) {
		return struct{}{}, fn()
	})
	return err
}

func (s *Service) Create(userID, folderID, filePath, title, mimeType, hash string, size int64, width, height *int, capturedAt *int64, metadata *string, duration *int, transcodeStatus *string) (*MediaItem, bool, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, false, fmt.Errorf("get tenant db: %w", err)
	}

	id := uuid.New().String()
	now := time.Now().Unix()
	title = sanitizeTitle(title)

	var fID *string
	if folderID != "" {
		fID = &folderID
	}

	res, err := retryDB(func() (sql.Result, error) {
		return tdb.Exec(
			`INSERT OR IGNORE INTO media (id, title, file_path, mime_type, size, width, height, hash, folder_id, captured_at, metadata, duration, transcode_status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, title, filePath, mimeType, size, width, height, hash, fID, capturedAt, metadata, duration, transcodeStatus, now, now,
		)
	})
	if err != nil {
		return nil, false, fmt.Errorf("insert media: %w", err)
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
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
	now := time.Now().Unix()
	_, err = tdb.Exec(
		`UPDATE media SET file_path = ?, hash = ?, width = ?, height = ?, size = ?, mime_type = ?, metadata = ?, updated_at = ? WHERE id = ?`,
		filePath, hash, width, height, size, mimeType, metadata, now, mediaID,
	)
	return err
}

func (s *Service) Update(userID, id string, updates map[string]interface{}) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	setClauses := []string{}
	args := []interface{}{}
	for k, v := range updates {
		if !allowedUpdateColumns[k] {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = ?", k))
		args = append(args, v)
	}
	setClauses = append(setClauses, "updated_at = ?")
	args = append(args, 	time.Now().Unix())
	args = append(args, id)

	query := fmt.Sprintf("UPDATE media SET %s WHERE id = ?", strings.Join(setClauses, ", "))
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

	res, err := tdb.Exec("DELETE FROM media WHERE id = ?", id)
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
	var existing string
	err = retryDBErr(func() error {
		return tdb.QueryRow("SELECT id FROM media WHERE hash = ? LIMIT 1", hash).Scan(&existing)
	})
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check hash: %w", err)
	}
	return true, nil
}

func (s *Service) BulkMove(userID string, mediaIDs []string, folderID *string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	now := time.Now().Unix()
	placeholders := make([]string, len(mediaIDs))
	args := make([]interface{}, 0, len(mediaIDs)+2)
	args = append(args, folderID, now)
	for i, id := range mediaIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	query := fmt.Sprintf("UPDATE media SET folder_id = ?, updated_at = ? WHERE id IN (%s)", strings.Join(placeholders, ","))
	_, err = tdb.Exec(query, args...)
	return err
}

func (s *Service) BulkSetField(userID string, mediaIDs []string, field string, value int) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	now := time.Now().Unix()
	placeholders := make([]string, len(mediaIDs))
	args := make([]interface{}, 0, len(mediaIDs)+2)
	args = append(args, value, now)
	for i, id := range mediaIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	query := fmt.Sprintf("UPDATE media SET %s = ?, updated_at = ? WHERE id IN (%s)", field, strings.Join(placeholders, ","))
	_, err = tdb.Exec(query, args...)
	return err
}

type TrashedItem struct {
	ID       string `json:"id"`
	FilePath string `json:"file_path"`
}

func (s *Service) EmptyTrash(userID string) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	rows, err := tdb.Query("SELECT id, file_path FROM media WHERE is_trash = 1")
	if err != nil {
		return nil, fmt.Errorf("query trashed: %w", err)
	}
	defer rows.Close()

	var items []TrashedItem
	for rows.Next() {
		var item TrashedItem
		if err := rows.Scan(&item.ID, &item.FilePath); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	if _, err := tdb.Exec("DELETE FROM media WHERE is_trash = 1"); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
}

func (s *Service) ResolveDuplicate(userID, keepID string, deleteIDs []string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	tx, err := tdb.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	placeholders := make([]string, len(deleteIDs))
	args := make([]interface{}, len(deleteIDs))
	for i, id := range deleteIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf("DELETE FROM media WHERE id IN (%s)", strings.Join(placeholders, ","))
	if _, err := tx.Exec(query, args...); err != nil {
		return fmt.Errorf("delete duplicates: %w", err)
	}

	if _, err := tx.Exec("UPDATE media SET updated_at = ? WHERE id = ?", time.Now().Unix(), keepID); err != nil {
		return fmt.Errorf("update kept: %w", err)
	}

	return tx.Commit()
}

type SearchParams struct {
	Query    string   `json:"query"`
	FolderID *string  `json:"folder_id"`
	Tags     []string `json:"tags"`
	Page     int      `json:"page"`
	Limit    int      `json:"limit"`
}

func (s *Service) DeleteAll(userID string) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	rows, err := tdb.Query("SELECT id, file_path FROM media")
	if err != nil {
		return nil, fmt.Errorf("query all media: %w", err)
	}
	defer rows.Close()

	var items []TrashedItem
	for rows.Next() {
		var item TrashedItem
		if err := rows.Scan(&item.ID, &item.FilePath); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	if _, err := tdb.Exec("DELETE FROM media"); err != nil {
		return nil, fmt.Errorf("delete all media: %w", err)
	}

	return items, nil
}

func (s *Service) AutoCleanup(userID string, olderThan *int64) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	query := "SELECT id, file_path FROM media WHERE is_trash = 1"
	args := []interface{}{}
	if olderThan != nil && *olderThan > 0 {
		query += " AND updated_at < ?"
		args = append(args, *olderThan)
	}

	rows, err := tdb.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query trashed: %w", err)
	}
	defer rows.Close()

	var items []TrashedItem
	for rows.Next() {
		var item TrashedItem
		if err := rows.Scan(&item.ID, &item.FilePath); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	deleteQuery := "DELETE FROM media WHERE is_trash = 1"
	if olderThan != nil && *olderThan > 0 {
		deleteQuery += " AND updated_at < ?"
	}
	if _, err := tdb.Exec(deleteQuery, args...); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
}

func (s *Service) UpdateByHash(userID, hash string, updates map[string]interface{}) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	// First look up the media ID by hash
	var id string
	err = tdb.QueryRow("SELECT id FROM media WHERE hash = ?", hash).Scan(&id)
	if err == sql.ErrNoRows {
		return fmt.Errorf("media not found for hash: %s", hash)
	}
	if err != nil {
		return fmt.Errorf("lookup hash: %w", err)
	}

	// Now update by ID using the existing update logic
	setClauses := []string{}
	args := []interface{}{}
	for k, v := range updates {
		if !allowedUpdateColumns[k] {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = ?", k))
		args = append(args, v)
	}
	if len(setClauses) == 0 {
		return nil
	}
	setClauses = append(setClauses, "updated_at = ?")
	args = append(args, time.Now().Unix())
	args = append(args, id)

	query := fmt.Sprintf("UPDATE media SET %s WHERE id = ?", strings.Join(setClauses, ", "))
	_, err = tdb.Exec(query, args...)
	return err
}

type DashboardResponse struct {
	Items        []MediaItem    `json:"items"`
	Total        int            `json:"total"`
	FolderCounts map[string]int `json:"folderCounts"`
}

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
	var total, tagged int
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE is_trash = 0").Scan(&total)
	tdb.QueryRow("SELECT COUNT(DISTINCT media_id) FROM media_tags").Scan(&tagged)
	return &AICountResponse{Total: total, Tagged: tagged}, nil
}

func (s *Service) CountScored(userID string) (*AIScoreResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	var total, scored int
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE is_trash = 0").Scan(&total)
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE metadata IS NOT NULL AND json_extract(metadata, '$.aestheticScored') = 1").Scan(&scored)
	return &AIScoreResponse{Total: total, Scored: scored}, nil
}

func (s *Service) Search(userID string, params SearchParams) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	where := []string{"is_trash = 0", "is_vault = 0"}
	args := []interface{}{}

	if params.Query != "" {
		where = append(where, "title LIKE ? ESCAPE '\\'")
		escaped := strings.ReplaceAll(params.Query, "%", "\\%")
		escaped = strings.ReplaceAll(escaped, "_", "\\_")
		args = append(args, "%"+escaped+"%")
	}

	if params.FolderID != nil && *params.FolderID != "" {
		where = append(where, "folder_id = ?")
		args = append(args, *params.FolderID)
	}

	if len(params.Tags) > 0 {
		placeholders := make([]string, len(params.Tags))
		for i, tag := range params.Tags {
			placeholders[i] = "?"
			args = append(args, tag)
		}
		where = append(where, fmt.Sprintf("id IN (SELECT media_id FROM media_tags WHERE tag IN (%s))", strings.Join(placeholders, ",")))
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media WHERE %s", whereClause)
	if err := tdb.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count search: %w", err)
	}

	query := fmt.Sprintf(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE %s ORDER BY created_at DESC`, whereClause)

	rows, err := tdb.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query search: %w", err)
	}
	defer rows.Close()

	var items []MediaItem
	for rows.Next() {
		item, err := scanMediaItem(rows)
		if err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	if items == nil {
		items = []MediaItem{}
	}

	return &ListResponse{Items: items, Total: total}, nil
}

const batchLimit = 10

type BatchTagResult struct {
	Tagged    int    `json:"tagged"`
	Remaining int    `json:"remaining"`
	Done      bool   `json:"done"`
	Error     string `json:"error,omitempty"`
}

type BatchScoreResult struct {
	Scored    int    `json:"scored"`
	Remaining int    `json:"remaining"`
	Done      bool   `json:"done"`
	Error     string `json:"error,omitempty"`
}

func (s *Service) BatchTag(userID, mediaDir string) (*BatchTagResult, error) {
	if s.checker != nil {
		active, err := s.checker.IsAIActive()
		if err != nil {
			return nil, fmt.Errorf("check ai active: %w", err)
		}
		if !active {
			return nil, fmt.Errorf("AI is not active")
		}
	}
	if s.sidecarClient == nil {
		return &BatchTagResult{Error: "sidecar not configured"}, nil
	}

	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	rows, err := tdb.Query(
		`SELECT id, file_path, metadata FROM media
		WHERE is_trash = 0 AND json_extract(metadata, '$.aiProcessed') IS NULL
		LIMIT ?`, batchLimit,
	)
	if err != nil {
		return nil, fmt.Errorf("query untagged: %w", err)
	}
	defer rows.Close()

	type untaggedItem struct {
		id       string
		filePath string
		metadata *string
	}
	var items []untaggedItem
	for rows.Next() {
		var it untaggedItem
		var meta sql.NullString
		if err := rows.Scan(&it.id, &it.filePath, &meta); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		if meta.Valid {
			it.metadata = &meta.String
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	if len(items) == 0 {
		return &BatchTagResult{Done: true}, nil
	}

	sidecarItems := make([]sidecar.BatchTagItem, len(items))
	for i, it := range items {
		sidecarItems[i] = sidecar.BatchTagItem{
			ID:       it.id,
			FilePath: mediaDir + "/" + it.filePath,
			MediaDir: mediaDir,
		}
	}

	resp, err := s.sidecarClient.BatchTag(sidecar.BatchTagRequest{
		Items:        sidecarItems,
		Variant:      "standard",
		TagThreshold: 0.1,
		BatchSize:    1,
	})
	if err != nil {
		return nil, fmt.Errorf("sidecar batch-tag: %w", err)
	}

	for _, r := range resp.Results {
		oldMeta := make(map[string]interface{})
		for _, it := range items {
			if it.id == r.ID && it.metadata != nil {
				json.Unmarshal([]byte(*it.metadata), &oldMeta)
				break
			}
		}
		oldMeta["embedding"] = r.Embedding
		oldMeta["tags"] = r.Tags
		oldMeta["tagScores"] = r.TagScores
		oldMeta["aiProcessed"] = true
		oldMeta["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
		metaBytes, _ := json.Marshal(oldMeta)

		tdb.Exec("UPDATE media SET metadata = ?, updated_at = ? WHERE id = ?",
			string(metaBytes), time.Now().Unix(), r.ID)
	}

	tagMediaIDs := make([]string, 0, len(resp.Results))
	for _, r := range resp.Results {
		if len(r.Tags) > 0 {
			tagMediaIDs = append(tagMediaIDs, r.ID)
		}
	}
	if len(tagMediaIDs) > 0 {
		placeholders := make([]string, len(tagMediaIDs))
		args := make([]interface{}, len(tagMediaIDs))
		for i, id := range tagMediaIDs {
			placeholders[i] = "?"
			args[i] = id
		}
		tdb.Exec("DELETE FROM media_tags WHERE media_id IN ("+strings.Join(placeholders, ",")+")", args...)

		for _, r := range resp.Results {
			if len(r.Tags) == 0 {
				continue
			}
			for i, tag := range r.Tags {
				score := float64(0)
				if i < len(r.TagScores) {
					score = float64(r.TagScores[i])
				}
				category := CategoryForTag(tag)
				tdb.Exec("INSERT INTO media_tags (media_id, tag, score, category) VALUES (?, ?, ?, ?)",
					r.ID, tag, score, category)
			}
		}
	}

	var remaining int
	tdb.QueryRow(
		`SELECT COUNT(*) FROM media
		WHERE is_trash = 0 AND json_extract(metadata, '$.aiProcessed') IS NULL`,
	).Scan(&remaining)

	return &BatchTagResult{
		Tagged:    resp.Tagged,
		Remaining: remaining,
		Done:      remaining == 0,
	}, nil
}

func (s *Service) BatchScore(userID, mediaDir string) (*BatchScoreResult, error) {
	if s.sidecarClient == nil {
		return &BatchScoreResult{Error: "sidecar not configured"}, nil
	}

	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	rows, err := tdb.Query(
		`SELECT id, file_path, metadata FROM media
		WHERE is_trash = 0 AND json_extract(metadata, '$.aestheticScored') IS NULL
		LIMIT ?`, batchLimit,
	)
	if err != nil {
		return nil, fmt.Errorf("query unscored: %w", err)
	}
	defer rows.Close()

	type unscoredItem struct {
		id       string
		filePath string
		metadata *string
	}
	var items []unscoredItem
	for rows.Next() {
		var it unscoredItem
		var meta sql.NullString
		if err := rows.Scan(&it.id, &it.filePath, &meta); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		if meta.Valid {
			it.metadata = &meta.String
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	if len(items) == 0 {
		return &BatchScoreResult{Done: true}, nil
	}

	sidecarItems := make([]sidecar.BatchScoreItem, len(items))
	for i, it := range items {
		sidecarItems[i] = sidecar.BatchScoreItem{
			ID:       it.id,
			FilePath: mediaDir + "/" + it.filePath,
		}
	}

	resp, err := s.sidecarClient.BatchScore(sidecar.BatchScoreRequest{
		Items:     sidecarItems,
		Model:     "laion",
		Variant:   "standard",
		BatchSize: 1,
	})
	if err != nil {
		return nil, fmt.Errorf("sidecar batch-score: %w", err)
	}

	for _, r := range resp.Results {
		oldMeta := make(map[string]interface{})
		for _, it := range items {
			if it.id == r.ID && it.metadata != nil {
				json.Unmarshal([]byte(*it.metadata), &oldMeta)
				break
			}
		}
		if r.Score != nil {
			oldMeta["aestheticScore"] = *r.Score
		}
		if r.Raw != nil {
			oldMeta["aestheticRaw"] = *r.Raw
		}
		oldMeta["aestheticModel"] = r.Model
		oldMeta["aestheticScored"] = true
		oldMeta["aestheticScoredAt"] = time.Now().UTC().Format(time.RFC3339)
		oldMeta["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
		metaBytes, _ := json.Marshal(oldMeta)

		tdb.Exec("UPDATE media SET metadata = ?, updated_at = ? WHERE id = ?",
			string(metaBytes), time.Now().Unix(), r.ID)
	}

	var remaining int
	tdb.QueryRow(
		`SELECT COUNT(*) FROM media
		WHERE is_trash = 0 AND json_extract(metadata, '$.aestheticScored') IS NULL`,
	).Scan(&remaining)

	return &BatchScoreResult{
		Scored:    resp.Scored,
		Remaining: remaining,
		Done:      remaining == 0,
	}, nil
}

type AIStatusResult struct {
	Done    bool `json:"done"`
	HasTags bool `json:"hasTags"`
}

func (s *Service) BatchAIStatus(userID string, ids []string) (map[string]AIStatusResult, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	if len(ids) > 200 {
		ids = ids[:200]
	}
	if len(ids) == 0 {
		return map[string]AIStatusResult{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	rows, err := tdb.Query(
		`SELECT id, metadata FROM media WHERE id IN (`+strings.Join(placeholders, ",")+`)`,
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	statuses := make(map[string]AIStatusResult, len(ids))
	for rows.Next() {
		var id string
		var meta sql.NullString
		if err := rows.Scan(&id, &meta); err != nil {
			continue
		}
		r := AIStatusResult{}
		if meta.Valid && meta.String != "" {
			var parsed map[string]interface{}
			if json.Unmarshal([]byte(meta.String), &parsed) == nil {
				if v, ok := parsed["aiProcessed"]; ok {
					r.Done = v == true
				}
				if tags, ok := parsed["tags"]; ok {
					if arr, ok := tags.([]interface{}); ok {
						r.HasTags = len(arr) > 0
					}
				}
			}
		}
		statuses[id] = r
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return statuses, nil
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

	if len(ids) > 200 {
		ids = ids[:200]
	}
	if len(ids) == 0 {
		return map[string]TranscodeStatusResult{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	rows, err := tdb.Query(
		`SELECT id, transcode_status, duration FROM media WHERE id IN (`+strings.Join(placeholders, ",")+`)`,
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
	var count int
	err = tdb.QueryRow("SELECT COUNT(*) FROM media WHERE file_path = ? AND id != ?", filePath, excludeID).Scan(&count)
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
	row := tdb.QueryRow(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE hash = ? LIMIT 1`, hash)
	item, err := scanMediaItemRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find by hash: %w", err)
	}
	return item, nil
}

type DashboardParams struct {
	FolderID   *string
	IsFavorite bool
	Categories []string
	MinScore   float64
	Page       int
	Limit      int
}

func (s *Service) GetDashboard(userID string, params DashboardParams) (*DashboardResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	where := []string{"is_trash = 0", "is_vault = 0"}
	args := []interface{}{}

	if params.FolderID != nil && len(params.Categories) == 0 {
		if *params.FolderID == "" {
			where = append(where, "folder_id IS NULL")
		} else {
			where = append(where, "folder_id = ?")
			args = append(args, *params.FolderID)
		}
	}
	if params.IsFavorite {
		where = append(where, "is_favorite = 1")
	}

	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	var items []MediaItem
	var total int

	if len(params.Categories) > 0 {
		// Smart folder: find media IDs matching categories/score in media_tags
		tagArgs := []interface{}{}
		catPlaceholders := make([]string, len(params.Categories))
		for i, cat := range params.Categories {
			catPlaceholders[i] = "?"
			tagArgs = append(tagArgs, cat)
		}
		tagArgs = append(tagArgs, params.MinScore)

		matchingIDs, err := tdb.Query(
			`SELECT DISTINCT media_id FROM media_tags
			WHERE category IN (`+strings.Join(catPlaceholders, ",")+`) AND score >= ?`,
			tagArgs...,
		)
		if err != nil {
			return nil, fmt.Errorf("query smart folder: %w", err)
		}
		defer matchingIDs.Close()

		var idList []string
		for matchingIDs.Next() {
			var id string
			if err := matchingIDs.Scan(&id); err == nil {
				idList = append(idList, id)
			}
		}
		if err := matchingIDs.Err(); err != nil {
			return nil, fmt.Errorf("rows: %w", err)
		}

		if len(idList) == 0 {
			return &DashboardResponse{Items: []MediaItem{}, Total: 0, FolderCounts: map[string]int{}}, nil
		}

		idPlaceholders := make([]string, len(idList))
		for i, id := range idList {
			idPlaceholders[i] = "?"
			args = append(args, id)
		}
		where = append(where, "id IN ("+strings.Join(idPlaceholders, ",")+")")
		whereClause := strings.Join(where, " AND ")

		var total int
		tdb.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE %s GROUP BY hash)", whereClause), args...).Scan(&total)

		q := fmt.Sprintf(`SELECT %s FROM media WHERE id IN (
			SELECT MIN(id) FROM media WHERE %s GROUP BY hash
		) ORDER BY created_at DESC`, selectCols, whereClause)

		rows, err := tdb.Query(q, args...)
		if err != nil {
			return nil, fmt.Errorf("query smart media: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			item, err := scanMediaItem(rows)
			if err != nil {
				return nil, fmt.Errorf("scan: %w", err)
			}
			items = append(items, *item)
		}
	} else {
		whereClause := strings.Join(where, " AND ")

		var total int
		tdb.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE %s GROUP BY hash)", whereClause), args...).Scan(&total)

		q := fmt.Sprintf(`SELECT %s FROM media WHERE id IN (
			SELECT MIN(id) FROM media WHERE %s GROUP BY hash
		) ORDER BY created_at DESC`, selectCols, whereClause)

		rows, err := tdb.Query(q, args...)
		if err != nil {
			return nil, fmt.Errorf("query media: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			item, err := scanMediaItem(rows)
			if err != nil {
				return nil, fmt.Errorf("scan: %w", err)
			}
			items = append(items, *item)
		}
	}

	if items == nil {
		items = []MediaItem{}
	}

	// Compute folder counts
	folderCounts, err := computeFolderCounts(tdb, params)
	if err != nil {
		return nil, fmt.Errorf("folder counts: %w", err)
	}

	return &DashboardResponse{Items: items, Total: total, FolderCounts: folderCounts}, nil
}

func computeFolderCounts(tdb *db.TenantDB, params DashboardParams) (map[string]int, error) {
	folderCounts := map[string]int{}

	rows, err := tdb.Query(
		`SELECT f.id, COUNT(DISTINCT m.id) FROM folders f
		LEFT JOIN media m ON m.folder_id = f.id AND m.is_trash = 0 AND m.is_vault = 0
		GROUP BY f.id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query folder counts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var folderID string
		var count int
		if err := rows.Scan(&folderID, &count); err == nil {
			folderCounts[folderID] = count
		}
	}

	// Inbox count (media with no folder, excluding smart-tagged items)
	var inbox int
	tdb.QueryRow(
		`SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE is_trash = 0 AND is_vault = 0 AND folder_id IS NULL GROUP BY hash)`,
	).Scan(&inbox)
	folderCounts["__inbox__"] = inbox

	return folderCounts, nil
}

type DuplicateGroup struct {
	ID              string      `json:"id"`
	Hash            string      `json:"hash"`
	Items           []MediaItem `json:"items"`
	IsNearDuplicate bool        `json:"isNearDuplicate"`
}

type DuplicatesResponse struct {
	Groups []DuplicateGroup `json:"groups"`
}

const nearDuplicateThreshold = 0.95
const maxNearDuplicates = 1000

func (s *Service) GetDuplicates(userID string) (*DuplicatesResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	// 1. Exact duplicates
	rows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE is_trash = 0 AND hash IN (
			SELECT hash FROM media WHERE is_trash = 0 GROUP BY hash HAVING COUNT(*) > 1
		) ORDER BY hash ASC, created_at DESC`, selectCols))
	if err != nil {
		return nil, fmt.Errorf("query exact dupes: %w", err)
	}
	defer rows.Close()

	groupMap := map[string][]MediaItem{}
	var hashOrder []string
	for rows.Next() {
		item, err := scanMediaItem(rows)
		if err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		if _, ok := groupMap[item.Hash]; !ok {
			hashOrder = append(hashOrder, item.Hash)
		}
		groupMap[item.Hash] = append(groupMap[item.Hash], *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	var exactGroups []DuplicateGroup
	exactHashes := map[string]bool{}
	for _, hash := range hashOrder {
		exactGroups = append(exactGroups, DuplicateGroup{
			ID:              "exact-" + hash[:min(8, len(hash))],
			Hash:            hash,
			Items:           groupMap[hash],
			IsNearDuplicate: false,
		})
		exactHashes[hash] = true
	}

	// 2. Near-duplicates via cosine similarity on embeddings
	allRows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE is_trash = 0`, selectCols))
	if err != nil {
		return nil, fmt.Errorf("query all media: %w", err)
	}
	defer allRows.Close()

	type embeddedItem struct {
		item      MediaItem
		embedding []float64
	}
	var withEmb []embeddedItem
	for allRows.Next() {
		item, err := scanMediaItem(allRows)
		if err != nil {
			continue
		}
		if item.Metadata == nil {
			continue
		}
		var meta struct {
			Embedding []float64 `json:"embedding"`
		}
		if err := json.Unmarshal([]byte(*item.Metadata), &meta); err != nil {
			continue
		}
		if len(meta.Embedding) > 0 {
			withEmb = append(withEmb, embeddedItem{item: *item, embedding: meta.Embedding})
		}
	}

	var nearGroups []DuplicateGroup
	if len(withEmb) >= 2 {
		if len(withEmb) > maxNearDuplicates {
			log.Printf("Near-duplicate detection skipped: %d embedded items exceed limit of %d", len(withEmb), maxNearDuplicates)
		} else {
			visited := map[string]bool{}
			for i := 0; i < len(withEmb); i++ {
			a := withEmb[i]
			if visited[a.item.ID] {
				continue
			}
			cluster := []MediaItem{a.item}
			for j := i + 1; j < len(withEmb); j++ {
				b := withEmb[j]
				if visited[b.item.ID] {
					continue
				}
				if cosineSim(a.embedding, b.embedding) >= nearDuplicateThreshold {
					cluster = append(cluster, b.item)
					visited[b.item.ID] = true
				}
			}
			if len(cluster) > 1 {
				visited[a.item.ID] = true
				alreadyExact := false
				for _, it := range cluster {
					if exactHashes[it.Hash] {
						alreadyExact = true
						break
					}
				}
				if !alreadyExact {
					hash := a.item.Hash
					nearGroups = append(nearGroups, DuplicateGroup{
						ID:              fmt.Sprintf("near-%s-%d", hash[:min(8, len(hash))], len(nearGroups)),
						Hash:            hash,
						Items:           cluster,
						IsNearDuplicate: true,
					})
				}
			}
		}
		}
	}

	groups := append(exactGroups, nearGroups...)
	if groups == nil {
		groups = []DuplicateGroup{}
	}
	return &DuplicatesResponse{Groups: groups}, nil
}

func cosineSim(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (sqrt(normA) * sqrt(normB))
}

func sqrt(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 50; i++ {
		z -= (z*z - x) / (2 * z)
	}
	return z
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
