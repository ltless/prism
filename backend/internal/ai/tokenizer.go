package ai

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

var preTokenizeRe = regexp.MustCompile(
	`<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+`,
)

type bpePair struct{ a, b string }

type Tokenizer struct {
	vocab   map[string]int32
	merges  []bpePair
	rank    map[string]int
	startID int32
	endID   int32
}

func NewTokenizer(vocabPath, mergesPath string) (*Tokenizer, error) {
	t := &Tokenizer{
		vocab:   make(map[string]int32),
		rank:    make(map[string]int),
		startID: 49406,
		endID:   49407,
	}

	vf, err := os.Open(vocabPath)
	if err != nil {
		return nil, fmt.Errorf("open vocab: %w", err)
	}
	defer vf.Close()
	if err := json.NewDecoder(vf).Decode(&t.vocab); err != nil {
		return nil, fmt.Errorf("decode vocab: %w", err)
	}

	data, err := os.ReadFile(mergesPath)
	if err != nil {
		return nil, fmt.Errorf("read merges: %w", err)
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) == 2 {
			p := bpePair{parts[0], parts[1]}
			t.merges = append(t.merges, p)
			t.rank[parts[0]+" "+parts[1]] = len(t.merges) - 1
		}
	}

	if _, ok := t.vocab["<|startoftext|>"]; ok {
		t.startID = t.vocab["<|startoftext|>"]
	}
	if _, ok := t.vocab["<|endoftext|>"]; ok {
		t.endID = t.vocab["<|endoftext|>"]
	}

	return t, nil
}

func (t *Tokenizer) Encode(text string) []int64 {
	tokens := preTokenizeRe.FindAllString(strings.ToLower(strings.TrimSpace(text)), -1)
	if tokens == nil {
		tokens = []string{text}
	}

	var ids []int64
	ids = append(ids, int64(t.startID))

	hasContent := false
	for _, token := range tokens {
		subwords := t.bpe(token)
		for _, sw := range subwords {
			if id, ok := t.vocab[sw]; ok {
				ids = append(ids, int64(id))
				hasContent = true
				if len(ids) >= 75 {
					goto pad
				}
			}
		}
	}
	ids = append(ids, int64(t.endID))

pad:
	for len(ids) < 77 {
		ids = append(ids, 0)
	}
	if len(ids) > 77 {
		ids = ids[:76]
		ids = append(ids, int64(t.endID))
	}

	if !hasContent {
		if errID, ok := t.vocab["<|unk|>"]; ok {
			ids = []int64{int64(t.startID), int64(errID), int64(t.endID)}
			for len(ids) < 77 {
				ids = append(ids, 0)
			}
		}
	}

	return ids
}

func (t *Tokenizer) bpe(word string) []string {
	if len(word) <= 1 {
		return []string{word}
	}

	chars := strings.Split(word, "")
	if len(chars) <= 1 {
		return chars
	}

	for {
		bestPair := ""
		bestIdx := -1

		for i := 0; i < len(chars)-1; i++ {
			pair := chars[i] + " " + chars[i+1]
			if rank, ok := t.rank[pair]; ok {
				if bestIdx == -1 || rank < bestIdx {
					bestPair = chars[i] + " " + chars[i+1]
					bestIdx = rank
				}
			}
		}

		if bestIdx == -1 {
			break
		}

		parts := strings.SplitN(bestPair, " ", 2)
		if len(parts) != 2 {
			break
		}
		a, b := parts[0], parts[1]

		var merged []string
		for i := 0; i < len(chars); i++ {
			if i < len(chars)-1 && chars[i] == a && chars[i+1] == b {
				merged = append(merged, a+b)
				i++
			} else {
				merged = append(merged, chars[i])
			}
		}
		chars = merged

		if len(chars) <= 1 {
			break
		}
	}

	return chars
}

func (t *Tokenizer) EncodeTexts(texts []string) ([]int64, []int64) {
	n := len(texts)
	inputIDs := make([]int64, n*77)
	attentionMask := make([]int64, n*77)
	for i, text := range texts {
		ids := t.Encode(text)
		copy(inputIDs[i*77:(i+1)*77], ids)
		for j := 0; j < 77; j++ {
			if ids[j] != 0 {
				attentionMask[i*77+j] = 1
			}
		}
	}
	return inputIDs, attentionMask
}
