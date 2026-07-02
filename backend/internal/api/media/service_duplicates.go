package media

import (
	"encoding/json"
	"fmt"
	"github.com/ltless/prism/internal/db"
	"log"
)

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

func (s *Service) GetDuplicates(userID string, includeVault bool) (*DuplicatesResponse, error) {
	tdb, err := s.pool.Get(userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	exactGroups, exactHashes, err := s.queryExactDuplicates(tdb, userID, selectCols, includeVault)
	if err != nil {
		return nil, err
	}

	withEmb, err := s.queryEmbeddedItems(tdb, userID, selectCols, includeVault)
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
func (s *Service) queryExactDuplicates(tdb *db.TenantDB, userID, selectCols string, includeVault bool) ([]DuplicateGroup, map[string]bool, error) {
	exactVault := " AND is_vault = FALSE "
	if includeVault {
		exactVault = " "
	}
	rows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE user_id = $1 AND is_trash = FALSE %sAND hash IN (
			SELECT hash FROM media WHERE user_id = $1 AND is_trash = FALSE %sGROUP BY hash HAVING COUNT(*) > 1
		) ORDER BY hash ASC, created_at DESC, id DESC LIMIT %d`, selectCols, exactVault, exactVault, maxExactDuplicateRows), userID)
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
func (s *Service) queryEmbeddedItems(tdb *db.TenantDB, userID, selectCols string, includeVault bool) ([]embeddedItem, error) {
	vaultClause := " AND is_vault = FALSE"
	if includeVault {
		vaultClause = ""
	}
	allRows, err := tdb.Query(fmt.Sprintf(
		`SELECT %s FROM media WHERE user_id = $1 AND is_trash = FALSE%s AND metadata IS NOT NULL
		ORDER BY created_at DESC, id DESC LIMIT %d`, selectCols, vaultClause, maxEmbeddedItems), userID)
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
