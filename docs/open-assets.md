# Open assets in ManagerStory

Everything the game ships is free to use. The new 3D match view uses only the items below.

| What | Where | Licence |
|---|---|---|
| three.js r180 (renderer, OutlineEffect) | `dist/vendor/three/` | MIT (`dist/vendor/three/LICENSE`) |
| Footballer skeleton | `dist/assets/models/footballer-rig.json` (`bones`) | ManagerStory's own data |
| Idle, walk, jog and sprint motion; header jump | `dist/assets/models/footballer-rig.json` (`clips`) | CC0 1.0 — retargeted from Quaternius' [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (free version, mirror: github.com/J-Ponzo/gltf-universal-animation-library) by `tools/build-rig.mjs` |
| Sliding tackle, goal celebration | `dist/assets/models/footballer-rig.json` (`clips.tackle`, `clips.cheer`) | CC0 1.0 — retargeted from Quaternius' [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) (`Slide_Start/Loop/Exit`) and Universal Animation Library (`Celebration`), GLB mirror: github.com/tilakpatell/tilakverse-assets (its `License.txt`: CC0 1.0, models by @Quaternius) |
| Footballer mesh, kits, faces, hair | generated at runtime by `dist/newview/footballer.js` | ManagerStory's own code |
| Pass, shot, feint, standing tackle, goalkeeper and throw-in actions | `dist/newview/actions.js` | ManagerStory's own keyframes |
| Stadium, crowd, boards, ball | generated at runtime by `dist/newview/stadium.js` and `dist/match3d-newview.js` | ManagerStory's own code |

No Mixamo or other account-gated assets are used. The earlier prototype's Mixamo "Xbot" model was removed on 2026-10-15.

Quaternius sells the "Source" editions of these libraries as a way to support the author; the animations themselves are CC0 1.0 (public domain), so using them carries no licence fee or attribution duty. The credit above is given anyway.

The library's own "Kick" is a martial-arts kick and is not used: passes and shots stay on ManagerStory's own keyframes.

To rebuild the motion data (the first file given provides the locomotion loops):

```
npm install
git clone --depth 1 https://github.com/J-Ponzo/gltf-universal-animation-library /tmp/ual
# UAL1.glb and UAL2.glb: quaternius/universal-animation-library{,-2}/Unreal-Godot/ in github.com/tilakpatell/tilakverse-assets
node tools/build-rig.mjs /tmp/ual/glTF/AnimationLibrary_Godot_Standard.gltf UAL1.glb UAL2.glb
```
