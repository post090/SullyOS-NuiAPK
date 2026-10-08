# Chibi acrylic stand experiment

Sully `back1_99` keeps its authored curl as a compact crown detail: the liner uses a thinner rim and a compressed exposed contour with the opening above the scalp. This is scoped to the asset ID; other back-hair liners retain their original tuck. The editor offers the four Sully hair layers separately, without a whole-hairstyle shortcut.

2026-09-16 — Wrapped back1 additionally has a thin inner wisp layer (`rearHairLiner.ts`): source side/top wisps project outward while the cap root is tucked inside the scalp. It shares the layer transforms and solid color; top details retain their shape instead of being height-clamped. A shallow .022 half-depth curved shell adds subtle roundness and closes the rim. The automatic liner is not a saved extra layer and is absent for projected back1/full extra wraps. Back2 retains its original artwork.

2026-09-16 — Active outward hair now uses paired curved sheets (`apps/room3d/chibi/hairShell.ts`). Both faces reuse the same source artwork and source-canvas UVs. Elliptical cross-sections follow each disconnected tuft's centerline; a rounded, untextured hair-colored rim joins front and rear. Subpixel contours preserve holes and thin tips. This replaces the old silhouette-distance padding. The existing saved `puff` value now controls curved-sheet depth and is labelled 发片厚度. Ordinary scalp-wrap hair is unchanged. Nine hair geometry/classification/seam tests and front/side/rear browser checks passed.

Current preview: `/chibi-experiment.html`, using the port printed by `pnpm dev`. Independent from the app; no entry or database writes.

`AcrylicStand.tsx` uses the original composited 2D chibi without projection or facial repositioning. It trims transparent margins, builds a softly rounded outer acrylic silhouette from horizontal alpha spans, sandwiches the print between two beveled clear sheets, and seats a clear tab in a lavender acrylic base. Thin transparent surfaces preserve print sharpness; the base uses transmission. The same print is visible reversed from behind. Rotation and original-image comparison remain available.

The earlier FBX/body/hair trials remain as unused experimental source for comparison. They are not imported by the active preview (the Parts type import is erased). No new dependencies or version bump.

Finish pass: each sheet now has 0.075 model-unit depth plus rounded 0.009 bevels, with separate clear face and tinted polished edge materials. The base has a beveled 0.165-deep body, a real through-slot, thin perimeter highlights, a subtle KANATA top mark, and a soft radial contact shadow.

Current active mode: returned to FBX 3D with two zero-thickness hair sheets. Both halves use the same elliptical ring parameterization and share side-edge positions; front combines ear/front hair, rear combines both back layers. Projected UVs retain the source art's front-view registration. No hair extrusion or separate solid hair shell. The acrylic stand remains in AcrylicStand.tsx as an unused alternative. Alpha gaps in individual artwork can still expose the dyed scalp.

Latest correction: removed all hair-colored scalp materials from the FBX, so the underlying head is skin-colored throughout. Added a bare-body comparison. Hair uses unchanged source-canvas Y registration; a level orthographic preview avoids length exaggeration from front hair sitting nearer a tilted camera.

Side closure pass: zero-thickness side strips bridge transparent source margins with front/back edge colors and an elliptical opening around each ear. No scalp dye was reintroduced. Body normals are averaged across coincident FBX triangle corners after deformation, preserving the original vertex positions, UVs and material seams while removing faceted lighting.

User-directed rollback: removed both side-closure strips. Hair remains only front/rear sheets; the existing scalp beneath gaps now samples front/back hair colors, excluding the face and protruding ears. Smooth body normals are retained. Bare comparison disables scalp tint.

Motion set: cute wave (small hop/head tilt), calm wave (stationary), sleep (side lying/closed eyes/breathing), anger (shake/stomp), walk and sway. On user correction, removed all hand vertex stretching: original hand triangles now use rigid part transforms with small rotation/translation only. These are still experimental mesh partitions rather than a production skeletal rig. Motion changes reset the animation phase; pause freezes time.

Gap-fill refinement: added a zero-thickness solid-color side underlay with ear cutouts, using the mean front/back hair color. This piece has no UV attribute or texture map; original front/rear UVs remain unchanged and follow the same head tilt. Cute waving uses a dedicated >< eye texture.

Native roll: CreatorRollBridge runs an isolated same-origin srcdoc copy of the existing creator and invokes randomizeAll. It preserves the original palette, tinting, linked hair colors, selection/legacy filters and multi-part rules; captures rendered layers after image/tint completion; and supplies them to the 3D preview. Production creator source is unchanged; preview draft-save calls and unused external scripts are disabled in the copy. Message source/origin and request IDs are checked. The 2D comparison uses the full creator composition; accessories in 3D remain projected onto the existing head surface, not individually modeled.

Decoration routing: split the original decor canvas at the same source-Y boundary as the face/body materials. Face-region pixels overlay the face (including alternate eye expressions); body-region pixels overlay the front clothing. Decorations are no longer included on the hair ring. Source coordinates and the full original 2D comparison remain unchanged; rear garment edge-color extension excludes decoration pixels.

Head proportion adjustment: head Z depth is 68% of the supplied FBX, blended above the neck. Front-view width/height and UV coordinates are preserved; both hair half-sheets and the plain gap underlays (including ear openings) use the same depth factor. Body and hands retain their original dimensions.

Depth/lighting balance: head and matching hair depth revised from 68% to 82% of the original. Replaced strong directional contrast with neutral ambient/hemisphere fill, weaker key/rim lights and softer ground shadow settings.


Room boundaries (2026-09-16): the world preview now includes cutaway/dollhouse/hidden wall views, shared-boundary merge/split, and wide hinged/arched/sliding doors with floor-click pathfinding. Preview home state persists independently under `chibi-world-experiment-home`; appearance and hair keys remain separate. See docs/room3d.md for interaction and collision rules.
