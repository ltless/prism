package folders

import (
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
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
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

func (s *Service) List(userID string) (*ListResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	rows, err := tdb.Query("SELECT id, name, color, folder_type, parent_id, filter_query, created_at, updated_at FROM folders ORDER BY name ASC")
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

func (s *Service) Create(userID, name, color, folderType, filterQuery string) (*FolderItem, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}

	id := uuid.New().String()
	now := 	time.Now().Unix()

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

	_, err = tdb.Exec(
		"INSERT INTO folders (id, name, color, folder_type, filter_query, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, name, color, folderType, fq, now, now,
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

func (s *Service) Update(userID, id, name string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	now := 	time.Now().Unix()
	_, err = tdb.Exec("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?", name, now, id)
	return err
}

func (s *Service) Delete(userID, id string) error {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return fmt.Errorf("get tenant db: %w", err)
	}

	now := 	time.Now().Unix()
	if _, err := tdb.Exec("UPDATE media SET folder_id = NULL, updated_at = ? WHERE folder_id = ?", now, id); err != nil {
		return fmt.Errorf("unlink media: %w", err)
	}

	_, err = tdb.Exec("DELETE FROM folders WHERE id = ?", id)
	return err
}
