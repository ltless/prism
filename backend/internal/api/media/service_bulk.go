package media

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (s *Service) BulkMove(ctx context.Context, userID string, mediaIDs []string, folderID *string) error {
	tdb, err := s.pool.Get(ctx, userID)
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
	_, err = tdb.Exec(ctx, query, args...)
	return err
}

// bulkField is a boolean media column that BulkSetField may update. A closed
// type: values outside the constants below cannot be formed outside this
// package, so a column name can never arrive from user input.
type bulkField string

const (
	FieldFavorite bulkField = "is_favorite"
	FieldTrash    bulkField = "is_trash"
	FieldVault    bulkField = "is_vault"
)

func (s *Service) BulkSetField(ctx context.Context, userID string, mediaIDs []string, field bulkField, value bool) error {
	switch field {
	case FieldFavorite, FieldTrash, FieldVault:
	default:
		// Unreachable through the public API today; a safety net for future
		// callers, not a validation of user input.
		return fmt.Errorf("invalid bulk field: %q", field)
	}
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	now := time.Now().Unix()
	placeholders := make([]string, len(mediaIDs))
	args := make([]interface{}, 0, len(mediaIDs)+3)
	args = append(args, value, now, userID) // $1, $2, $3
	for i, id := range mediaIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+4)
		args = append(args, id)
	}
	query := fmt.Sprintf("UPDATE media SET %s = $1, updated_at = $2 WHERE user_id = $3 AND id IN (%s)", string(field), strings.Join(placeholders, ","))
	_, err = tdb.Exec(ctx, query, args...)
	return err
}

type TrashedItem struct {
	ID       string `json:"id"`
	FilePath string `json:"file_path"`
}

func (s *Service) EmptyTrash(ctx context.Context, userID string) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	rows, err := tdb.Query(ctx, "SELECT id, file_path FROM media WHERE user_id = $1 AND is_trash = TRUE", userID)
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

	if _, err := tdb.Exec(ctx, "DELETE FROM media WHERE user_id = $1 AND is_trash = TRUE", userID); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
}

func (s *Service) ResolveDuplicate(ctx context.Context, userID, keepID string, deleteIDs []string) error {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	tx, err := tdb.Begin(ctx)
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

func (s *Service) DeleteAll(ctx context.Context, userID string) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	rows, err := tdb.Query(ctx, "SELECT id, file_path FROM media WHERE user_id = $1", userID)
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

	if _, err := tdb.Exec(ctx, "DELETE FROM media WHERE user_id = $1", userID); err != nil {
		return nil, fmt.Errorf("delete all media: %w", err)
	}

	return items, nil
}

func (s *Service) AutoCleanup(ctx context.Context, userID string, olderThan *int64) ([]TrashedItem, error) {
	tdb, err := s.pool.Get(ctx, userID)
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

	rows, err := tdb.Query(ctx, query, args...)
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
	if _, err := tdb.Exec(ctx, deleteQuery, deleteArgs...); err != nil {
		return nil, fmt.Errorf("delete trashed: %w", err)
	}

	return items, nil
}
