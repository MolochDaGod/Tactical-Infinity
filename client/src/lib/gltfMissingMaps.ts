/**
 * Author GLBs often point at Textures/colormap.png next to the file.
 * Those maps are not on CDN — substitute a 1×1 so GLTFLoader does not 404.
 */

import { LoadingManager } from 'three';

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function patchGltfMissingMaps(manager: LoadingManager): void {
  const prev = manager.resolveURL.bind(manager);
  manager.setURLModifier((url) => {
    if (/colormap\.png|Textures\//i.test(url) && !url.startsWith('data:')) return PIXEL;
    return prev(url);
  });
}
