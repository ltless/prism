import os from 'os';
import { execSync } from 'child_process';

let _gpuAvailable: boolean | null = null;

export function isGPUAvailable(): boolean {
 if (_gpuAvailable !== null) return _gpuAvailable;
 _gpuAvailable = detectGPU();
 return _gpuAvailable;
}

function detectGPU(): boolean {
 try {
 const platform = os.platform();

 if (platform === 'win32') {
 return detectWindowsGPU();
 }

 if (platform === 'linux') {
 return detectLinuxGPU();
 }

 return false;
 } catch {
 return false;
 }
}

function detectWindowsGPU(): boolean {
 try {
 const output = execSync('wmic path win32_videocontroller get name', {
 encoding: 'utf-8',
 timeout: 5000,
 });
 const gpuNames = output.toLowerCase();
 return gpuNames.includes('nvidia') || gpuNames.includes('amd') || gpuNames.includes('radeon') || gpuNames.includes('intel');
 } catch {
 return false;
 }
}

function detectLinuxGPU(): boolean {
 try {
 try {
 execSync('nvidia-smi', { timeout: 5000 });
 return true;
 } catch {
 }

 try {
 const output = execSync('lspci | grep -i vga', {
 encoding: 'utf-8',
 timeout: 5000,
 });
 return output.toLowerCase().includes('amd') || output.toLowerCase().includes('radeon');
 } catch {
 return false;
 }
 } catch {
 return false;
 }
}

export function getGPUInfo(): {
 available: boolean;
 platform: string;
 gpuName?: string;
} {
 const platform = os.platform();
 let gpuName: string | undefined;

 try {
 if (platform === 'win32') {
 const output = execSync('wmic path win32_videocontroller get name', {
 encoding: 'utf-8',
 timeout: 5000,
 });
 const lines = output.split('\n').filter((l: string) => l.trim() && !l.includes('Name'));
 gpuName = lines[0]?.trim();
 } else if (platform === 'linux') {
 const output = execSync('lspci | grep -i vga', {
 encoding: 'utf-8',
 timeout: 5000,
 });
 gpuName = output.split('\n')[0]?.replace('VGA compatible controller: ', '').trim();
 }
 } catch {
 }

 return {
 available: isGPUAvailable(),
 platform,
 gpuName,
 };
}
