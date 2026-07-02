package media

import (
	"fmt"
	"github.com/ltless/prism/internal/db"
	"strings"
)

type DashboardResponse struct {
	Items        []MediaItem    `json:"items"`
	Total        int            `json:"total"`
	FolderCounts map[string]int `json:"folderCounts"`
}

type DashboardParams struct {
	FolderID   *string
	IsFavorite bool
	Categories []string
	MinScore   float64
	Page       int
	Limit      int
	// IncludeVault admits vault items. Set by the handler only when a valid
	// vault-unlock token is present; otherwise the dashboard would be a side
	// channel to enumerate vault media.
	IncludeVault bool
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

	where := []string{"user_id = $1", "is_trash = FALSE"}
	args := []interface{}{userID}
	argIdx := 2
	if !params.IncludeVault {
		where = append(where, "is_vault = FALSE")
	}

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
	folderCounts, err := computeFolderCounts(tdb, userID, params.IncludeVault)
	if err != nil {
		return nil, fmt.Errorf("folder counts: %w", err)
	}

	return &DashboardResponse{Items: items, Total: total, FolderCounts: folderCounts}, nil
}

const dashboardSelectCols = `id, title, file_path, mime_type, size, width, height, hash,
	folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
	metadata, duration, transcode_status`

// queryDedupedMedia returns one row per hash — the earliest upload — for the
// plain (non-smart) dashboard view.
func (s *Service) queryDedupedMedia(tdb *db.TenantDB, where []string, args []interface{}, limit, offset int) ([]MediaItem, int, error) {
	whereClause := strings.Join(where, " AND ")

	var total int
	if err := tdb.QueryRow(
		fmt.Sprintf("SELECT COUNT(DISTINCT hash) FROM media WHERE %s", whereClause),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count deduped media: %w", err)
	}

	q := fmt.Sprintf(`SELECT %s FROM (
		SELECT DISTINCT ON (hash) %s FROM media WHERE %s
		ORDER BY hash, created_at ASC, id ASC
	) AS deduped ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`,
		dashboardSelectCols, dashboardSelectCols, whereClause, limit, offset)

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
	if err := tdb.QueryRow(
		fmt.Sprintf("SELECT COUNT(DISTINCT hash) FROM media WHERE %s", whereClause),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count deduped media: %w", err)
	}

	q := fmt.Sprintf(`SELECT %s FROM (
		SELECT DISTINCT ON (hash) %s FROM media WHERE %s
		ORDER BY hash, created_at ASC, id ASC
	) AS deduped ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d`,
		dashboardSelectCols, dashboardSelectCols, whereClause, params.Limit, offset)

	items, err := scanMediaRows(tdb, q, args)
	return items, total, err
}

func computeFolderCounts(tdb *db.TenantDB, userID string, includeVault bool) (map[string]int, error) {
	folderCounts := map[string]int{}

	vaultClause := "AND m.is_vault = FALSE"
	if includeVault {
		vaultClause = ""
	}

	rows, err := tdb.Query(
		`SELECT f.id, COUNT(DISTINCT m.id) FROM folders f
		LEFT JOIN media m ON m.folder_id = f.id AND m.is_trash = FALSE `+vaultClause+` AND m.user_id = $1
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
	if err := tdb.QueryRow(
		`SELECT COUNT(DISTINCT hash) FROM media WHERE user_id = $1 AND is_trash = FALSE AND is_vault = FALSE AND folder_id IS NULL`,
		userID,
	).Scan(&inbox); err != nil {
		return nil, fmt.Errorf("count inbox media: %w", err)
	}
	folderCounts["__inbox__"] = inbox

	return folderCounts, nil
}
