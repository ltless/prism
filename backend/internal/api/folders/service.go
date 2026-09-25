package folders

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ltless/prism/internal/db"
)

type FolderItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Color       string  `json:"color"`
	FolderType  string  `json:"folder_type"`
	ParentID    *string `json:"parent_id"`
	FilterQuery *string `json:"filter_query"`
	CreatedAt   int64   `json:"created_at"`
	UpdatedAt   int64   `json:"updated_at"`
}

type ListResponse struct {
	Items []FolderItem `json:"items"`
}

type Service struct {
	pool *db.TenantPool
}

func NewService(pool *db.TenantPool) *Service {
	return &Service{pool: pool}
}

func (s *Service) List(ctx context.Context, userID string) (*ListResponse, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	rows, err := tdb.Query(ctx, "SELECT id, name, color, folder_type, parent_id, filter_query, created_at, updated_at FROM folders WHERE user_id = $1 ORDER BY name ASC", userID)
	if err != nil {
		return nil, fmt.Errorf("query folders: %w", err)
	}
	defer rows.Close()

	var items []FolderItem
	for rows.Next() {
		var item FolderItem
		var parentID, filterQuery sql.NullString
		if err := rows.Scan(&item.ID, &item.Name, &item.Color, &item.FolderType, &parentID, &filterQuery, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan folder: %w", err)
		}
		if parentID.Valid {
			item.ParentID = &parentID.String
		}
		if filterQuery.Valid {
			item.FilterQuery = &filterQuery.String
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return &ListResponse{Items: items}, nil
}

func (s *Service) Create(ctx context.Context, userID, name, color, folderType, filterQuery string) (*FolderItem, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	id := uuid.New().String()
	now := time.Now().Unix()

	if color == "" {
		color = "zinc"
	}
	if folderType == "" {
		folderType = "regular"
	}

	var fq *string
	if filterQuery != "" {
		fq = &filterQuery
	}

	_, err = tdb.Exec(ctx,
		"INSERT INTO folders (id, user_id, name, color, folder_type, filter_query, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
		id, userID, name, color, folderType, fq, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert folder: %w", err)
	}

	return &FolderItem{
		ID:          id,
		Name:        name,
		Color:       color,
		FolderType:  folderType,
		FilterQuery: fq,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (s *Service) Update(ctx context.Context, userID, id, name string) error {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	now := time.Now().Unix()
	_, err = tdb.Exec(ctx, "UPDATE folders SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4", name, now, id, userID)
	return err
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
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

	now := time.Now().Unix()
	if _, err := tx.Exec("UPDATE media SET folder_id = NULL, updated_at = $1 WHERE folder_id = $2 AND user_id = $3", now, id, userID); err != nil {
		return fmt.Errorf("unlink media: %w", err)
	}

	if _, err := tx.Exec("DELETE FROM folders WHERE id = $1 AND user_id = $2", id, userID); err != nil {
		return fmt.Errorf("delete folder: %w", err)
	}

	return tx.Commit()
}
