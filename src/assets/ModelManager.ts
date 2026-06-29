import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MODEL_ASSETS, type ModelAssetDefinition, type ModelAssetId } from "./modelManifest";

export interface LoadedModelAsset {
  id: ModelAssetId;
  definition: ModelAssetDefinition;
  scene: THREE.Group;
}

export interface ModelCloneOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface ModelManagerStats {
  loadedAssetIds: readonly ModelAssetId[];
  failedAssetIds: readonly ModelAssetId[];
}

export class ModelManager {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<ModelAssetId, Promise<LoadedModelAsset | null>>();
  private readonly loadedAssetIds = new Set<ModelAssetId>();
  private readonly failedAssetIds = new Set<ModelAssetId>();
  private readonly warnedAssetIds = new Set<ModelAssetId>();

  public load(id: ModelAssetId): Promise<LoadedModelAsset | null> {
    const cached = this.cache.get(id);

    if (cached) {
      return cached;
    }

    const definition = MODEL_ASSETS[id];
    const loadPromise = this.loader
      .loadAsync(definition.path)
      .then((gltf) => {
        const scene = gltf.scene;
        scene.name = `asset-source-${id}`;
        this.prepareSourceScene(scene);
        this.loadedAssetIds.add(id);
        this.failedAssetIds.delete(id);
        return { id, definition, scene };
      })
      .catch((error: unknown) => {
        this.failedAssetIds.add(id);
        this.warnOnce(id, error);
        return null;
      });

    this.cache.set(id, loadPromise);
    return loadPromise;
  }

  public async clone(id: ModelAssetId, options: ModelCloneOptions = {}): Promise<THREE.Group | null> {
    const asset = await this.load(id);

    if (!asset) {
      return null;
    }

    const clone = asset.scene.clone(true);
    clone.name = `asset-instance-${id}`;
    clone.userData.modelAssetId = id;
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry = object.geometry.clone();
        object.material = cloneMaterial(object.material);
        object.castShadow = options.castShadow ?? true;
        object.receiveShadow = options.receiveShadow ?? true;
      }
    });

    return clone;
  }

  public getStats(): ModelManagerStats {
    return {
      loadedAssetIds: [...this.loadedAssetIds],
      failedAssetIds: [...this.failedAssetIds]
    };
  }

  private prepareSourceScene(scene: THREE.Group): void {
    scene.traverse((object) => {
      object.matrixAutoUpdate = true;

      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  private warnOnce(id: ModelAssetId, error: unknown): void {
    if (this.warnedAssetIds.has(id)) {
      return;
    }

    this.warnedAssetIds.add(id);
    console.warn(`[High Noon Duel] Could not load model asset "${id}". Falling back to procedural art.`, error);
  }
}

function cloneMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((item) => cloneSingleMaterial(item));
  }

  return cloneSingleMaterial(material);
}

function cloneSingleMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone();
  const mapMaterial = cloned as THREE.Material & {
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
  };

  mapMaterial.map = mapMaterial.map?.clone() ?? null;
  mapMaterial.alphaMap = mapMaterial.alphaMap?.clone() ?? null;
  mapMaterial.emissiveMap = mapMaterial.emissiveMap?.clone() ?? null;
  mapMaterial.normalMap = mapMaterial.normalMap?.clone() ?? null;
  mapMaterial.roughnessMap = mapMaterial.roughnessMap?.clone() ?? null;
  mapMaterial.metalnessMap = mapMaterial.metalnessMap?.clone() ?? null;
  markTextureForUpdate(mapMaterial.map);
  markTextureForUpdate(mapMaterial.alphaMap);
  markTextureForUpdate(mapMaterial.emissiveMap);
  markTextureForUpdate(mapMaterial.normalMap);
  markTextureForUpdate(mapMaterial.roughnessMap);
  markTextureForUpdate(mapMaterial.metalnessMap);
  return cloned;
}

function markTextureForUpdate(texture: THREE.Texture | null | undefined): void {
  if (texture) {
    texture.needsUpdate = true;
  }
}
