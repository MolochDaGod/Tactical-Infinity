import * as THREE from 'three';


export interface TextureGenerationOptions {
  style?: 'realistic' | 'stylized' | 'painterly' | 'toon';
  quality?: 'fast' | 'standard' | 'high';
  width?: number;
  height?: number;
  seamless?: boolean;
}

export interface ShipTextureRequest {
  partType: 'hull' | 'deck' | 'sail' | 'mast' | 'cannon';
  material: 'wood' | 'metal' | 'cloth' | 'rope';
  condition: 'pristine' | 'weathered' | 'battle_damaged' | 'burning' | 'ghost';
  color?: string;
}

export interface DamageTextureRequest {
  damageType: 'cannon_hit' | 'fire_damage' | 'water_damage' | 'age_wear';
  severity: 'light' | 'medium' | 'heavy';
  material: 'wood' | 'cloth' | 'metal';
}

const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/';

let puterLoaded = false;
let puterLoadPromise: Promise<void> | null = null;

export async function loadPuterAI(): Promise<boolean> {
  if (puterLoaded && window.puter) {
    return true;
  }

  if (puterLoadPromise) {
    await puterLoadPromise;
    return puterLoaded;
  }

  puterLoadPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${PUTER_SCRIPT_URL}"]`);
    if (existingScript) {
      const checkPuter = setInterval(() => {
        if (window.puter) {
          clearInterval(checkPuter);
          puterLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = PUTER_SCRIPT_URL;
    script.async = true;
    
    script.onload = () => {
      const checkPuter = setInterval(() => {
        if (window.puter) {
          clearInterval(checkPuter);
          puterLoaded = true;
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkPuter);
        resolve();
      }, 10000);
    };
    
    script.onerror = () => {
      console.error('Failed to load Puter.js');
      resolve();
    };
    
    document.head.appendChild(script);
  });

  await puterLoadPromise;
  return puterLoaded;
}

export function isPuterAvailable(): boolean {
  return puterLoaded && !!window.puter;
}

export async function generateTexture(
  prompt: string,
  options: TextureGenerationOptions = {}
): Promise<HTMLImageElement | null> {
  if (!await loadPuterAI()) {
    console.error('Puter AI not available');
    return null;
  }

  const stylePrompts: Record<string, string> = {
    realistic: 'photorealistic, high detail, 8k texture',
    stylized: 'stylized, hand-painted, game texture style',
    painterly: 'oil painting style, artistic brushstrokes',
    toon: 'cel-shaded, cartoon style, flat colors, bold outlines',
  };

  const qualitySettings: Record<string, { steps: number; model: string }> = {
    fast: { steps: 20, model: 'black-forest-labs/FLUX.1-schnell' },
    standard: { steps: 30, model: 'stabilityai/stable-diffusion-xl-base-1.0' },
    high: { steps: 50, model: 'black-forest-labs/FLUX.2-pro' },
  };

  const style = options.style || 'stylized';
  const quality = options.quality || 'standard';
  const settings = qualitySettings[quality];

  let fullPrompt = `${prompt}, ${stylePrompts[style]}`;
  if (options.seamless) {
    fullPrompt += ', seamless texture, tileable pattern';
  }

  try {
    const image = await window.puter!.ai.txt2img(fullPrompt, {
      model: settings.model,
      width: options.width || 512,
      height: options.height || 512,
      steps: settings.steps,
      negative_prompt: 'blurry, low quality, distorted, text, watermark, signature',
    });

    return image as HTMLImageElement;
  } catch (error) {
    console.error('Texture generation failed:', error);
    return null;
  }
}

export async function generateShipTexture(request: ShipTextureRequest): Promise<HTMLImageElement | null> {
  const materialDescriptions: Record<string, string> = {
    wood: 'wooden planks, grain texture, natural wood',
    metal: 'hammered metal, iron, bronze patina',
    cloth: 'canvas fabric, woven textile',
    rope: 'braided rope, hemp fibers',
  };

  const conditionDescriptions: Record<string, string> = {
    pristine: 'new, clean, polished, well-maintained',
    weathered: 'aged, worn, salt-stained, sun-bleached',
    battle_damaged: 'cannon holes, splintered, scorched marks, battle-worn',
    burning: 'on fire, flames, smoke, charred edges',
    ghost: 'ethereal, translucent, ghostly glow, spectral mist',
  };

  const partDescriptions: Record<string, string> = {
    hull: 'ship hull exterior, curved planking',
    deck: 'ship deck, flat planks, walking surface',
    sail: 'ship sail, billowing canvas',
    mast: 'ship mast, tall pole, wooden beam',
    cannon: 'naval cannon, artillery piece',
  };

  let prompt = `${partDescriptions[request.partType]}, ${materialDescriptions[request.material]}, ${conditionDescriptions[request.condition]}`;
  
  if (request.color) {
    prompt += `, ${request.color} colored`;
  }

  prompt += ', game asset texture, seamless pattern';

  return generateTexture(prompt, {
    style: request.condition === 'ghost' ? 'stylized' : 'realistic',
    quality: 'standard',
    seamless: true,
    width: 512,
    height: 512,
  });
}

export async function generateDamageOverlay(request: DamageTextureRequest): Promise<HTMLImageElement | null> {
  const damageDescriptions: Record<string, string> = {
    cannon_hit: 'cannonball impact, splintered hole, explosive damage',
    fire_damage: 'burn marks, charred surface, ember glow, smoke stains',
    water_damage: 'water stains, algae, barnacles, rust',
    age_wear: 'scratches, worn edges, faded color, patina',
  };

  const severityModifiers: Record<string, string> = {
    light: 'minor, subtle, small patches',
    medium: 'moderate, visible, scattered',
    heavy: 'severe, extensive, widespread destruction',
  };

  const materialContext: Record<string, string> = {
    wood: 'on wooden surface',
    cloth: 'on fabric canvas',
    metal: 'on metal surface',
  };

  const prompt = `${damageDescriptions[request.damageType]}, ${severityModifiers[request.severity]}, ${materialContext[request.material]}, damage overlay texture, transparent background, game asset`;

  return generateTexture(prompt, {
    style: 'realistic',
    quality: 'fast',
    width: 256,
    height: 256,
  });
}

export async function generateWeatherEffect(
  type: 'rain_drops' | 'fog_overlay' | 'storm_clouds' | 'lightning' | 'snow'
): Promise<HTMLImageElement | null> {
  const prompts: Record<string, string> = {
    rain_drops: 'rain droplets on glass, water streaks, wet surface effect',
    fog_overlay: 'misty fog, atmospheric haze, volumetric clouds',
    storm_clouds: 'dark storm clouds, dramatic sky, ominous weather',
    lightning: 'lightning bolt, electrical discharge, bright flash',
    snow: 'snowflakes falling, winter precipitation, frost crystals',
  };

  return generateTexture(prompts[type], {
    style: 'realistic',
    quality: 'fast',
    width: 512,
    height: 512,
  });
}

export function imageToTexture(image: HTMLImageElement): THREE.Texture {
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export async function generateAndApplyTexture(
  mesh: THREE.Mesh,
  prompt: string,
  options?: TextureGenerationOptions
): Promise<boolean> {
  const image = await generateTexture(prompt, options);
  if (!image) return false;

  const texture = imageToTexture(image);
  
  if (mesh.material instanceof THREE.MeshStandardMaterial) {
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
    return true;
  }
  
  return false;
}
