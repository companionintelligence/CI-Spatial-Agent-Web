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
 * 2. WebGL under the kit's launch args — VERIFIED WORKING, no flags needed.
 *    playwright.config.capture.ts passes --use-gl=angle / --use-angle=swiftshader
 *    / --enable-unsafe-swiftshader, and the kit hard-codes its own launch args
 *    with no passthrough. Probed directly with the kit's exact arg list on
 *    Playwright 1.58's Chromium 145 headless shell: webgl2 comes up on
 *    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...))". So the avatar
 *    rasterises and Scene3D does NOT fall through to GraphicsFallback
 *    ("Graphics Unavailable"). If a future Chromium drops the implicit
 *    SwiftShader fallback, that is exactly the symptom to expect, and the fix
 *    belongs in video-kit (a `launchArgs` passthrough), not here.
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
 *    0.5 with cursor:not-allowed. FOUR shots carry that dock — hud-shell,
 *    controls-collapsed, settings-panel and datacenter-diorama — so every dock
 *    frame in the video says the headset feature is unavailable.
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
 */

/** Single deterministic reply, standing in for the 8-way random greeting set. */
const SCRIPTED_RESPONSES = {
  triggers: [
    {
      triggers: ["hello", "hi", "hey", "default"],
      responses: [
        {
          id: "capture-greeting",
          response:
            "Hello. I run entirely on this machine, so nothing you say leaves it. Ask me anything.",
          emotion: "friendly",
        },
      ],
    },
  ],
};

export default {
  baseURL: process.env.CAPTURE_BASE_URL ?? `http://localhost:${process.env.CAPTURE_PORT ?? 5178}`,

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
