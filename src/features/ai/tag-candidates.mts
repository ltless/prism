// every tag belongs to exactly one category — makes smart folder filtering possible
export const TAG_TAXONOMY: Record<string, string[]> = {
  "People":      ["person", "people", "portrait", "group", "selfie", "baby", "family",
                  "man", "woman", "child", "kid", "toddler", "elderly", "couple", "crowd", "friends"],
  "Nature":      ["nature", "landscape", "mountain", "forest", "tree", "flower", "plant", "garden",
                  "desert", "jungle", "canyon", "field", "meadow", "hills", "cliff", "grass", "rock"],
  "Water":       ["ocean", "beach", "sea", "lake", "river", "water", "underwater", "wave", "coral",
                  "waterfall", "swimming-pool", "pond", "stream", "creek"],
  "Sky & Light": ["sunset", "sunrise", "sky", "cloud", "night", "moon", "star", "milky-way", "aurora",
                  "golden-hour", "blue-hour", "twilight", "morning", "afternoon", "evening",
                  "sunlight", "lens-flare", "bokeh", "backlight"],
  "Urban":       ["city", "urban", "building", "architecture", "bridge", "street", "road", "alley",
                  "skyline", "indoor", "room", "house", "home", "office", "warehouse", "studio",
                  "subway", "skyscrapers", "monument", "cafe", "restaurant", "living-room", "bedroom"],
  "Food":        ["food", "drink", "meal", "kitchen", "coffee", "dessert", "fruit",
                  "bread", "vegetables", "meat", "rice", "pasta", "pizza", "burger", "sushi", "tea", "beer", "wine"],
  "Animals":     ["animal", "pet", "dog", "cat", "bird", "horse", "wildlife", "fish", "butterfly",
                  "insect", "reptile", "deer", "squirrel", "lion", "tiger", "bear", "elephant"],
  "Vehicles":    ["vehicle", "car", "bicycle", "airplane", "train", "boat", "motorcycle", "truck",
                  "bus", "scooter", "ship", "yacht", "helicopter"],
  "Sport":       ["sport", "fitness", "running", "biking", "soccer", "basketball", "swimming", "yoga",
                  "fitness-model", "bodybuilder", "muscle", "athletic",
                  "tennis", "golf", "badminton", "baseball", "gym", "climbing", "surfing", "skiing", "skateboarding"],
  "Art":         ["art", "museum", "statue", "painting", "sculpture", "graffiti", "tattoo",
                  "drawing", "sketch", "illustration", "digital-art", "crafts", "calligraphy"],
  "Events":      ["event", "concert", "wedding", "party", "celebration", "festival", "parade",
                  "concert-stage", "birthday", "anniversary", "graduation", "performance"],
  "Travel":      ["travel", "vacation", "adventure", "camping", "road-trip", "hiking",
                  "luggage", "passport", "sightseeing", "hotel", "resort", "map", "backpack"],
  "Technology":  ["technology", "computer", "phone", "screen", "robot", "drone", "gadget",
                  "smartphone", "laptop", "keyboard", "mouse", "headphones", "camera", "tv"],
  "Abstract":    ["abstract", "pattern", "texture", "colorful", "dark", "light", "geometric", "symmetry",
                  "minimalist", "vintage", "retro", "modern", "classic", "industrial", "rustic", "grunge",
                  "gradient", "smoke", "fire", "water-drops", "neon"],
  "Weather":     ["rain", "snow", "fog", "storm", "rainbow", "lightning", "mist",
                  "sunny", "windy", "snowy", "rainy", "foggy", "cloudy"],
  "Photography": ["macro", "aerial", "panorama", "reflection", "silhouette", "shadow", "long-exposure",
                  "macro-lens", "wide-angle", "telephoto", "drone-shot", "fish-eye"],
  "Fashion":     ["fashion", "jewelry", "perfume", "cosmetic", "portrait-studio",
                  "dress", "suit", "shoes", "glasses", "watch", "bag", "makeup", "hairstyle", "clothes"],
  "Sensitive":   ["naked", "nude", "lingerie", "underwear", "swimsuit", "bikini", "beachwear",
                  "boudoir", "sensual", "erotic", "implied-nudity", "topless"],
}

// flat array for zero-index lookup
export const TAG_CANDIDATES = Object.values(TAG_TAXONOMY).flat()

// reverse lookup: tag → category  (built once at module load)
export const TAG_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(TAG_TAXONOMY).flatMap(([cat, tags]) =>
    tags.map(tag => [tag, cat])
  )
)
