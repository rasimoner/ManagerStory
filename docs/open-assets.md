# Open assets in ManagerStory

Everything the game ships is free to use. The new 3D match view uses only the items below.

| What | Where | Licence |
|---|---|---|
| three.js r180 (renderer, OutlineEffect) | `dist/vendor/three/` | MIT (`dist/vendor/three/LICENSE`) |
| Footballer skeleton | `dist/assets/models/footballer-rig.json` (`bones`) | ManagerStory's own data |
| Idle, walk, jog and sprint motion | `dist/assets/models/footballer-rig.json` (`clips`) | CC0 1.0 — retargeted from Quaternius' [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (free version, mirror: github.com/J-Ponzo/gltf-universal-animation-library) by `tools/build-rig.mjs` |
| Footballer mesh, kits, faces, hair | generated at runtime by `dist/newview/footballer.js` | ManagerStory's own code |
| Pass, shot, feint, tackle, goalkeeper and throw-in actions | `dist/newview/actions.js` | ManagerStory's own keyframes |
| Stadium, crowd, boards, ball | generated at runtime by `dist/newview/stadium.js` and `dist/match3d-newview.js` | ManagerStory's own code |

No Mixamo or other account-gated assets are used. The earlier prototype's Mixamo "Xbot" model was removed on 2026-10-15.

To rebuild the motion data:

```
git clone --depth 1 https://github.com/J-Ponzo/gltf-universal-animation-library /tmp/ual
node tools/build-rig.mjs /tmp/ual/glTF/AnimationLibrary_Godot_Standard.gltf
```
