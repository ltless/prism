import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, '../storage/models');

const MODELS = {
  standard: 'Xenova/clip-vit-base-patch32',
  sharp: 'Xenova/clip-vit-base-patch16',
  high: 'Xenova/clip-vit-large-patch14'
};

const FILES = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer_config.json',
  'tokenizer.json',
  'special_tokens_map.json',
  'vocab.json',
  'merges.txt',
  'onnx/model_quantized.onnx',
];

function main() {
  const variant = process.argv[2];
  const modelId = MODELS[variant];

  if (!modelId) {
    console.log('Usage: node scripts/download-models.mjs [standard|sharp|high]');
    return;
  }

  const modelDir = path.join(MODELS_DIR, modelId);
  console.log(`\n📂 Target directory: ${modelDir}`);
  
  if (!fs.existsSync(path.join(modelDir, 'onnx'))) {
    fs.mkdirSync(path.join(modelDir, 'onnx'), { recursive: true });
  }

  for (const file of FILES) {
    const url = `https://huggingface.co/${modelId}/resolve/main/${file}`;
    const dest = path.join(modelDir, file);
    
    console.log(`⬇️ Downloading: ${file}...`);
    try {
      // Menggunakan curl -L untuk menangani redirect Hugging Face
      execSync(`curl -L "${url}" -o "${dest}"`, { stdio: 'inherit' });
    } catch {
      console.log(`⚠️ Failed to download ${file}, skipping...`);
    }
  }

  console.log(`\n✅ Model ${variant} successfully downloaded to local folder.`);
}

main();
