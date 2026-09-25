package media

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/ltless/prism/internal/db"
)

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

// mediaSelectCols is the standard media column list shared by List/Get/Search
// and the duplicate/dashboard queries.
const mediaSelectCols = `id, title, file_path, mime_type, size, width, height, hash,
	folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
	metadata, duration, transcode_status`

// scanMediaPageWithTotal runs a paged media SELECT carrying a COUNT(*) OVER()
// total column and drains it into items + total.
func scanMediaPageWithTotal(ctx context.Context, tdb *db.TenantDB, query, totalCol string, args []interface{}) ([]MediaItem, int, error) {
	rows, err := tdb.Query(ctx, query, args...)
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

// scanMediaRows runs a media SELECT and scans all rows into MediaItems.
func scanMediaRows(ctx context.Context, tdb *db.TenantDB, q string, args []interface{}) ([]MediaItem, error) {
	rows, err := tdb.Query(ctx, q, args...)
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
