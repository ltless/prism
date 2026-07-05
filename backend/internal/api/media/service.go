package media

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ltless/prism/internal/db"
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
	pool *db.TenantPool
}

func NewService(pool *db.TenantPool) *Service {
	return &Service{pool: pool}
}

func (s *Service) List(userID string, folderID *string, favorites, trash bool, search string, page, limit int) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	where := []string{"1=1", "is_vault = 0"}
	args := []interface{}{}

	if folderID != nil {
		where = append(where, "folder_id = ?")
		args = append(args, *folderID)
	}
	if favorites {
		where = append(where, "is_favorite = 1")
	}
	if trash {
		where = append(where, "is_trash = 1")
	} else {
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
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media WHERE %s", whereClause)
	if err := tdb.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count media: %w", err)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	query := fmt.Sprintf(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE %s ORDER BY created_at DESC LIMIT ? OFFSET ?`, whereClause)
	args = append(args, limit, offset)

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

func (s *Service) Create(userID, folderID, filePath, title, mimeType, hash string, size int64, width, height *int) (*MediaItem, bool, error) {
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

	res, err := tdb.Exec(
		`INSERT OR IGNORE INTO media (id, title, file_path, mime_type, size, width, height, hash, folder_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, title, filePath, mimeType, size, width, height, hash, fID, now, now,
	)
	if err != nil {
		return nil, false, fmt.Errorf("insert media: %w", err)
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return nil, true, nil
	}

	return &MediaItem{
		ID:       id,
		Title:    title,
		FilePath: filePath,
		MimeType: mimeType,
		Size:     size,
		Hash:     hash,
		FolderID: fID,
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
	err = tdb.QueryRow("SELECT id FROM media WHERE hash = ? LIMIT 1", hash).Scan(&existing)
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

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 50
	}
	offset := (params.Page - 1) * params.Limit

	query := fmt.Sprintf(`SELECT id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status
		FROM media WHERE %s ORDER BY created_at DESC LIMIT ? OFFSET ?`, whereClause)
	searchArgs := append(args, params.Limit, offset)

	rows, err := tdb.Query(query, searchArgs...)
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
