package media

// tagCategories maps individual CLIP tags to smart-folder category names.
// TODO: Make this configurable (e.g. load from app_config or a dedicated table)
// so users can customize categories without rebuilding.
var tagCategories = map[string]string{
	"person": "People", "people": "People", "portrait": "People", "group": "People",
	"selfie": "People", "baby": "People", "family": "People", "man": "People",
	"woman": "People", "child": "People", "kid": "People", "toddler": "People",
	"elderly": "People", "couple": "People", "crowd": "People", "friends": "People",
	"nature": "Nature", "landscape": "Nature", "mountain": "Nature", "forest": "Nature",
	"tree": "Nature", "flower": "Nature", "plant": "Nature", "garden": "Nature",
	"desert": "Nature", "jungle": "Nature", "canyon": "Nature", "field": "Nature",
	"meadow": "Nature", "hills": "Nature", "cliff": "Nature", "grass": "Nature", "rock": "Nature",
	"ocean": "Water", "beach": "Water", "sea": "Water", "lake": "Water", "river": "Water",
	"water": "Water", "underwater": "Water", "wave": "Water", "coral": "Water",
	"waterfall": "Water", "swimming-pool": "Water", "pond": "Water", "stream": "Water", "creek": "Water",
	"sunset": "Sky & Light", "sunrise": "Sky & Light", "sky": "Sky & Light", "cloud": "Sky & Light",
	"night": "Sky & Light", "moon": "Sky & Light", "star": "Sky & Light", "milky-way": "Sky & Light",
	"aurora": "Sky & Light", "golden-hour": "Sky & Light", "blue-hour": "Sky & Light",
	"twilight": "Sky & Light", "morning": "Sky & Light", "afternoon": "Sky & Light",
	"evening": "Sky & Light", "sunlight": "Sky & Light", "lens-flare": "Sky & Light",
	"bokeh": "Sky & Light", "backlight": "Sky & Light",
	"city": "Urban", "urban": "Urban", "building": "Urban", "architecture": "Urban",
	"bridge": "Urban", "street": "Urban", "road": "Urban", "alley": "Urban",
	"skyline": "Urban", "indoor": "Urban", "room": "Urban", "house": "Urban",
	"home": "Urban", "office": "Urban", "warehouse": "Urban", "studio": "Urban",
	"subway": "Urban", "skyscrapers": "Urban", "monument": "Urban", "cafe": "Urban",
	"restaurant": "Urban", "living-room": "Urban", "bedroom": "Urban",
	"food": "Food", "drink": "Food", "meal": "Food", "kitchen": "Food", "coffee": "Food",
	"dessert": "Food", "fruit": "Food", "bread": "Food", "vegetables": "Food",
	"meat": "Food", "rice": "Food", "pasta": "Food", "pizza": "Food", "burger": "Food",
	"sushi": "Food", "tea": "Food", "beer": "Food", "wine": "Food",
	"animal": "Animals", "pet": "Animals", "dog": "Animals", "cat": "Animals",
	"bird": "Animals", "horse": "Animals", "wildlife": "Animals", "fish": "Animals",
	"butterfly": "Animals", "insect": "Animals", "reptile": "Animals", "deer": "Animals",
	"squirrel": "Animals", "lion": "Animals", "tiger": "Animals", "bear": "Animals", "elephant": "Animals",
	"vehicle": "Vehicles", "car": "Vehicles", "bicycle": "Vehicles", "airplane": "Vehicles",
	"train": "Vehicles", "boat": "Vehicles", "motorcycle": "Vehicles", "truck": "Vehicles",
	"bus": "Vehicles", "scooter": "Vehicles", "ship": "Vehicles", "yacht": "Vehicles", "helicopter": "Vehicles",
	"sport": "Sport", "fitness": "Sport", "running": "Sport", "biking": "Sport",
	"soccer": "Sport", "basketball": "Sport", "swimming": "Sport", "yoga": "Sport",
	"tennis": "Sport", "golf": "Sport", "badminton": "Sport", "baseball": "Sport",
	"gym": "Sport", "climbing": "Sport", "surfing": "Sport", "skiing": "Sport", "skateboarding": "Sport",
}

// CategoryForTag returns the smart-folder category for a given tag.
// Tags not in the mapping return "Other".
func CategoryForTag(tag string) string {
	if cat, ok := tagCategories[tag]; ok {
		return cat
	}
	return "Other"
}
