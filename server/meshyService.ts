const MESHY_API_KEY = process.env.MESHY_API_KEY;
const BASE_URL = 'https://api.meshy.ai';

interface MeshyTaskResponse {
  result: string;
}

interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  thumbnail_url?: string;
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  created_at?: number;
  finished_at?: number;
}

export interface GenerateModelOptions {
  prompt: string;
  artStyle?: 'realistic' | 'sculpture' | 'pbr' | 'cartoon';
  negativePrompt?: string;
  shouldRemesh?: boolean;
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  if (!MESHY_API_KEY) {
    throw new Error('MESHY_API_KEY not configured');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MESHY_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Meshy API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function createTextTo3DPreview(options: GenerateModelOptions): Promise<string> {
  const data: MeshyTaskResponse = await makeRequest('/openapi/v2/text-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'preview',
      prompt: options.prompt,
      art_style: options.artStyle || 'realistic',
      negative_prompt: options.negativePrompt || 'low quality, low resolution, low poly, ugly',
      should_remesh: options.shouldRemesh ?? true,
      ai_model: 'latest'
    }),
  });

  return data.result;
}

export async function getTaskStatus(taskId: string, endpoint: string = 'text-to-3d'): Promise<MeshyTask> {
  return makeRequest(`/openapi/v2/${endpoint}/${taskId}`, {
    method: 'GET',
  });
}

export async function pollTaskUntilComplete(
  taskId: string, 
  endpoint: string = 'text-to-3d',
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<MeshyTask> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const task = await getTaskStatus(taskId, endpoint);
    
    console.log(`Meshy task ${taskId}: ${task.status} (${task.progress}%)`);
    
    if (task.status === 'SUCCEEDED') {
      return task;
    }
    
    if (task.status === 'FAILED' || task.status === 'EXPIRED') {
      throw new Error(`Meshy task failed with status: ${task.status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error('Meshy task timed out');
}

export async function refineModel(previewTaskId: string, enablePBR: boolean = true): Promise<string> {
  const data: MeshyTaskResponse = await makeRequest('/openapi/v2/text-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'refine',
      preview_task_id: previewTaskId,
      enable_pbr: enablePBR
    }),
  });

  return data.result;
}

export async function generateSailModel(): Promise<MeshyTask> {
  console.log('Starting sail model generation with Meshy AI...');
  
  const previewTaskId = await createTextTo3DPreview({
    prompt: 'medieval sailing ship sail, triangular canvas sail with wooden mast, nautical fabric texture, aged cloth material, rope rigging details',
    artStyle: 'realistic',
    negativePrompt: 'modern, plastic, low quality, blurry',
    shouldRemesh: true
  });
  
  console.log(`Preview task created: ${previewTaskId}`);
  
  const previewTask = await pollTaskUntilComplete(previewTaskId);
  console.log('Preview complete, starting refinement...');
  
  const refineTaskId = await refineModel(previewTaskId, true);
  const refinedTask = await pollTaskUntilComplete(refineTaskId);
  
  console.log('Sail model generation complete!');
  return refinedTask;
}

export interface ShipModelPrompt {
  shipType: string;
  prompt: string;
  negativePrompt?: string;
}

export const SHIP_MODEL_PROMPTS: Record<string, ShipModelPrompt> = {
  raft: {
    shipType: 'raft',
    prompt: 'detailed 3D wooden log raft with separate parts: wooden log hull base, small raised deck platform, short wooden mast pole, simple steering oar. Fantasy pirate style, warm weathered wood tones, rope lashings. NO sails included - mast only. Distinct separable mesh components.',
    negativePrompt: 'sails, canvas, cloth, fabric, low poly, flat, modern, metal'
  },
  skiff: {
    shipType: 'skiff',
    prompt: 'detailed 3D small wooden fishing boat with separate parts: curved wooden hull with planks, flat deck with raised bow section, single tall wooden mast, stern platform with tiller. Fantasy pirate style, weathered oak wood, iron fittings. NO sails - mast only. Distinct separable mesh components for hull, deck, bow, mast, stern.',
    negativePrompt: 'sails, canvas, cloth, fabric, low poly, modern, plastic'
  },
  sloop: {
    shipType: 'sloop',
    prompt: 'detailed 3D fantasy pirate sloop with separate parts: dark polished wooden hull with cannon ports, main deck with hatches, raised bow with figurehead, elevated stern with captains quarters, single tall main mast, boom and gaff spars (no sail cloth). 4 brass cannons per side. Sea of Thieves style. NO sails - spars only. Distinct separable mesh components for hull, deck, bow, stern, mast, cannons.',
    negativePrompt: 'sails, canvas, cloth, fabric, low poly, simple, modern'
  },
  brigantine: {
    shipType: 'brigantine',
    prompt: 'detailed 3D fantasy pirate brigantine with separate parts: ornate wooden hull with crimson and gold trim, main deck and forecastle deck, decorated bow with carved figurehead, elaborate stern gallery with windows, two tall masts with yards and booms (no sail cloth), crows nest. 6 iron cannons per side. Sea of Thieves style. NO sails - spars only. Distinct separable mesh components for hull, deck, bow, stern, foremast, mainmast, cannons.',
    negativePrompt: 'sails, canvas, cloth, fabric, low poly, simple, modern'
  },
  galleon: {
    shipType: 'galleon',
    prompt: 'detailed 3D massive fantasy pirate galleon warship with separate parts: imposing wooden hull with multiple decks, forecastle and quarterdeck, dramatic carved bow with dragon figurehead, ornate stern castle with gilded windows and balcony, three tall masts with yards and crosstrees (no sail cloth), crows nests, rope ladders. 12 bronze cannons per side. Burgundy and gold accents. Sea of Thieves style. NO sails - spars only. Distinct separable mesh components for hull, deck, bow, stern, foremast, mainmast, mizzenmast, cannons.',
    negativePrompt: 'sails, canvas, cloth, fabric, low poly, simple, modern, sailboat'
  }
};

export async function generateShipModel(shipType: string = 'sloop'): Promise<MeshyTask> {
  const shipPrompt = SHIP_MODEL_PROMPTS[shipType] || SHIP_MODEL_PROMPTS.sloop;
  
  console.log(`Starting ${shipType} ship model generation with Meshy AI...`);
  
  const previewTaskId = await createTextTo3DPreview({
    prompt: shipPrompt.prompt,
    artStyle: 'realistic',
    negativePrompt: shipPrompt.negativePrompt || 'modern, plastic, sails, low quality',
    shouldRemesh: true
  });
  
  console.log(`Ship preview task created for ${shipType}: ${previewTaskId}`);
  
  const previewTask = await pollTaskUntilComplete(previewTaskId);
  console.log(`Ship preview complete for ${shipType}!`);
  
  return previewTask;
}

export async function generateStylizedSailModel(sailColor: string = 'golden'): Promise<MeshyTask> {
  console.log(`Starting ${sailColor} sail model generation with Meshy AI...`);
  
  const previewTaskId = await createTextTo3DPreview({
    prompt: `fantasy pirate ship sail, ${sailColor} colored canvas, wooden mast, triangular sail shape, rope rigging details, nautical fabric texture, billowing cloth`,
    artStyle: 'realistic',
    negativePrompt: 'modern, plastic, low quality, flat, stiff',
    shouldRemesh: true
  });
  
  console.log(`Sail preview task created: ${previewTaskId}`);
  
  const previewTask = await pollTaskUntilComplete(previewTaskId);
  console.log('Sail preview complete!');
  
  return previewTask;
}

export function isMeshyConfigured(): boolean {
  return !!MESHY_API_KEY;
}

// ── Text-to-Texture (image-guided retexturing of an existing model) ──────────
export interface TextToTextureOptions {
  modelUrl: string;
  objectPrompt: string;
  stylePrompt?: string;
  /** Public URL of an avatar/style reference image. Optional. */
  textureImageUrl?: string;
  artStyle?: 'realistic' | 'fake-3d-cartoon' | 'japanese-anime' | 'cartoon-line-art' | 'realistic-hand-drawn' | 'fake-3d-hand-drawn' | 'oriental-comic-ink';
  negativePrompt?: string;
  enablePbr?: boolean;
}

export async function createTextToTexture(opts: TextToTextureOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model_url: opts.modelUrl,
    object_prompt: opts.objectPrompt,
    style_prompt: opts.stylePrompt || opts.objectPrompt,
    art_style: opts.artStyle || 'realistic',
    enable_pbr: opts.enablePbr ?? true,
    negative_prompt: opts.negativePrompt || 'low quality, blurry, distorted, watermark',
  };
  if (opts.textureImageUrl) {
    body.texture_image_url = opts.textureImageUrl;
  }
  const data: MeshyTaskResponse = await makeRequest('/openapi/v1/text-to-texture', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.result;
}

export async function getTextureTaskStatus(taskId: string): Promise<MeshyTask> {
  return makeRequest(`/openapi/v1/text-to-texture/${taskId}`, { method: 'GET' });
}

// Character generation with auto-rigging support
// Note: Meshy API v2 only supports 'realistic' and 'sculpture' art styles
export interface CharacterModelOptions {
  prompt: string;
  artStyle?: 'realistic' | 'sculpture';
  tPose?: boolean;
  heightMeters?: number;
}

interface RiggingTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  result?: {
    rigged_character_glb_url?: string;
    rigged_character_fbx_url?: string;
    basic_animations?: {
      idle_glb_url?: string;
      idle_fbx_url?: string;
      walking_glb_url?: string;
      walking_fbx_url?: string;
      running_glb_url?: string;
      running_fbx_url?: string;
      jump_glb_url?: string;
      jump_fbx_url?: string;
    };
  };
}

export interface CharacterAnimations {
  idle?: string;
  walking?: string;
  running?: string;
  jump?: string;
}

// Race-based character prompts matching GRUDGE races with stylized low-poly RPG aesthetic
// Note: Meshy API only supports 'realistic' and 'sculpture' art styles
export const RACE_PROMPTS: Record<string, CharacterModelOptions> = {
  human: {
    prompt: 'stylized low-poly fantasy human male character, medieval adventurer, short beard, leather tunic with gold trim accents, cloth pants, metal belt buckle with gem, leather bracers with gold bands, sturdy boots with fur trim, heroic proportions, warm brown and tan color palette, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 1.8
  },
  orc: {
    prompt: 'stylized low-poly fantasy orc male character, olive green skin, muscular athletic build, pointed ears, small tusks, fierce yellow eyes, leather loincloth with ornate belt buckle and blue gem, orange and brown leather bracers, cloth leg wraps, barefoot with armored shin guards, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 1.9
  },
  undead: {
    prompt: 'stylized low-poly fantasy undead skeleton warrior character, exposed skull head, bone white and gray color palette, skeletal ribcage visible through armor, dark metal armor plates on shoulders and legs, bony fingers, glowing eye sockets, tattered cloth remnants, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 1.75
  },
  barbarian: {
    prompt: 'stylized low-poly fantasy barbarian male character, large muscular build, wild long beard, leather headband, tan skin, simple leather tunic with rope belt and metal buckle, cloth bracers with fur trim, heavy fur-lined boots, primitive warrior aesthetic, orange and brown color palette, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 2.0
  },
  dwarf: {
    prompt: 'stylized low-poly fantasy dwarf male character, short stocky body proportions, very long braided brown beard reaching chest, bald head with stern expression, heavy plate armor with leather underlayer, ornate belt, thick armored boots, brown and tan earth tones, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 1.3
  },
  elf: {
    prompt: 'stylized low-poly fantasy elf male character, tall slender athletic build, long blonde hair, pointed ears, angular refined features, elegant leather armor with silver trim, ornate belt with blue gem, leather bracers, fitted boots, graceful proportions, brown and gold color palette, toon RTS game style, clean topology',
    artStyle: 'realistic',
    tPose: true,
    heightMeters: 1.85
  }
};

// Class modifiers to add to race prompts
export const CLASS_MODIFIERS: Record<string, string> = {
  warrior: 'wearing heavy plate armor, sword and shield equipped, battle-hardened stance',
  mage: 'wearing flowing robes and pointed hat, holding magical staff with crystal, mystical aura',
  ranger: 'wearing hooded leather cloak, bow and quiver on back, scout gear',
  worge: 'wearing a forge engineer apron with metal rivets, goggles on forehead, holding a hammer, gadgets on belt',
};

// Race-specific head/bust prompts for captain face generation
export const CAPTAIN_HEAD_PROMPTS: Record<string, string> = {
  human:    'fantasy human male character head bust, medieval adventurer face, short beard, determined expression, heroic jawline, warm skin tone, toon RPG art style, stylized low-poly, detailed face sculpt, neutral background',
  barbarian:'fantasy barbarian male character head bust, wild unkempt beard, battle scars, fierce expression, broad weathered face, tan skin, primitive tribal markings, toon RPG art style, stylized, detailed face sculpt, neutral background',
  dwarf:    'fantasy dwarf male character head bust, very long braided beard, bald or shaved head, stern proud expression, stocky broad face, ruddy complexion, ornate beard beads, toon RPG art style, stylized low-poly, detailed face sculpt',
  elf:      'fantasy elf male character head bust, long pointed ears, angular refined features, sharp cheekbones, long flowing blonde hair, calm elegant expression, pale flawless skin, toon RPG art style, stylized low-poly, detailed face sculpt',
  orc:      'fantasy orc male character head bust, green skin, prominent jaw with small tusks, fierce yellow glowing eyes, bald head, tribal face tattoos, muscular neck, toon RPG art style, stylized low-poly, bold expressive face',
  undead:   'fantasy undead skeleton character head bust, exposed skull, hollow glowing eye sockets, cracked bone texture, remnants of tattered flesh, dark magic aura, toon RPG art style, stylized low-poly, eerie haunted face sculpt',
};

export function buildCaptainHeadPrompt(options: CustomCharacterOptions): string {
  const base = CAPTAIN_HEAD_PROMPTS[options.race.toLowerCase()] || CAPTAIN_HEAD_PROMPTS.human;
  const hairMod = options.hairColor && HAIR_MODIFIERS[options.hairColor]
    ? `, ${HAIR_MODIFIERS[options.hairColor]}`
    : '';
  const classMod = options.characterClass && CLASS_MODIFIERS[options.characterClass.toLowerCase()]
    ? `, captain of a ${options.characterClass} class, ${CLASS_MODIFIERS[options.characterClass.toLowerCase()].split(',')[0]}`
    : '';
  return `${base}${hairMod}${classMod}, named "${options.name}", unique captain portrait, facing forward, white background`;
}

// Hair and build modifiers
export const HAIR_MODIFIERS: Record<string, string> = {
  black: 'jet black hair',
  brown: 'brown hair',
  dark_brown: 'dark brown hair',
  blonde: 'blonde hair',
  red: 'red hair',
  white: 'white hair',
  gray: 'gray hair',
  bald: 'bald head'
};

export const BUILD_MODIFIERS: Record<string, string> = {
  athletic: 'athletic muscular build',
  slim: 'slim lean build',
  stocky: 'stocky sturdy build',
  muscular: 'heavily muscular build',
  average: 'average build'
};

export interface CustomCharacterOptions {
  name: string;
  race: string;
  characterClass?: string;
  hairColor?: string;
  build?: string;
  additionalDetails?: string;
}

export function buildCharacterPrompt(options: CustomCharacterOptions): string {
  const racePrompt = RACE_PROMPTS[options.race.toLowerCase()] || RACE_PROMPTS.human;
  let prompt = racePrompt.prompt;
  
  // Add class modifier
  if (options.characterClass) {
    const classModifier = CLASS_MODIFIERS[options.characterClass.toLowerCase()];
    if (classModifier) {
      prompt = prompt.replace('toon RTS game style', `${classModifier}, toon RTS game style`);
    }
  }
  
  // Add hair color
  if (options.hairColor) {
    const hairMod = HAIR_MODIFIERS[options.hairColor.toLowerCase()] || options.hairColor + ' hair';
    prompt = prompt.replace('clean topology', `${hairMod}, clean topology`);
  }
  
  // Add build
  if (options.build) {
    const buildMod = BUILD_MODIFIERS[options.build.toLowerCase()] || options.build + ' build';
    // Replace any existing build description
    prompt = prompt.replace(/muscular athletic build|athletic muscular build|large muscular build|short stocky body proportions|tall slender athletic build/gi, buildMod);
  }
  
  // Add additional details
  if (options.additionalDetails) {
    prompt = prompt.replace('clean topology', `${options.additionalDetails}, clean topology`);
  }
  
  return prompt;
}

// Legacy CHARACTER_PROMPTS for backwards compatibility
export const CHARACTER_PROMPTS = RACE_PROMPTS;

export async function createCharacterModel(options: CharacterModelOptions): Promise<string> {
  const data: MeshyTaskResponse = await makeRequest('/openapi/v2/text-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'preview',
      prompt: options.prompt,
      art_style: options.artStyle || 'realistic',
      negative_prompt: 'low quality, deformed, ugly, multiple limbs, extra arms, extra legs',
      should_remesh: true,
      ai_model: 'meshy-5',
      is_a_t_pose: options.tPose ?? true
    }),
  });

  return data.result;
}

export async function rigCharacterModel(modelUrl: string, heightMeters: number = 1.7): Promise<string> {
  const data: MeshyTaskResponse = await makeRequest('/openapi/v1/rigging', {
    method: 'POST',
    body: JSON.stringify({
      model_url: modelUrl,
      height_meters: heightMeters
    }),
  });

  return data.result;
}

export async function rigCharacterByTaskId(textTo3DTaskId: string, heightMeters: number = 1.7): Promise<string> {
  const data: MeshyTaskResponse = await makeRequest('/openapi/v1/rigging', {
    method: 'POST',
    body: JSON.stringify({
      input_task_id: textTo3DTaskId,
      height_meters: heightMeters
    }),
  });

  return data.result;
}

export async function getRiggingTaskStatus(taskId: string): Promise<RiggingTask> {
  return makeRequest(`/openapi/v1/rigging/${taskId}`, {
    method: 'GET',
  });
}

export async function generateRiggedCharacter(characterType: string = 'warrior'): Promise<{
  modelUrl: string;
  riggedUrl: string;
  animations: CharacterAnimations;
}> {
  const charOptions = CHARACTER_PROMPTS[characterType] || CHARACTER_PROMPTS.warrior;
  
  console.log(`Starting ${characterType} character generation with Meshy AI...`);
  
  // Step 1: Generate T-pose character
  const previewTaskId = await createCharacterModel(charOptions);
  console.log(`Character preview task created: ${previewTaskId}`);
  
  const previewTask = await pollTaskUntilComplete(previewTaskId);
  console.log('Character model complete!');
  
  const modelUrl = previewTask.model_urls?.glb || '';
  
  // Step 2: Auto-rig the character
  console.log('Starting auto-rigging...');
  const riggingTaskId = await rigCharacterByTaskId(previewTaskId, charOptions.heightMeters || 1.7);
  console.log(`Rigging task created: ${riggingTaskId}`);
  
  // Poll rigging task
  let riggingTask: RiggingTask;
  for (let attempt = 0; attempt < 30; attempt++) {
    riggingTask = await getRiggingTaskStatus(riggingTaskId);
    console.log(`Rigging task ${riggingTaskId}: ${riggingTask.status} (${riggingTask.progress}%)`);
    
    if (riggingTask.status === 'SUCCEEDED') {
      const anims = riggingTask.result?.basic_animations;
      return {
        modelUrl,
        riggedUrl: riggingTask.result?.rigged_character_glb_url || '',
        animations: {
          idle: anims?.idle_glb_url,
          walking: anims?.walking_glb_url,
          running: anims?.running_glb_url,
          jump: anims?.jump_glb_url
        }
      };
    }
    
    if (riggingTask.status === 'FAILED' || riggingTask.status === 'EXPIRED') {
      throw new Error(`Rigging failed with status: ${riggingTask.status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Rigging task timed out');
}

export function extractAnimationsFromRiggingTask(task: RiggingTask): CharacterAnimations {
  const anims = task.result?.basic_animations;
  return {
    idle: anims?.idle_glb_url,
    walking: anims?.walking_glb_url,
    running: anims?.running_glb_url,
    jump: anims?.jump_glb_url
  };
}

export function getCharacterTypes(): string[] {
  return Object.keys(CHARACTER_PROMPTS);
}
