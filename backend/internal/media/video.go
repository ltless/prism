package media

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type VideoMetadata struct {
	Duration int    `json:"duration"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Codec    string `json:"codec"`
}

func ExtractVideoMetadata(filePath string) (*VideoMetadata, error) {
	args := []string{
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height,codec_name,duration",
		"-show_entries", "format=duration",
		"-of", "json",
		filePath,
	}
	out, err := exec.Command("ffprobe", args...).Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe: %w", err)
	}

	var result struct {
		Streams []struct {
			Width    int     `json:"width"`
			Height   int     `json:"height"`
			Codec    string  `json:"codec_name"`
			Duration string  `json:"duration"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, fmt.Errorf("parse ffprobe output: %w", err)
	}

	if len(result.Streams) == 0 {
		return nil, fmt.Errorf("no video stream found")
	}

	s := result.Streams[0]
	var duration float64
	if s.Duration != "" {
		duration = parseFloat(s.Duration)
	} else if result.Format.Duration != "" {
		duration = parseFloat(result.Format.Duration)
	}

	return &VideoMetadata{
		Duration: int(duration),
		Width:    s.Width,
		Height:   s.Height,
		Codec:    s.Codec,
	}, nil
}

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

const videoThumbSeek = "1"

func GenerateVideoThumbnail(inputPath, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("create thumb dir: %w", err)
	}

	args := []string{
		"-i", inputPath,
		"-ss", videoThumbSeek,
		"-vframes", "1",
		"-vf", "scale=400:-1",
		"-y",
		outputPath,
	}
	cmd := exec.Command("ffmpeg", args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("ffmpeg thumbnail: %w\n%s", err, string(out))
	}
	return nil
}
