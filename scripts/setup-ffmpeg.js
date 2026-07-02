/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const { execSync } = require('child_process');

console.log('\x1b[36m%s\x1b[0m', '=============================================');
console.log('\x1b[36m%s\x1b[0m', '    PRISM CROSS-PLATFORM FFMPEG INSTALLER    ');
console.log('\x1b[36m%s\x1b[0m', '=============================================');
console.log('');

// 1. Check if FFmpeg is already installed
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  console.log('\x1b[32m%s\x1b[0m', '[✓] FFmpeg is already installed and accessible in your PATH!');
  process.exit(0);
} catch (e) {
  // Not installed, proceed
}

console.log('\x1b[33m%s\x1b[0m', '[!] FFmpeg not found on this system.');
console.log('\x1b[33m%s\x1b[0m', '    Prism needs FFmpeg to extract video metadata, thumbnails, and perform transcoding.');
console.log('');

const platform = process.platform;

if (platform === 'win32') {
  console.log('Detecting Windows platform. Installing Gyan.FFmpeg via winget...');
  try {
    execSync('winget install Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements', { stdio: 'inherit' });
    console.log('');
    console.log('\x1b[32m%s\x1b[0m', '[✓] FFmpeg installed successfully!');
    console.log('\x1b[32m%s\x1b[0m', '    IMPORTANT: Please restart your terminal/IDE and server dev to refresh PATH.');
  } catch (err) {
    console.log('');
    console.log('\x1b[31m%s\x1b[0m', '[X] winget installation failed.');
    console.log('    Please try running your terminal as Administrator and try again, or install manually.');
    process.exit(1);
  }
} else if (platform === 'darwin') {
  console.log('Detecting macOS platform. Installing ffmpeg via Homebrew...');
  try {
    execSync('brew install ffmpeg', { stdio: 'inherit' });
    console.log('');
    console.log('\x1b[32m%s\x1b[0m', '[✓] FFmpeg installed successfully via Homebrew!');
  } catch (err) {
    console.log('');
    console.log('\x1b[31m%s\x1b[0m', '[X] Homebrew installation failed.');
    console.log('    Make sure Homebrew is installed (https://brew.sh) or install FFmpeg manually.');
    process.exit(1);
  }
} else if (platform === 'linux') {
  console.log('Detecting Linux platform. Identifying package manager...');
  
  let installed = false;
  const managers = [
    { cmd: 'apt-get', install: 'sudo apt-get update && sudo apt-get install -y ffmpeg' },
    { cmd: 'pacman', install: 'sudo pacman -S --noconfirm ffmpeg' },
    { cmd: 'dnf', install: 'sudo dnf install -y ffmpeg' },
    { cmd: 'yum', install: 'sudo yum install -y ffmpeg' },
    { cmd: 'zypper', install: 'sudo zypper install -y ffmpeg' }
  ];

  for (const mgr of managers) {
    try {
      execSync(`which ${mgr.cmd}`, { stdio: 'ignore' });
      console.log(`Package manager '${mgr.cmd}' found. Running installation...`);
      execSync(mgr.install, { stdio: 'inherit' });
      installed = true;
      break;
    } catch (e) {
      // Package manager not found or failed, try next
    }
  }

  if (installed) {
    console.log('');
    console.log('\x1b[32m%s\x1b[0m', '[✓] FFmpeg installed successfully!');
  } else {
    console.log('');
    console.log('\x1b[31m%s\x1b[0m', '[X] Could not automatically install FFmpeg on this Linux distribution.');
    console.log('    Please install FFmpeg manually using your system package manager (e.g. apt, pacman, dnf).');
    process.exit(1);
  }
} else {
  console.log('\x1b[31m%s\x1b[0m', `[X] Unsupported platform: ${platform}`);
  console.log('    Please install FFmpeg manually.');
  process.exit(1);
}
