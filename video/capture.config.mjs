/**
 * Capture stage for Spatial Companion (CI-Spatial-Companion-WebXR).
 *
 * `ci-video capture` drives the REAL app through this config. The app is a single
 * route — everything filmable is an overlay state composed in apps/web/src/App.tsx
 * (Viewport3D + LogoOverlay + ChatOverlay + ControlOverlay + ChatPanel +
 * OnboardingOverlay) — so the storyboard reaches each state with `before` clicks
 * rather than with routes.
 *
 * ── PORT ──────────────────────────────────────────────────────────────────────
 * 5178, not 5173. That is the port the repo's own capture harness already uses
 * (playwright.config.capture.ts: `CAPTURE_PORT || 5178`, "5173 is frequently
 * occupied"). Reusing it means one dev server serves both the L4/L5 suites and
 * this capture, and `reuseExistingServer: true` there makes them compose.
 *
 * ── HOST: 127.0.0.1, NEVER `localhost` ───────────────────────────────────────
 * This is not cosmetic and it is not interchangeable. See hazard 10: on the
 * hostname `localhost` @react-three/xr silently injects a WebXR *emulator* and
 * its dev UI, and the dev UI's "Enter XR" button lands in frame on every shot.
 *
 * ── DETERMINISM HAZARDS FOUND IN THIS APP ────────────────────────────────────
 *
 * 1. THE AVATAR IS GPU-RASTERISED WebGL, AND IT NEVER STOPS MOVING.
 *    Scene3D.tsx keeps `frameloop` at the three.js default "always" on purpose
 *    (see its comment + docs/ANIMATION-SYSTEM-REVIEW.md C2): the mixer, blink,
 *    gaze, lip-sync and spring bones all tick every frame. Playwright's
 *    `animations: "disabled"` and the kit's FREEZE_CSS only touch CSS — they have
 *    no effect on a WebGL render loop.
 *
 *    DECISION: we do NOT mask the canvas. The avatar is the product; a masked
 *    canvas would reduce every shot to the same #0A222E rectangle with HUD chrome
 *    around it. The consequence is explicit and accepted: THIS REPO'S SHOTS ARE
 *    NOT BYTE-STABLE. They need a perceptual/tolerance comparison, not the
 *    exact-match drift gate the kit assumes (README: "Not covered: GPU-rasterised
 *    WebGL/canvas content. Mask the canvas or use a tolerance check."). The
 *    workflow's `Detect UI drift` step is therefore advisory here, not a gate.
 *
 *    SUPERSEDED FROM "DECISION" ONWARD — see hazard 13. The description is right
 *    and worth keeping: the scene does animate every frame and FREEZE_CSS does
 *    nothing to it. The decision not to mask STANDS. But the conclusion that the
 *    shots therefore cannot be stable does not: neither this note nor the kit
 *    README considers the third option, which is to stop the scene rather than
 *    hide it or tolerate it. Most shots are byte-identical now.
 *
 * 2. WebGL comes up, but the DEFAULT LAUNCH RASTERISES ON THE CPU — and that
 *    costs one shot. MEASURED on an M2 Max, Playwright 1.62 / Chromium 1234,
 *    with the kit's exact hard-coded arg list:
 *
 *      chromium.launch({args})                   -> "ANGLE (Google, Vulkan 1.3.0
 *                                                    (SwiftShader Device ...))"
 *      chromium.launch({args, channel:"chromium"}) -> "ANGLE (Apple, ANGLE Metal
 *                                                    Renderer: Apple M2 Max)"
 *
 *    The difference is the BINARY, not the flags: bare `launch()` runs Playwright's
 *    `chromium_headless_shell`, which has no GPU path and always lands on
 *    SwiftShader. Adding --use-gl=angle --use-angle=metal --enable-gpu to the
 *    headless shell does NOT change it (measured — still SwiftShader). Only
 *    `channel: "chromium"`, the full Chrome-for-Testing build, reaches Metal.
 *
 *    On SwiftShader the app is correct but slow, and #131 already tiers quality
 *    down for it. Six of seven desktop shots still capture. The seventh —
 *    `datacenter-diorama`, the only shot with a whole room of geometry — blows
 *    the kit's 30s page.screenshot budget at 1280x720 @dsf3 (3840x2160) and is
 *    recorded as a hard failure. Hardware Metal captures it in a few seconds.
 *
 *    So this config UPGRADES THE LAUNCH (see the shim below `import`). The kit
 *    hard-codes its launch args and exposes no passthrough, so the only lever
 *    available from inside a repo is to patch `chromium.launch` on the exact
 *    module instance the kit will resolve. It is deliberately conservative:
 *    it only ADDS `channel`, keeps every kit arg, and falls back to the
 *    unmodified call if the full build is not installed — so a Linux CI runner
 *    with only the headless shell behaves exactly as it does today.
 *    `CAPTURE_GPU=software` forces the old path for an A/B.
 *
 *    THE PROPER FIX IS STILL IN video-kit: a `launchOptions` passthrough in
 *    capture.mjs. Delete this shim the day that lands.
 *
 *    Consequence worth knowing: on hardware, RendererConfig's isSoftwareRenderer
 *    is false, so the scene renders at the `high` tier — 2048px shadow maps,
 *    SSAO, FXAA — instead of `low`. The shots therefore look like the product on
 *    a real GPU, which is the honest thing to put in a product video, but they
 *    are NOT pixel-comparable to a SwiftShader capture.
 *
 * 3. Playwright's fake clock does NOT stall the render loop — VERIFIED.
 *    `context.clock.install()` fakes requestAnimationFrame, which would have
 *    frozen the three.js loop mid-boot and photographed an empty canvas. Probed:
 *    with `clock.install({time})` a rAF ticker still runs ~63 ticks/s and Date
 *    advances from the pinned instant. So `fixedTime` stays on.
 *
 * 4. Scripted replies are chosen with Math.random(), NOT round-robin.
 *    llmDirected.ts picks `Math.floor(Math.random() * group.responses.length)`
 *    over the 8 greeting variants in assets/directed-responses.json. The kit
 *    seeds Math.random, but the emote/gaze/facial-tick/animation services draw
 *    from that same seeded stream on wall-clock timers, so the *number of draws
 *    before* the reply is timing-dependent and the reply text would drift.
 *    MITIGATION (below): we stub /assets/directed-responses.json with a single
 *    fixed response, so the transcript is byte-stable regardless of the PRNG.
 *    Note llmDirected splits on /[^.!?]+[.!?]+/ — a response without terminal
 *    punctuation streams as an EMPTY bubble, hence the full stops in the stub.
 *
 * 5. Onboarding state is localStorage, and shot order matters.
 *    App.tsx shows OnboardingOverlay when `ci_avatar_onboarded` is unset. Each
 *    viewport gets one fresh context, and shots are captured in storyboard order,
 *    so `first-run` is filmed with the key unset and `hud-shell` clicks "Skip"
 *    (which persists the key) for every later shot. Deliberately do NOT seed
 *    `ci_avatar_onboarded` in the init script the way tests/scenarios/_scenario.ts
 *    does — that would make the FTUE beat unfilmable. Reordering the storyboard
 *    so `first-run` is not first will silently break that beat.
 *    We use "Skip", not "Enable Mic": Enable Mic sets microphone=true, which puts
 *    ChatInput into readOnly with a "🎤 Starting..." placeholder and would make
 *    the chat beat unfillable.
 *
 * 6. XR status text is environment-derived, AND IT IS AN OPEN POLICY QUESTION.
 *    ControlOverlay derives xrStatusText from navigator.xr.isSessionSupported()
 *    for 'immersive-ar'/'immersive-vr'. Headless Chromium exposes no navigator.xr,
 *    so xrSupport stays {ar:false, vr:false}: the status line films as
 *    "XR: unavailable" and ControlButton renders Enter VR / Enter AR at opacity
 *    0.5 with cursor:not-allowed. FIVE shots carry that dock legibly — hud-shell,
 *    chat-typed, chat-turn, settings-panel and datacenter-diorama — so every dock
 *    frame in the video says the headset feature is unavailable. Two shots do not:
 *    controls-collapsed clicks "Hide Controls" first and the whole panel, status
 *    line included, drops to opacity 0 (ControlPanel.tsx isVisible), and first-run
 *    has the dock behind OnboardingOverlay's zIndex 1200 blur(6px) backdrop.
 *    (An earlier revision of this note listed controls-collapsed and omitted the
 *    chat shots; corrected here against the components.)
 *
 *    STATUS: deliberately UNCHANGED. This is a messaging decision, not a bug, so
 *    it is flagged here rather than patched silently. The two options:
 *
 *    A. (current) Accept it. README.md commits to exactly this: XR entry, Vision
 *       Pro, voice and WebGPU "are not fabricated here; only what genuinely
 *       renders headlessly is shown." The cost is that the dock never looks
 *       XR-capable, and an `xr-ready` scene is not feasible.
 *    B. Stub the capability in onContext below:
 *         await page.addInitScript(() => {
 *           Object.defineProperty(navigator, 'xr', {
 *             value: { isSessionSupported: async () => true,
 *                      addEventListener(){}, removeEventListener(){} },
 *             configurable: true,
 *           })
 *         })
 *       That is exactly what a Quest or Vision Pro browser reports, and it does
 *       flip the line to "XR: ready" and enable the buttons without ever
 *       requesting a session — MEASURED, both viewports report "XR: ready".
 *
 *       ⚠️ DO NOT PASTE THIS WITHOUT READING THE REST OF THIS PARAGRAPH. The
 *       stub is NOT confined to the status line: navigator.xr.isSessionSupported
 *       is also the first input to useXRLayout.ts:15-25, which computes
 *         isXR = (supportsImmersive && isCoarsePointer) || isXRDevice
 *       and `isCoarsePointer` splits the kit's two viewports. video-kit's
 *       VIEWPORTS (capture.mjs) build desktop as 1280x720 isMobile:false and
 *       mobile as 360x640 isMobile:true + hasTouch:true, so MEASURED under the
 *       kit's own contexts: desktop pointer:coarse=false, mobile
 *       pointer:coarse=TRUE. With the stub in place every MOBILE shot therefore
 *       renders isXR=true and the whole 9:16 cut films the headset layout on a
 *       360px phone frame: SettingsPanel goes 24rem -> 30rem wide with 1.75rem
 *       padding and 1rem fields (SettingsPanel.tsx:173/224/230), ChatPanel goes
 *       17.5rem -> 22rem (ChatPanel.tsx:58), ControlPanel buttons go 44px ->
 *       56px (ControlPanel.tsx:119). MEASURED on the settings shot: XR sizing
 *       inflates that dialog by ~62px of intrinsic height (708 -> 770 against a
 *       640px viewport, taken before the panel learned to cap itself), so even
 *       now that SettingsPanel clamps to the viewport and scrolls, the stub
 *       just pushes more of the form out of the filmed frame while the dock and
 *       chat panel bloat around it. Desktop is unaffected (isXR stays false
 *       there).
 *
 *       So Option B is a MOBILE-CUT REGRESSION, not a free win. If it is ever
 *       taken, it has to be scoped to the desktop context — onContext receives
 *       the viewport name (`config.onContext(context, { viewport, page })`), so
 *       gate the addInitScript on `viewport === "desktop"`. A repo-wide stub
 *       ships a broken 9:16 cut.
 *
 *       ALSO VERIFY LOCALLY FIRST: Scene3D.tsx calls createXRStore() and mounts
 *       <XR store={store}> on every render, so confirm @react-three/xr
 *       tolerates the partial stub before trusting it.
 *
 *    Either way the status line is stable for THIS pipeline's browser, and it is
 *    a real diff source if anyone ever captures through a browser that exposes
 *    WebXR. Not masked — there is no stable selector for it without touching app
 *    source, which is out of scope.
 *
 *    The immersive session itself stays unfilmable under both options:
 *    handleEnterVRMode/handleEnterARMode route to navigator.xr.requestSession,
 *    which no stub can satisfy, and the output would be a stereo framebuffer
 *    rather than a screenshot.
 *
 * 7. NOT volatile, checked: no clocks, uptimes, relative timestamps or live
 *    counters render anywhere in the HUD (ChatBubble carries a `timestamp` but
 *    never displays it), so no shot needs a `mask`. Fonts are self-hosted via
 *    @fontsource in apps/web/src/main.tsx — no CDN, nothing to go missing.
 *
 * 8. STAGE PREREQUISITE: `predev` runs scripts/pack-assets.mjs, which copies
 *    ~210 MB of avatars/animations/props into apps/web/public/assets (gitignored).
 *    Capture against a server whose predev has not finished yields 404s for every
 *    GLB/VRM and an empty scene.
 *
 * 9. THE AVATAR IS FRAMED AS A BUST, AND NO `before` CLICK CAN WIDEN IT.
 *    Every shot photographs head-and-shoulders: AvatarModel.tsx locates the head
 *    bone on load and calls onHeadLocated with `cameraDistance = .5` — the camera
 *    is parked 50 cm in front of the face, looking at it (Scene3D.tsx camPos/
 *    camTarget). That is why docs/media/*.png are all busts, and why the cut can
 *    say "a body" and "Body clips · 47" without ever showing a body.
 *
 *    DO NOT try to fix this by clicking the dock's "Smaller" button before the
 *    shutter. It is the obvious-looking fix and it makes the frame worse:
 *    "Smaller" is sceneActions.scaleBy(-0.1) (ControlOverlay.tsx), which only
 *    shrinks `<group scale={worldScale}>` about the floor origin (Scene3D.tsx).
 *    The camera does not re-frame — onHeadLocated runs once, on `[avatarRef.current]`
 *    — so the avatar shrinks *away from* a look-at point that stays put at the old
 *    head height, and at 0.5 m the head drops out of the bottom of the frame long
 *    before the feet come into it. "Larger" (scaleBy(+0.1), clamped at 2) crops the
 *    head instead. Neither is a framing control; they are XR world-scale controls.
 *
 *    The honest ways to get a body in frame are app-side, not capture-side:
 *    widen `cameraDistance`/expose it as a prop, or film the existing full-body
 *    rig — apps/web/src/harness/AvatarHarness.tsx is served as its own Vite entry
 *    at /harness.html and already has a `?shot=body` preset (d 4.5, fov 30) that
 *    frames the whole avatar with the real AvatarModel and the real services.
 *    The harness renders no HUD, so it cannot stand in for a product screen — it
 *    would be an avatar beat of its own, and that is a storyboard decision.
 *
 * 10. `localhost` PUTS A DEVELOPER TOOL IN EVERY FRAME. This is why baseURL below
 *    resolves to 127.0.0.1, and the two hostnames are NOT interchangeable here.
 *
 *    Scene3D.tsx calls `createXRStore()` with no options. @pmndrs/xr's store.js
 *    defaults `emulate` to 'metaQuest3' and its injection gate to
 *    `{ hostname: 'localhost' }`:
 *
 *      const emulate = options?.emulate ?? 'metaQuest3'
 *      const inject  = (typeof emulate === 'object' ? emulate.inject : undefined)
 *                      ?? { hostname: 'localhost' }
 *      if (inject === true || window.location.hostname === inject.hostname) {
 *        injectEmulator(store, emulate, false)   // pulls in @iwer/devui
 *      }
 *
 *    So on `localhost`, and only there, the app loads IWER — the Immersive Web
 *    Emulation Runtime — and mounts its dev UI. That dev UI renders a dark
 *    "Enter XR" pill at top-centre, which lands directly behind the Companion
 *    Intelligence logo card and pokes out above it. It was in all seven of the
 *    first desktop captures. It is a developer tool, not product UI, and a
 *    product video must not show it. MEASURED: `document.body` carries 10
 *    children on localhost vs 6 on 127.0.0.1 — the four extras are the dev UI.
 *
 *    Do not "fix" this by hiding the pill with CSS. Suppressing the widget while
 *    leaving IWER loaded still leaves an emulated `navigator.xr` in the page, and
 *    hazard 6 explains what a live navigator.xr does to the mobile cut. Changing
 *    the hostname keeps the emulator out of the page entirely.
 *
 *    Two things this does NOT change, both checked: `navigator.xr` is defined on
 *    both hostnames (Chromium 1234 exposes the interface with no devices behind
 *    it, so isSessionSupported resolves false either way), and the mobile layout
 *    is byte-for-byte the same — ChatPanel measures 12.5rem, its non-XR mobile
 *    width, so useXRLayout's isXR stays false and hazard 6's Option-B regression
 *    was never actually triggered. Only the dev UI differs.
 *
 * 11. THERE IS A T-POSE WINDOW AFTER `networkidle`, AND IT IS ~2 SECONDS WIDE.
 *    The avatar GLB resolves before its idle clip starts driving the mixer, so
 *    for a moment the rig sits in its bind pose — arms straight out. MEASURED on
 *    hardware GL, shutter after `networkidle` + N ms:
 *
 *      N = 1200  T-POSE, arms spanning the full frame
 *      N = 2500  settled, arms down, idle running
 *      N = 4000  settled          N = 6000  settled
 *
 *    Every other shot already clears this by accident, because each carries a
 *    `before: [{ wait: 2500 }]` on its way to some click. `first-run` has no
 *    clicks — it photographs the modal on arrival — so it had nothing to hide
 *    behind and shipped a T-posed avatar behind the onboarding blur. Its
 *    `settle` is 3000 for that reason alone; do not trim it back.
 *
 *    Worth knowing that this got WORSE on hardware. Under SwiftShader the whole
 *    boot was slow enough that 1200 ms landed after the clip had started. Going
 *    faster moved the shutter INTO the window. A load-state artifact that only
 *    appears on the fast path is the kind that survives review.
 *
 *    SUPERSEDED IN PART — see hazard 12. The premise above is that the capture
 *    runs on hardware GL. Measured 2026-08-07 it does not, and under the
 *    software rasteriser the rig never leaves bind pose at ANY settle, so no
 *    amount of waiting fixes it. The settle values are still correct and should
 *    not be trimmed; they were simply never the binding constraint.
 *
 * 12. `channel: "chromium"` ALONE DOES NOT REACH THE GPU. IT MUST BE ASSERTED.
 *    The shim below used to add only `channel: "chromium"`, on the theory that
 *    the full Chromium build rasterises on the GPU where the headless shell does
 *    not. Measured on an M2 Max, 2026-08-07, asking the page for its UNMASKED
 *    renderer:
 *
 *      bare launch                      SwiftShader
 *      channel: "chromium"              SwiftShader
 *      channel + the kit's arg list     SwiftShader
 *      channel + headless: false        SwiftShader
 *      channel + --use-angle=metal      ANGLE Metal Renderer: Apple M2 Max
 *
 *    So every shot in this project was captured on a software rasteriser, and
 *    that is what put the A-pose in the committed frames. Sampling the avatar in
 *    `?env=datacenter-1970s` at networkidle + N ms:
 *
 *              N =  1000   2500     4000    6000   10000   16000   24000
 *      Metal      bind    waving    arms out  ...   IDLE    IDLE    IDLE
 *      SwiftShader bind    bind      bind    bind    bind    bind    bind
 *
 *    Under SwiftShader the pose is byte-identical across all seven marks: the
 *    mixer is not driving the rig, full stop. On Metal the avatar greets and
 *    then settles into its idle. The A-pose was never a timing artifact and
 *    never real app behaviour — it was the renderer.
 *
 *    The shim now appends the ANGLE flags and PROBES the result, refusing the
 *    capture if it still landed on software. A silent software fallback is
 *    exactly how a mannequin shipped; make it loud. `CAPTURE_GPU=software`
 *    still opts out, and now means "I accept an un-animated avatar".
 *
 * 13. THE SCENE IS PINNED WHILE IT IS PHOTOGRAPHED, AND THAT IS WHAT MADE THE
 *    SHOTS WORTH COMMITTING. onContext sets window.__CI_CAPTURE_MODE__; the
 *    whole rationale lives next to the code it governs, in
 *    packages/core/src/services/capture/captureMode.ts. What matters here:
 *
 *    MEASURED BEFORE, three consecutive `make.sh --no-render` runs on one pinned
 *    kit, worst pair: 8 of 18 shots differed, peak delta 34/255, and the two
 *    datacenter shots differed across 7-16% of their pixels. Three named causes
 *    — the blink schedule, the diorama's pulsing indicator lamps, and
 *    sub-visible pose drift — all of them wall-clock driven.
 *
 *    MEASURED AFTER, same protocol, on the kit these shots were captured with
 *    (video-kit 0.13.1): 17 of 18 byte-identical across all three runs, and 18
 *    of 18 between runs 1 and 3. The single exception was datacenter-diorama at
 *    16:9, differing on 0.45% of its pixels at a peak of 2/255 — nothing above
 *    8/255 anywhere in the shoot. The scene-level drift is gone, and the four
 *    datacenter shots, the ones that used to be worst by two orders of
 *    magnitude, are byte-identical.
 *
 *    An earlier pass on 0.13.0 measured a looser 13-14 of 18 with a peak of
 *    25/255 in the settings dialogs. That is what the drift envelope below is
 *    sized for; it is deliberately NOT retightened onto the better numbers
 *    above, because one clean shoot is not evidence that 2/255 is the ceiling.
 *
 *    TWO THINGS THAT DO NOT WORK, both tried and measured, so nobody spends the
 *    afternoon again:
 *
 *    - PAUSING PLAYWRIGHT'S CLOCK. context.clock.pauseAt() plus paying out
 *      virtual time through clock.runFor() does make requestAnimationFrame
 *      deterministic — the kit's fake clock implements rAF as a 16 ms timer, so
 *      a paused clock renders no frames and runFor advances in exact steps. It
 *      is still strictly worse: the app streams ~243 MB of avatar assets on real
 *      time, so the virtual budget gets spent at an arbitrary point in the LOAD
 *      rather than the animation. All 18 shots then drifted, against 8 before,
 *      and first-run.mobile came out with no avatar in the frame at all.
 *    - SETTLING ON THE RENDER LOOP. "Wait for N consecutive frames with an
 *      unchanged framebuffer" cannot terminate here: without capture mode the
 *      idle clip, the blink and the lamps never stop, so it would spin to its
 *      timeout on every shot and then photograph an unsettled frame anyway.
 *
 *    THE REMAINING DIFFERENCE IS SMALL BUT NOT ZERO, so a byte comparison is
 *    still the wrong gate by a hair. Compare with an amplitude+area envelope
 *    (peak delta <= 32, and <= 0.01% of pixels differing by more than 8/255)
 *    rather than md5. Both limits are set from the measurements above and are
 *    tight enough to catch a one-button change: a 41x41 px edit is 0.0203% of
 *    the frame at delta 248, outside the envelope on both axes.
 */

import { createRequire } from "node:module";

/**
 * ── LAUNCH SHIM: run the full Chromium build so the GPU rasterises (hazard 2) ──
 *
 * video-kit's capture.mjs calls `chromium.launch({ args: [...] })` with a
 * hard-coded arg list and no options passthrough, and it resolves `playwright`
 * with `createRequire(<video/package.json>)`. This file is imported by
 * `ci-video capture` BEFORE that launch happens, and CommonJS caches by resolved
 * path — so requiring playwright here hands back the very object the kit will
 * use, and patching `launch` on it is enough.
 *
 * The patch only ADDS `channel: "chromium"`. Every kit arg is preserved, and if
 * the full build is not installed (a runner that ran `playwright install
 * chromium-headless-shell` only) the original call is retried unchanged, so this
 * can never turn a working capture into a failing one.
 */
const GPU_ARGS =
  process.platform === "darwin"
    ? ["--use-angle=metal", "--enable-gpu"]
    : ["--use-angle=vulkan", "--enable-gpu"];

/** Ask the page what actually rasterised it. Returns the UNMASKED renderer string. */
const probeRenderer = async (browser) => {
  const page = await browser.newPage();
  try {
    await page.goto("about:blank");
    return await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return "no webgl2";
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "no debug ext";
    });
  } finally {
    await page.close();
  }
};

if (process.env.CAPTURE_GPU !== "software") {
  try {
    const pw = createRequire(import.meta.url)("playwright");
    if (pw?.chromium && !pw.chromium.__ciHardwareLaunch) {
      const original = pw.chromium.launch.bind(pw.chromium);
      pw.chromium.launch = async (options = {}) => {
        const args = [...(options.args ?? []), ...GPU_ARGS];
        let browser;
        try {
          browser = await original({ ...options, args, channel: "chromium" });
        } catch (err) {
          console.warn(`  ! full Chromium unavailable (${err.message.split("\n")[0]}); falling back to the headless shell / SwiftShader`);
          return original(options);
        }
        const renderer = await probeRenderer(browser);
        const software = /SwiftShader|llvmpipe|Software|Mesa Offscreen/i.test(renderer);
        console.log(`  · GL renderer: ${renderer}`);
        if (software) {
          // Hazard 12 (below). A software rasteriser does not merely make the
          // capture slow — the animation mixer never drives the rig at all, and
          // every full-body shot ships a bind-pose mannequin. Refuse rather
          // than photograph it, unless the caller has opted in explicitly.
          await browser.close();
          throw new Error(
            `capture refused: WebGL fell back to a software rasteriser (${renderer}).\n` +
              `  The avatar never leaves its bind pose under SwiftShader — measured identical at 1s and 24s —\n` +
              `  so every full-body shot would ship an A-posed mannequin. Fix the GPU path, or set\n` +
              `  CAPTURE_GPU=software to capture anyway and accept that the avatar will not be animating.`,
          );
        }
        return browser;
      };
      pw.chromium.__ciHardwareLaunch = true;
    }
  } catch (err) {
    if (err?.message?.startsWith("capture refused:")) throw err;
    /* playwright not installed yet — the kit raises its own, better error */
  }
}

/**
 * Single deterministic reply, standing in for the 8-way random greeting set.
 *
 * The trigger list carries the storyboard's own prompt verbatim so llmDirected's
 * exact-match branch fires (llmDirected.ts findMatch: `triggers.includes(lowerMessage)`),
 * with "default" kept as the belt-and-braces fallback for any other prompt.
 */
const SCRIPTED_RESPONSES = {
  triggers: [
    {
      triggers: ["where do my messages go?", "hello", "hi", "hey", "default"],
      responses: [
        {
          id: "capture-greeting",
          response: "Nowhere. I run entirely on this machine, so nothing you say leaves it.",
          emotion: "friendly",
        },
      ],
    },
  ],
};

export default {
  // 127.0.0.1, not localhost — hazard 10. The dev server binds both (vite
  // `server.host: true`), so this is purely about which hostname the page sees.
  baseURL: process.env.CAPTURE_BASE_URL ?? `http://127.0.0.1:${process.env.CAPTURE_PORT ?? 5178}`,

  // The shell is dark-ONLY by design (apps/web/src/styles/index.css: "we keep
  // color-scheme: dark and do not ship a light shell"), and index.html hard-sets
  // class="dark", so this matches rather than overrides the app.
  colorScheme: "dark",
  locale: "en-US",
  timezoneId: "UTC",
  // Safe here — verified above that the fake clock does not stall requestAnimationFrame.
  fixedTime: "2026-06-15T15:04:00Z",

  // No auth: the app has no login wall. It is a static SPA plus an optional
  // same-origin BFF proxy, and we pin it to the offline `script` provider below.

  async onContext(context, { page }) {
    // Pin the LLM to the offline scripted provider, the same way the repo's own
    // L4 scenario suite does (tests/scenarios/_scenario.ts DIRECTED_SCRIPT_INIT).
    // window.__APP_CONFIG__ is honoured synchronously by loadRuntimeConfig before
    // first render, so it wins over any container-generated /config.json.
    // NOTE the deliberate omission of `ci_avatar_onboarded` — see hazard 5.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("ci_avatar_llm_overrides");
      } catch {
        /* storage may be unavailable */
      }
      window.__APP_CONFIG__ = { llm: { llm_provider: "script" } };

      // Hold the scene still for the photograph — hazard 13. Read before first
      // render by packages/core/src/services/capture/captureMode.ts, which is
      // where the whole rationale lives. Set here rather than by URL so it can
      // never reach a real user, and set in the SAME init script as the LLM pin
      // so the two cannot drift apart.
      window.__CI_CAPTURE_MODE__ = true;
    });

    // Freeze the transcript: one fixed reply instead of an 8-way Math.random pick.
    await context.route("**/assets/directed-responses.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SCRIPTED_RESPONSES),
      })
    );

    // Anything reaching for a network LLM means the script pin failed — fail loud
    // rather than filming a spinner.
    await context.route(/\/api\/(chat|generate)/, (route) => {
      console.warn(`  ! blocked live LLM call: ${route.request().url()}`);
      return route.abort();
    });

    // Warn loudly if an external asset fails — an unstyled capture looks like a
    // UI regression but is really a network failure. Also surfaces a missing
    // pack-assets run (hazard 8) as 404s on /assets/avatars/*.
    context.on("requestfailed", (req) => {
      if (/fonts\.(googleapis|gstatic)|cdn\.|\/assets\/(avatars|animations|props)\//.test(req.url())) {
        console.warn(`  ! asset failed: ${req.url()}`);
      }
    });
  },
};
