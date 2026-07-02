package media

import (
	"regexp"
	"strconv"
)

// controlCharRe matches raw control bytes (0x00-0x1F, 0x7F) and their JSON
// unicode escape forms (\u0000-\u001f, \u007f). Go's json.Marshal encodes
// control chars as \u00XX escape sequences, so after marshaling the raw bytes
// are gone — only escapes remain. PostgreSQL JSONB rejects \u0000 with
// SQLSTATE 22P05. We strip all control char escapes to be safe.
var controlCharRe = regexp.MustCompile(`[\x00-\x1f\x7f]|\\u000[0-9a-fA-F]|\\u001[0-9a-fA-F]|\\u007[fF]`)

// sanitizeMetadata strips control characters from a JSON string so it can be
// safely stored in a PostgreSQL JSONB column.
func sanitizeMetadata(s string) string {
	return controlCharRe.ReplaceAllString(s, "")
}

func parseInt(s string) int {
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
