package media

import (
	"context"
	"fmt"
	"strings"
)

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

	if vault {
		f.where = append(f.where, "is_vault = TRUE")
	} else {
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
	} else {
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

type SearchParams struct {
	Query    string   `json:"query"`
	FolderID *string  `json:"folder_id"`
	Tags     []string `json:"tags"`
	MimeType *string  `json:"mime_type"` // "image" or "video" — filters MIME LIKE 'type/%'
	DateFrom *int64   `json:"date_from"` // epoch ms
	DateTo   *int64   `json:"date_to"`   // epoch ms
	Page     int      `json:"page"`
	Limit    int      `json:"limit"`
	// IncludeVault allows vault items in results. Set by the handler only when
	// the caller holds a valid vault-unlock token; otherwise search would leak
	// vault items.
	IncludeVault bool
	// NameOnly restricts the text match to the file title. Off by default,
	// so a query also hits AI tags inside metadata.
	NameOnly bool
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
	if !params.IncludeVault {
		f.where = append(f.where, "is_vault = FALSE")
	}
	argIdx := 2

	// Text search. Name matches the title; describe also matches AI tags
	// stored in metadata (the Drizzle behaviour).
	if params.Query != "" {
		escaped := strings.ReplaceAll(params.Query, "%", "\\%")
		escaped = strings.ReplaceAll(escaped, "_", "\\_")
		qLike := "%" + strings.ToLower(escaped) + "%"
		clause := "LOWER(title) ILIKE $%[1]d ESCAPE '\\'"
		if !params.NameOnly {
			clause = "(" + clause + " OR (metadata IS NOT NULL AND LOWER(metadata::text) LIKE $%[1]d ESCAPE '\\'))"
		}
		f.where = append(f.where, fmt.Sprintf(clause, argIdx))
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
	if !params.IncludeVault {
		dedupBase = append(dedupBase, "is_vault = FALSE")
	}
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

func (s *Service) Search(ctx context.Context, userID string, params SearchParams) (*ListResponse, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	f := buildSearchWhere(userID, params)
	appendSearchDedup(&f, userID, params)
	whereClause := strings.Join(f.where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media WHERE %s", whereClause)
	if err := tdb.QueryRow(ctx, countQuery, f.args...).Scan(&total); err != nil {
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

	items, err := scanMediaRows(ctx, tdb, query, f.args)
	if err != nil {
		return nil, fmt.Errorf("query search: %w", err)
	}
	return &ListResponse{Items: items, Total: total}, nil
}
