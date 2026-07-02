export interface MediaMetadata {
  // AI tagging
  embedding?: number[];
  tags?: string[];
  tagScores?: number[];
  aiProcessed?: boolean;

  // AI aesthetic scoring
  aestheticScore?: number;
  aestheticScored?: boolean;
  aestheticScoredAt?: string;
  aestheticModel?: string;
  autofavorited?: boolean;

  // Visual
  palette?: string[];
  faceCount?: number;

  // EXIF (camera info)
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  exposure?: string;
  f_number?: number;
  iso?: number;
  focal_length?: number;
  flash?: number;
  white_balance?: number;
  metering_mode?: number;
  exposure_program?: number;
  color_space?: number;

  // EXIF location
  lat?: number;
  lng?: number;

  // Video
  codec?: string;

  // Internal timestamps
  updatedAt?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  filePath: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  hash: string;
  isFavorite?: boolean;
  isTrash?: boolean;
  isVault?: boolean | null;
  folderId?: string | null;
  capturedAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  metadata?: MediaMetadata;
  duration?: number | null;
  transcodeStatus?: string | null;
}

export interface SmartFolderFilter {
 categories: string[]; // e.g. ["Nature", "Water"]
 minScore: number; // 0–1, e.g. 0.25
}

export interface Folder {
 id: string;
 name: string;
 color?: string | null;
 parentId?: string | null;
 folderType?: string | null; // 'manual' | 'smart'
 filterQuery?: string | null; // JSON-serialized SmartFolderFilter
  createdAt?: Date | null;
}
