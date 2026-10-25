import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readGLB } from './glb-reader.js';
import { preserveFullSkinning } from './full-skinning.js';

/** Load the original full-influence skin and baked shoulder morph animation. */
export async function loadSwimV3(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB loading failed: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const raw = readGLB(buffer);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const skin = preserveFullSkinning(gltf, raw);
  const clip = gltf.animations.find(item => item.name === 'M_Swim_V3');
  if (!clip) throw new Error('The exported M_Swim_V3 clip is missing.');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  return {
    root: gltf.scene,
    mixer,
    action,
    clip,
    skin,
    play() { action.reset().play(); },
    update(deltaSeconds) { mixer.update(deltaSeconds); },
    resetToRest() {
      mixer.stopAllAction();
      gltf.scene.updateMatrixWorld(true);
      for (const mesh of skin.meshes) {
        mesh.skeleton.pose();
        mesh.morphTargetInfluences?.fill(0);
      }
      gltf.scene.updateMatrixWorld(true);
    },
  };
}