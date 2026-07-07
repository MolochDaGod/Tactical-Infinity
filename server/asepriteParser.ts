import Aseprite from 'ase-parser';
import fs from 'fs';
import path from 'path';

export interface AsepriteAnimationTag {
  name: string;
  from: number;
  to: number;
  direction: string;
  frameCount: number;
}

export interface AsepriteFrameData {
  duration: number;
  width: number;
  height: number;
}

export interface AsepriteParsedData {
  name: string;
  width: number;
  height: number;
  numFrames: number;
  tags: AsepriteAnimationTag[];
  frames: AsepriteFrameData[];
  colorDepth: number;
}

const ASEPRITE_DIR = path.join(process.cwd(), 'client/src/assets/GrudgeRPGAssets2d/GrudgeRPGAssets2d/Aseprite file');

export function parseAsepriteFile(filename: string): AsepriteParsedData | null {
  try {
    const filePath = path.join(ASEPRITE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`Aseprite file not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const ase = new Aseprite(buffer, filename);
    ase.parse();

    const tags: AsepriteAnimationTag[] = (ase.tags || []).map((tag: any) => ({
      name: tag.name,
      from: tag.from,
      to: tag.to,
      direction: tag.animDirection || 'forward',
      frameCount: tag.to - tag.from + 1
    }));

    const frames: AsepriteFrameData[] = (ase.frames || []).map((frame: any) => ({
      duration: frame.frameDuration || 100,
      width: ase.width,
      height: ase.height
    }));

    return {
      name: filename.replace('.aseprite', ''),
      width: ase.width,
      height: ase.height,
      numFrames: ase.numFrames,
      tags,
      frames,
      colorDepth: ase.colorDepth
    };
  } catch (error) {
    console.error(`Error parsing ${filename}:`, error);
    return null;
  }
}

export function getAllAsepriteData(): Map<string, AsepriteParsedData> {
  const result = new Map<string, AsepriteParsedData>();
  
  try {
    const files = fs.readdirSync(ASEPRITE_DIR);
    for (const file of files) {
      if (file.endsWith('.aseprite')) {
        const data = parseAsepriteFile(file);
        if (data) {
          result.set(data.name.toLowerCase().replace(/ /g, '-'), data);
        }
      }
    }
  } catch (error) {
    console.error('Error reading Aseprite directory:', error);
  }
  
  return result;
}

export function getAnimationFrameCount(characterName: string, animationName: string): number | null {
  const data = parseAsepriteFile(`${characterName}.aseprite`);
  if (!data) return null;
  
  const tag = data.tags.find(t => 
    t.name.toLowerCase() === animationName.toLowerCase()
  );
  
  return tag ? tag.frameCount : data.numFrames;
}
