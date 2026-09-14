package media

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/ltless/prism/internal/api/config"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/vault"
	"log"
	"strings"
	"time"
)

// ErrQuotaExceeded is returned by CreateWithinQuota when an upload would push
// the user's total usage past their configured storage_limit.
var ErrQuotaExceeded = errors.New("storage quota exceeded")

type MediaItem struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	FilePath        string  `json:"filePath"`
	MimeType        string  `json:"mimeType"`
	Size            int64   `json:"size"`
	Width           *int    `json:"width"`
	Height          *int    `json:"height"`
	Hash            string  `json:"hash"`
	FolderID        *string `json:"folderId"`
	IsFavorite      bool    `json:"isFavorite"`
	IsTrash         bool    `json:"isTrash"`
	IsVault         bool    `json:"isVault"`
	CapturedAt      *int64  `json:"capturedAt"`
	UpdatedAt       *int64  `json:"updatedAt"`
	CreatedAt       *int64  `json:"createdAt"`
	Metadata        *string `json:"metadata"`
	Duration        *int    `json:"duration"`
	TranscodeStatus *string `json:"transcodeStatus"`
}

type ListResponse struct {
	Items []MediaItem `json:"items"`
	Total int         `json:"total"`
}

type Service struct {
	pool     *db.TenantPool
	checker  config.ActiveChecker
	globalDB *db.GlobalDB
}

func NewService(pool *db.TenantPool, checker config.ActiveChecker) *Service {
	return &Service{pool: pool, checker: checker}
}

func (s *Service) SetGlobalDB(g *db.GlobalDB) {
	s.globalDB = g
}

// VaultUnlockAllowed reports whether userID may move media out of the vault.
// If no vault PIN is configured the operation is allowed; otherwise the PIN
// must match. Failed attempts share the lockout counter with the PIN verify
// endpoint.
func (s *Service) VaultUnlockAllowed(userID, pin string) (bool, error) {
	if s.globalDB == nil {
		return false, errors.New("global db not configured")
	}
	hasPin, ok, err := vault.Verify(s.globalDB.DB, userID, pin)
	if err != nil {
		return false, fmt.Errorf("verify vault pin: %w", err)
	}
	if !hasPin {
		return true, nil
	}
	if !ok {
		vault.RecordFailure(userID)
		return false, nil
	}
	vault.Reset(userID)
	return true, nil
}

// mediaSelectCols is the standard media column list shared by List/Get/Search
// and the duplicate/dashboard queries.
const mediaSelectCols = `id, title, file_path, mime_type, size, width, height, hash,
	folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
	metadata, duration, transcode_status`

// listFilters captures the WHERE clauses and bind args for List. It is a
// straight extraction from List (F13) — no behavior change.
type listFilters struct {
	where []string
	args  []interface{}
}

// buildListWhere assembles List's filter set: tenant scope, folder,
// favorites, trash, vault and the escaped title search.
func buildListWhere(userID string, folderID *string, favorites, trash, vault bool, search string) listFilters {
	f := listFilters{
		where: []string{"user_id = $1"},
		args:  []interface{}{userID},
	}
	argIdx := 2

	if !vault {
		f.where = append(f.where, "is_vault = FALSE")
	}
	if folderID != nil {
		f.where = append(f.where, fmt.Sprintf("folder_id = $%d", argIdx))
		f.args = append(f.args, *folderID)
		argIdx++
	}
	if favorites {
		f.where = append(f.where, "is_favorite = TRUE")
	}
	if trash {
		f.where = append(f.where, "is_trash = TRUE")
	} else if !vault {
		f.where = append(f.where, "is_trash = FALSE")
	}
	if search != "" {
		f.where = append(f.where, fmt.Sprintf("title ILIKE $%d ESCAPE '\\'", argIdx))
		escaped := strings.ReplaceAll(search, "%", "\\%")
		escaped = strings.ReplaceAll(escaped, "_", "\\_")
		f.args = append(f.args, "%"+escaped+"%")
		argIdx++
	}
	return f
}

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

// scanMediaPageWithTotal runs a paged media SELECT carrying a COUNT(*) OVER()
// total column and drains it into items + total.
func scanMediaPageWithTotal(tdb *db.TenantDB, query, totalCol string, args []interface{}) ([]MediaItem, int, error) {
	rows, err := tdb.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query media: %w", err)
	}
	defer rows.Close()

	var items []MediaItem
	var total int
	for rows.Next() {
		item, t, err := scanMediaItemWithTotal(rows, totalCol)
		if err != nil {
			return nil, 0, fmt.Errorf("scan media: %w", err)
		}
		total = t
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("rows iteration: %w", err)
	}
	if items == nil {
		items = []MediaItem{}
	}
	return items, total, nil
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

type rowScanner interface {
	Scan(dest ...any) error
}

func scanMediaItemRow(row rowScanner) (*MediaItem, error) {
	var item MediaItem
	var fav, trashBool, vaultBool bool
	var capturedAt, updatedAt, createdAt sql.NullInt64
	var meta, transcodeStatus sql.NullString
	var width, height, duration sql.NullInt64
	var folderID sql.NullString

	err := row.Scan(
		&item.ID, &item.Title, &item.FilePath, &item.MimeType, &item.Size,
		&width, &height, &item.Hash,
		&folderID, &fav, &trashBool, &vaultBool,
		&capturedAt, &updatedAt, &createdAt,
		&meta, &duration, &transcodeStatus,
	)
	if err != nil {
		return nil, err
	}

	item.IsFavorite = fav
	item.IsTrash = trashBool
	item.IsVault = vaultBool
	if folderID.Valid {
		item.FolderID = &folderID.String
	}
	if capturedAt.Valid {
		item.CapturedAt = &capturedAt.Int64
	}
	if updatedAt.Valid {
		item.UpdatedAt = &updatedAt.Int64
	}
	if createdAt.Valid {
		item.CreatedAt = &createdAt.Int64
	}
	if meta.Valid {
		item.Metadata = &meta.String
	}
	if width.Valid {
		w := int(width.Int64)
		item.Width = &w
	}
	if height.Valid {
		h := int(height.Int64)
		item.Height = &h
	}
	if duration.Valid {
		d := int(duration.Int64)
		item.Duration = &d
	}
	if transcodeStatus.Valid {
		item.TranscodeStatus = &transcodeStatus.String
	}

	return &item, nil
}

func scanMediaItem(rows *sql.Rows) (*MediaItem, error) {
	return scanMediaItemRow(rows)
}

// scanMediaItemWithTotal scans a row that carries an extra trailing COUNT(*)
// OVER() column (aliased totalCol) — see List.
func scanMediaItemWithTotal(rows *sql.Rows, totalCol string) (*MediaItem, int, error) {
	var item MediaItem
	var fav, trashBool, vaultBool bool
	var capturedAt, updatedAt, createdAt sql.NullInt64
	var meta, transcodeStatus sql.NullString
	var width, height, duration sql.NullInt64
	var folderID sql.NullString
	var total int

	err := rows.Scan(
		&item.ID, &item.Title, &item.FilePath, &item.MimeType, &item.Size,
		&width, &height, &item.Hash,
		&folderID, &fav, &trashBool, &vaultBool,
		&capturedAt, &updatedAt, &createdAt,
		&meta, &duration, &transcodeStatus,
		&total,
	)
	if err != nil {
		return nil, 0, err
	}

	item.IsFavorite = fav
	item.IsTrash = trashBool
	item.IsVault = vaultBool
	if folderID.Valid {
		item.FolderID = &folderID.String
	}
	if capturedAt.Valid {
		item.CapturedAt = &capturedAt.Int64
	}
	if updatedAt.Valid {
		item.UpdatedAt = &updatedAt.Int64
	}
	if createdAt.Valid {
		item.CreatedAt = &createdAt.Int64
	}
	if meta.Valid {
		item.Metadata = &meta.String
	}
	if width.Valid {
		w := int(width.Int64)
		item.Width = &w
	}
	if height.Valid {
		h := int(height.Int64)
		item.Height = &h
	}
	if duration.Valid {
		d := int(duration.Int64)
		item.Duration = &d
	}
	if transcodeStatus.Valid {
		item.TranscodeStatus = &transcodeStatus.String
	}

	return &item, total, nil
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

func (s *Service) BulkMove(userID string, mediaIDs []string, folderID *string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	now := time.Now().Unix()
	placeholders := make([]string, len(mediaIDs))
	args := make([]interface{}, 0, len(mediaIDs)+3)
	args = append(args, folderID, now, userID) // $1, $2, $3
	for i, id := range mediaIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+4)
		args = append(args, id)
	}
	query := fmt.Sprintf("UPDATE media SET folder_id = $1, updated_at = $2 WHERE user_id = $3 AND id IN (%s)", strings.Join(placeholders, ","))
	_, err = tdb.Exec(query, args...)
	return err
}

func (s *Service) BulkSetField(userID string, mediaIDs []string, field string, value int) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	now := time.Now().Unix()
	boolVal := value != 0
	placeholders := make([]string, len(mediaIDs))
	args := make([]interface{}, 0, len(mediaIDs)+3)
	args = append(args, boolVal, now, userID) // $1, $2, $3
	for i, id := range mediaIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+4)
		args = append(args, id)
	}
	query := fmt.Sprintf("UPDATE media SET %s = $1, updated_at = $2 WHERE user_id = $3 AND id IN (%s)", field, strings.Join(placeholders, ","))
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
	defer tdb.Close()

	rows, err := tdb.Query("SELECT id, file_path FROM media WHERE user_id = $1 AND is_trash = TRUE", userID)
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

	if _, err := tdb.Exec("DELETE FROM media WHERE user_id = $1 AND is_trash = TRUE", userID); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
}

func (s *Service) ResolveDuplicate(userID, keepID string, deleteIDs []string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	tx, err := tdb.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// DELETE: WHERE user_id = $1 AND id IN ($2, $3, ...)
	deleteArgs := []interface{}{userID}
	placeholders := make([]string, len(deleteIDs))
	for i, id := range deleteIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		deleteArgs = append(deleteArgs, id)
	}
	query := fmt.Sprintf("DELETE FROM media WHERE user_id = $1 AND id IN (%s)", strings.Join(placeholders, ","))
	if _, err := tx.Exec(query, deleteArgs...); err != nil {
		return fmt.Errorf("delete duplicates: %w", err)
	}

	if _, err := tx.Exec("UPDATE media SET updated_at = $3 WHERE user_id = $1 AND id = $2",
		userID, keepID, time.Now().Unix()); err != nil {
		return fmt.Errorf("update kept: %w", err)
	}

	return tx.Commit()
}

type SearchParams struct {
	Query    string   `json:"query"`
	FolderID *string  `json:"folder_id"`
	Tags     []string `json:"tags"`
	MimeType *string  `json:"mime_type"` // "image" or "video" — filters MIME LIKE 'type/%'
	DateFrom *int64   `json:"date_from"` // epoch ms
	DateTo   *int64   `json:"date_to"`   // epoch ms
	Page     int      `json:"page"`
	Limit    int      `json:"limit"`
}

func (s *Service) DeleteAll(userID string) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	rows, err := tdb.Query("SELECT id, file_path FROM media WHERE user_id = $1", userID)
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

	if _, err := tdb.Exec("DELETE FROM media WHERE user_id = $1", userID); err != nil {
		return nil, fmt.Errorf("delete all media: %w", err)
	}

	return items, nil
}

func (s *Service) AutoCleanup(userID string, olderThan *int64) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	query := "SELECT id, file_path FROM media WHERE user_id = $1 AND is_trash = TRUE"
	args := []interface{}{userID}
	if olderThan != nil && *olderThan > 0 {
		query += fmt.Sprintf(" AND updated_at < $%d", len(args)+1)
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

	deleteQuery := "DELETE FROM media WHERE user_id = $1 AND is_trash = TRUE"
	deleteArgs := []interface{}{userID}
	if olderThan != nil && *olderThan > 0 {
		deleteQuery += fmt.Sprintf(" AND updated_at < $%d", len(deleteArgs)+1)
		deleteArgs = append(deleteArgs, *olderThan)
	}
	if _, err := tdb.Exec(deleteQuery, deleteArgs...); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
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
	defer tdb.Close()
	var total, tagged int
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND is_trash = FALSE", userID).Scan(&total)
	tdb.QueryRow("SELECT COUNT(DISTINCT media_id) FROM media_tags WHERE user_id = $1", userID).Scan(&tagged)
	return &AICountResponse{Total: total, Tagged: tagged}, nil
}

func (s *Service) CountScored(userID string) (*AIScoreResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var total, scored int
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND is_trash = FALSE", userID).Scan(&total)
	tdb.QueryRow("SELECT COUNT(*) FROM media WHERE user_id = $1 AND metadata IS NOT NULL AND metadata->>'aestheticScored' = 'true'", userID).Scan(&scored)
	return &AIScoreResponse{Total: total, Scored: scored}, nil
}

// buildSearchWhere assembles Search's filter set (F13 extraction): tenant
// scope, text search over title+metadata, folder, tags, mime and date range.
// The dedup-subquery placeholders are renumbered by the caller after the
// main args, so args here are only the main-query range.
func buildSearchWhere(userID string, params SearchParams) listFilters {
	f := listFilters{
		where: []string{"user_id = $1", "is_trash = FALSE"},
		args:  []interface{}{userID},
	}
	argIdx := 2

	// Text search — title OR metadata JSONB LIKE (matches Drizzle behaviour).
	if params.Query != "" {
		escaped := strings.ReplaceAll(params.Query, "%", "\\%")
		escaped = strings.ReplaceAll(escaped, "_", "\\_")
		qLike := "%" + strings.ToLower(escaped) + "%"
		f.where = append(f.where, fmt.Sprintf(
			"(LOWER(title) ILIKE $%[1]d ESCAPE '\\' OR (metadata IS NOT NULL AND LOWER(metadata::text) LIKE $%[1]d ESCAPE '\\'))",
			argIdx))
		f.args = append(f.args, qLike)
		argIdx++
	}

	if params.FolderID != nil && *params.FolderID != "" {
		f.where = append(f.where, fmt.Sprintf("folder_id = $%d", argIdx))
		f.args = append(f.args, *params.FolderID)
		argIdx++
	}

	if len(params.Tags) > 0 {
		tagPlaceholders := make([]string, len(params.Tags))
		for i, tag := range params.Tags {
			tagPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
			f.args = append(f.args, tag)
			argIdx++
		}
		f.where = append(f.where, fmt.Sprintf("id IN (SELECT media_id FROM media_tags WHERE user_id = $1 AND tag IN (%s))", strings.Join(tagPlaceholders, ",")))
	}

	// Mime type filter: "image" → mime_type LIKE 'image/%', "video" → LIKE 'video/%'.
	if params.MimeType != nil && *params.MimeType != "" {
		f.where = append(f.where, fmt.Sprintf("mime_type LIKE $%d", argIdx))
		f.args = append(f.args, *params.MimeType+"/%")
		argIdx++
	}

	// Date range on COALESCE(captured_at, created_at) — both epoch millis.
	const dateCol = "COALESCE(captured_at, created_at)"
	if params.DateFrom != nil {
		f.where = append(f.where, fmt.Sprintf("%s >= $%d", dateCol, argIdx))
		f.args = append(f.args, *params.DateFrom)
		argIdx++
	}
	if params.DateTo != nil {
		f.where = append(f.where, fmt.Sprintf("%s <= $%d", dateCol, argIdx))
		f.args = append(f.args, *params.DateTo)
		argIdx++
	}
	return f
}

// appendSearchDedup adds the one-row-per-hash dedup subquery to the Search
// filters. The subquery uses only the structural filters (no text/tags) so
// dedup stays consistent across queries; its $N placeholders are renumbered
// to follow the main-query args, covering ALL of them ($1 user_id included),
// else Postgres sees an arg count mismatch.
func appendSearchDedup(f *listFilters, userID string, params SearchParams) {
	const dateCol = "COALESCE(captured_at, created_at)"
	dedupBase := []string{"user_id = $1", "is_trash = FALSE"}
	dedupArgs := []interface{}{userID}
	dedupIdx := 2
	if params.FolderID != nil && *params.FolderID != "" {
		dedupBase = append(dedupBase, fmt.Sprintf("folder_id = $%d", dedupIdx))
		dedupArgs = append(dedupArgs, *params.FolderID)
		dedupIdx++
	}
	if params.MimeType != nil && *params.MimeType != "" {
		dedupBase = append(dedupBase, fmt.Sprintf("mime_type LIKE $%d", dedupIdx))
		dedupArgs = append(dedupArgs, *params.MimeType+"/%")
		dedupIdx++
	}
	if params.DateFrom != nil {
		dedupBase = append(dedupBase, fmt.Sprintf("%s >= $%d", dateCol, dedupIdx))
		dedupArgs = append(dedupArgs, *params.DateFrom)
		dedupIdx++
	}
	if params.DateTo != nil {
		dedupBase = append(dedupBase, fmt.Sprintf("%s <= $%d", dateCol, dedupIdx))
		dedupArgs = append(dedupArgs, *params.DateTo)
		dedupIdx++
	}
	dedupQuery := fmt.Sprintf("SELECT MIN(id) FROM media WHERE %s GROUP BY hash", strings.Join(dedupBase, " AND "))

	dedupOffset := len(f.args)
	rewritten := dedupQuery
	for i := dedupIdx - 1; i >= 1; i-- {
		rewritten = strings.Replace(rewritten, fmt.Sprintf("$%d", i), fmt.Sprintf("$%d", dedupOffset+i), 1)
	}
	f.args = append(f.args, dedupArgs...)
	f.where = append(f.where, "id IN ("+rewritten+")")
}

func (s *Service) Search(userID string, params SearchParams) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	f := buildSearchWhere(userID, params)
	appendSearchDedup(&f, userID, params)
	whereClause := strings.Join(f.where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media WHERE %s", whereClause)
	if err := tdb.QueryRow(countQuery, f.args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count search: %w", err)
	}

	// Clamp pagination the same way List does — Search without LIMIT returns
	// the whole library in one payload.
	if params.Limit <= 0 || params.Limit > 200 {
		params.Limit = 100
	}
	if params.Page < 1 {
		params.Page = 1
	}

	query := fmt.Sprintf(`SELECT %s
		FROM media WHERE %s ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`,
		mediaSelectCols, whereClause, params.Limit, (params.Page-1)*params.Limit)

	items, err := scanMediaRows(tdb, query, f.args)
	if err != nil {
		return nil, fmt.Errorf("query search: %w", err)
	}
	return &ListResponse{Items: items, Total: total}, nil
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
	defer tdb.Close()

	// Clamp pagination like List does — the dashboard used to SELECT the whole
	// library with no LIMIT on every login.
	if params.Limit <= 0 || params.Limit > 200 {
		params.Limit = 100
	}
	if params.Page < 1 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit

	where := []string{"user_id = $1", "is_trash = FALSE", "is_vault = FALSE"}
	args := []interface{}{userID}
	argIdx := 2

	if params.FolderID != nil && len(params.Categories) == 0 {
		if *params.FolderID == "" {
			where = append(where, "folder_id IS NULL")
		} else {
			where = append(where, fmt.Sprintf("folder_id = $%d", argIdx))
			args = append(args, *params.FolderID)
			argIdx++
		}
	}
	if params.IsFavorite {
		where = append(where, "is_favorite = TRUE")
	}

	var items []MediaItem
	var total int

	if len(params.Categories) > 0 {
		items, total, err = s.querySmartFolderMedia(tdb, userID, params, where, args, argIdx, offset)
	} else {
		items, total, err = s.queryDedupedMedia(tdb, where, args, params.Limit, offset)
	}
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []MediaItem{}
	}

	// Compute folder counts
	folderCounts, err := computeFolderCounts(tdb, userID)
	if err != nil {
		return nil, fmt.Errorf("folder counts: %w", err)
	}

	return &DashboardResponse{Items: items, Total: total, FolderCounts: folderCounts}, nil
}

const dashboardSelectCols = `id, title, file_path, mime_type, size, width, height, hash,
	folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
	metadata, duration, transcode_status`

// queryDedupedMedia returns one row per hash (earliest id) for the plain
// (non-smart) dashboard view.
func (s *Service) queryDedupedMedia(tdb *db.TenantDB, where []string, args []interface{}, limit, offset int) ([]MediaItem, int, error) {
	whereClause := strings.Join(where, " AND ")

	var total int
	tdb.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE %s GROUP BY hash)", whereClause), args...).Scan(&total)

	q := fmt.Sprintf(`SELECT %s FROM media WHERE id IN (
		SELECT MIN(id) FROM media WHERE %s GROUP BY hash
	) ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`, dashboardSelectCols, whereClause, limit, offset)

	items, err := scanMediaRows(tdb, q, args)
	return items, total, err
}

// querySmartFolderMedia intersects category/score-matching tag IDs with the
// base dashboard filters, then returns deduped, offset-paged media.
func (s *Service) querySmartFolderMedia(tdb *db.TenantDB, userID string, params DashboardParams, where []string, args []interface{}, argIdx, offset int) ([]MediaItem, int, error) {
	tagArgs := []interface{}{userID} // $1 = user_id
	catPlaceholders := make([]string, len(params.Categories))
	for i, cat := range params.Categories {
		catPlaceholders[i] = fmt.Sprintf("$%d", i+2)
		tagArgs = append(tagArgs, cat)
	}
	minScoreIdx := len(params.Categories) + 2
	tagArgs = append(tagArgs, params.MinScore)

	// Inline the tag match as a subquery instead of materializing the ID list
	// in Go and re-inlining it as N placeholders: a broad category/score
	// match could pull tens of thousands of IDs into memory and blow up the
	// follow-up query text. IN (subquery) is set-equivalent here (F9).
	idSubquery := fmt.Sprintf(`id IN (
		SELECT DISTINCT media_id FROM media_tags
		WHERE user_id = $1 AND category IN (%s) AND score >= $%d
	)`, strings.Join(catPlaceholders, ","), minScoreIdx)

	where = append(where, idSubquery)
	args = append(args, tagArgs[1:]...) // $1 (user_id) already present in base args
	whereClause := strings.Join(where, " AND ")

	var total int
	tdb.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE %s GROUP BY hash)", whereClause), args...).Scan(&total)

	q := fmt.Sprintf(`SELECT %s FROM media WHERE id IN (
		SELECT MIN(id) FROM media WHERE %s GROUP BY hash
	) ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`, dashboardSelectCols, whereClause, params.Limit, offset)

	items, err := scanMediaRows(tdb, q, args)
	return items, total, err
}

// scanMediaRows runs a media SELECT and scans all rows into MediaItems.
func scanMediaRows(tdb *db.TenantDB, q string, args []interface{}) ([]MediaItem, error) {
	rows, err := tdb.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("query media: %w", err)
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
	return items, nil
}

func computeFolderCounts(tdb *db.TenantDB, userID string) (map[string]int, error) {
	folderCounts := map[string]int{}

	rows, err := tdb.Query(
		`SELECT f.id, COUNT(DISTINCT m.id) FROM folders f
		LEFT JOIN media m ON m.folder_id = f.id AND m.is_trash = FALSE AND m.is_vault = FALSE AND m.user_id = $1
		WHERE f.user_id = $1
		GROUP BY f.id`,
		userID,
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
		`SELECT COUNT(*) FROM (SELECT MIN(id) FROM media WHERE user_id = $1 AND is_trash = FALSE AND is_vault = FALSE AND folder_id IS NULL GROUP BY hash)`,
		userID,
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
const maxExactDuplicateRows = 1000

// maxEmbeddedItems caps the embedded-media scan for near-duplicate detection
// (the clustering pass is O(n^2) over what this query returns).
const maxEmbeddedItems = 1000

type embeddedItem struct {
	item      MediaItem
	embedding []float64
}

func (s *Service) GetDuplicates(userID string) (*DuplicatesResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	exactGroups, exactHashes, err := s.queryExactDuplicates(tdb, userID, selectCols)
	if err != nil {
		return nil, err
	}

	withEmb, err := s.queryEmbeddedItems(tdb, userID, selectCols)
	if err != nil {
		return nil, err
	}
	nearGroups := clusterNearDuplicates(withEmb, exactHashes)

	groups := append(exactGroups, nearGroups...)
	if groups == nil {
		groups = []DuplicateGroup{}
	}
	return &DuplicatesResponse{Groups: groups}, nil
}

// queryExactDuplicates returns groups of media sharing a content hash.
func (s *Service) queryExactDuplicates(tdb *db.TenantDB, userID, selectCols string) ([]DuplicateGroup, map[string]bool, error) {
	rows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE user_id = $1 AND is_trash = FALSE AND hash IN (
			SELECT hash FROM media WHERE user_id = $1 AND is_trash = FALSE GROUP BY hash HAVING COUNT(*) > 1
		) ORDER BY hash ASC, created_at DESC, id DESC LIMIT %d`, selectCols, maxExactDuplicateRows), userID)
	if err != nil {
		return nil, nil, fmt.Errorf("query exact dupes: %w", err)
	}
	defer rows.Close()

	groupMap := map[string][]MediaItem{}
	var hashOrder []string
	for rows.Next() {
		item, err := scanMediaItem(rows)
		if err != nil {
			return nil, nil, fmt.Errorf("scan: %w", err)
		}
		if _, ok := groupMap[item.Hash]; !ok {
			hashOrder = append(hashOrder, item.Hash)
		}
		groupMap[item.Hash] = append(groupMap[item.Hash], *item)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("rows: %w", err)
	}

	var groups []DuplicateGroup
	exactHashes := map[string]bool{}
	for _, hash := range hashOrder {
		groups = append(groups, DuplicateGroup{
			ID:              "exact-" + hash[:min(8, len(hash))],
			Hash:            hash,
			Items:           groupMap[hash],
			IsNearDuplicate: false,
		})
		exactHashes[hash] = true
	}
	return groups, exactHashes, nil
}

// queryEmbeddedItems loads non-trash media carrying an AI embedding, capped
// at maxEmbeddedItems rows — near-duplicate clustering is O(n^2) over this
// slice, so the load must be bounded no matter how large the library is.
func (s *Service) queryEmbeddedItems(tdb *db.TenantDB, userID, selectCols string) ([]embeddedItem, error) {
	allRows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE user_id = $1 AND is_trash = FALSE AND metadata IS NOT NULL
		ORDER BY created_at DESC, id DESC LIMIT %d`, selectCols, maxEmbeddedItems), userID)
	if err != nil {
		return nil, fmt.Errorf("query all media: %w", err)
	}
	defer allRows.Close()

	var withEmb []embeddedItem
	for allRows.Next() {
		item, err := scanMediaItem(allRows)
		if err != nil || item.Metadata == nil {
			continue
		}
		var meta struct {
			Embedding []float64 `json:"embedding"`
		}
		if err := json.Unmarshal([]byte(*item.Metadata), &meta); err != nil || len(meta.Embedding) == 0 {
			continue
		}
		withEmb = append(withEmb, embeddedItem{item: *item, embedding: meta.Embedding})
	}
	if len(withEmb) >= maxEmbeddedItems {
		log.Printf("Near-duplicate scan capped at %d embedded items (library has more; newest items scanned first)", maxEmbeddedItems)
	}
	return withEmb, nil
}

// clusterNearDuplicates groups embedded items by cosine similarity, skipping
// items over the cap and clusters already covered by exact-hash groups.
func clusterNearDuplicates(withEmb []embeddedItem, exactHashes map[string]bool) []DuplicateGroup {
	if len(withEmb) < 2 {
		return nil
	}
	if len(withEmb) > maxNearDuplicates {
		log.Printf("Near-duplicate detection skipped: %d embedded items exceed limit of %d", len(withEmb), maxNearDuplicates)
		return nil
	}

	var nearGroups []DuplicateGroup
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
			if !clusterHasExactHash(cluster, exactHashes) {
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
	return nearGroups
}

func clusterHasExactHash(cluster []MediaItem, exactHashes map[string]bool) bool {
	for _, it := range cluster {
		if exactHashes[it.Hash] {
			return true
		}
	}
	return false
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
