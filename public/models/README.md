# High Noon Duel Model Assets

Runtime models in this folder are optional visual upgrades. The game keeps procedural fallbacks for enemies, guns, and town props so missing model files should not break a duel.

## Current Assets

All current model files are Public Domain / CC0 1.0.

| File | Source | Creator | Notes |
| --- | --- | --- | --- |
| `characters/cowboy-mastjie.glb` | https://poly.pizza/m/S8hq7LEXTT | mastjie | Enemy visual accent. |
| `characters/cowgirl-mastjie.glb` | https://poly.pizza/m/bB93W7ZTmG | mastjie | Enemy visual accent. |
| `weapons/revolver-quaternius-a.glb` | https://poly.pizza/m/9C26wSpMS0 | Quaternius | Player revolver visual. |
| `weapons/revolver-quaternius-b.glb` | https://poly.pizza/m/XrnLUz6kQj | Quaternius | Enemy revolver visual. |
| `weapons/revolver-creativetrio.glb` | https://poly.pizza/m/wFQbxzzgqU | CreativeTrio | Spare revolver option. |
| `buildings/big-barn-quaternius.glb` | https://poly.pizza/m/q1N3xn2SpC | Quaternius | Distant town accent. |
| `buildings/large-building-kenney.glb` | https://poly.pizza/m/ppwtREejXg | Kenney | Distant town accent. |
| `props/barrel-quaternius.glb` | https://poly.pizza/m/ONdghDBByN | Quaternius | Street prop accent. |
| `props/crate-quaternius.glb` | https://poly.pizza/m/3VGWnZPXmG | Quaternius | Street prop accent. |
| `props/cactus-quaternius.glb` | https://poly.pizza/m/HsEJgRLQWX | Quaternius | Desert prop accent. |

## Asset Rules

- Prefer `.glb` for runtime.
- Keep procedural fallbacks for required gameplay objects.
- Keep individual reusable visual models under 6 MB unless streaming is added.
- Use imported buildings as accents until collision and culling are more mature.
- Do not add assets with attribution requirements unless the attribution is tracked here and in the game credits.

## FBX Conversion Notes

Blender was found locally at:

`C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`

For FBX-only packs, convert selected models to GLB in Blender and place the results under `public/models`. Keep source zips out of the runtime folder unless they are intentionally tracked.
