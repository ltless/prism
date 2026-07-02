package ai

import (
	"math"
	"sort"
)

var TAG_TAXONOMY = map[string][]string{
	"People":      {"person", "people", "portrait", "group", "selfie", "baby", "family", "man", "woman", "child", "kid", "toddler", "elderly", "couple", "crowd", "friends"},
	"Nature":      {"nature", "landscape", "mountain", "forest", "tree", "flower", "plant", "garden", "desert", "jungle", "canyon", "field", "meadow", "hills", "cliff", "grass", "rock"},
	"Water":       {"ocean", "beach", "sea", "lake", "river", "water", "underwater", "wave", "coral", "waterfall", "swimming-pool", "pond", "stream", "creek"},
	"Sky & Light": {"sunset", "sunrise", "sky", "cloud", "night", "moon", "star", "milky-way", "aurora", "golden-hour", "blue-hour", "twilight", "morning", "afternoon", "evening", "sunlight", "lens-flare", "bokeh", "backlight"},
	"Urban":       {"city", "urban", "building", "architecture", "bridge", "street", "road", "alley", "skyline", "indoor", "room", "house", "home", "office", "warehouse", "studio", "subway", "skyscrapers", "monument", "cafe", "restaurant", "living-room", "bedroom"},
	"Food":        {"food", "drink", "meal", "kitchen", "coffee", "dessert", "fruit", "bread", "vegetables", "meat", "rice", "pasta", "pizza", "burger", "sushi", "tea", "beer", "wine"},
	"Animals":     {"animal", "pet", "dog", "cat", "bird", "horse", "wildlife", "fish", "butterfly", "insect", "reptile", "deer", "squirrel", "lion", "tiger", "bear", "elephant"},
	"Vehicles":    {"vehicle", "car", "bicycle", "airplane", "train", "boat", "motorcycle", "truck", "bus", "scooter", "ship", "yacht", "helicopter"},
	"Sport":       {"sport", "fitness", "running", "biking", "soccer", "basketball", "swimming", "yoga", "fitness-model", "bodybuilder", "muscle", "athletic", "tennis", "golf", "badminton", "baseball", "gym", "climbing", "surfing", "skiing", "skateboarding"},
	"Art":         {"art", "museum", "statue", "painting", "sculpture", "graffiti", "tattoo", "drawing", "sketch", "illustration", "digital-art", "crafts", "calligraphy"},
	"Events":      {"event", "concert", "wedding", "party", "celebration", "festival", "parade", "concert-stage", "birthday", "anniversary", "graduation", "performance"},
	"Travel":      {"travel", "vacation", "adventure", "camping", "road-trip", "hiking", "luggage", "passport", "sightseeing", "hotel", "resort", "map", "backpack"},
	"Technology":  {"technology", "computer", "phone", "screen", "robot", "drone", "gadget", "smartphone", "laptop", "keyboard", "mouse", "headphones", "camera", "tv"},
	"Abstract":    {"abstract", "pattern", "texture", "colorful", "dark", "light", "geometric", "symmetry", "minimalist", "vintage", "retro", "modern", "classic", "industrial", "rustic", "grunge", "gradient", "smoke", "fire", "water-drops", "neon"},
	"Weather":     {"rain", "snow", "fog", "storm", "rainbow", "lightning", "mist", "sunny", "windy", "snowy", "rainy", "foggy", "cloudy"},
	"Photography": {"macro", "aerial", "panorama", "reflection", "silhouette", "shadow", "long-exposure", "macro-lens", "wide-angle", "telephoto", "drone-shot", "fish-eye"},
	"Fashion":     {"fashion", "jewelry", "perfume", "cosmetic", "portrait-studio", "dress", "suit", "shoes", "glasses", "watch", "bag", "makeup", "hairstyle", "clothes"},
	"Sensitive":   {"naked", "nude", "lingerie", "underwear", "swimsuit", "bikini", "beachwear", "boudoir", "sensual", "erotic", "implied-nudity", "topless"},
}

var TAG_CANDIDATES []string
var TAG_TO_CATEGORY map[string]string

func init() {
	for _, tags := range TAG_TAXONOMY {
		for _, tag := range tags {
			TAG_CANDIDATES = append(TAG_CANDIDATES, tag)
		}
	}
	TAG_TO_CATEGORY = make(map[string]string, len(TAG_CANDIDATES))
	for cat, tags := range TAG_TAXONOMY {
		for _, tag := range tags {
			TAG_TO_CATEGORY[tag] = cat
		}
	}
}

type TagResult struct {
	Tag      string  `json:"tag"`
	Score    float32 `json:"score"`
	Category string  `json:"category"`
}

func softmax(logits []float32) []float32 {
	var max float32
	for _, v := range logits {
		if v > max {
			max = v
		}
	}
	var sum float64
	probs := make([]float32, len(logits))
	for i, v := range logits {
		probs[i] = float32(math.Exp(float64(v - max)))
		sum += float64(probs[i])
	}
	if sum > 0 {
		for i := range probs {
			probs[i] /= float32(sum)
		}
	} else {
		uniform := 1.0 / float32(len(logits))
		for i := range probs {
			probs[i] = uniform
		}
	}
	return probs
}

func (e *Engine) GenerateTags(filePath string, threshold float32, tokenizer *Tokenizer) ([]TagResult, error) {
	if threshold <= 0 {
		threshold = 0.3
	}

	texts := make([]string, len(TAG_CANDIDATES))
	for i, tag := range TAG_CANDIDATES {
		texts[i] = "a photo of " + tag
	}

	logits, err := e.GetLogits(filePath, texts, tokenizer)
	if err != nil {
		return nil, err
	}

	probs := softmax(logits)

	var results []TagResult
	for i, prob := range probs {
		if prob >= threshold {
			tag := TAG_CANDIDATES[i]
			results = append(results, TagResult{
				Tag:      tag,
				Score:    prob,
				Category: TAG_TO_CATEGORY[tag],
			})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > 15 {
		results = results[:15]
	}

	return results, nil
}


