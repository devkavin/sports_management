# Responsive popups

All modal editors and confirmations use the shared viewport-aware dialog shell. The safety-report editor now uses the same shell rather than a separate fixed overlay. The dialog layer respects safe-area insets and tracks the browser's visual viewport for resizing, zoom and on-screen keyboard changes. Its available height is exposed as `--dialog-available-height` for custom editor grids.

Simple forms keep a non-shrinking header and a scrollable body. Large schedule/session editors use bounded grids; if headers and actions exceed a very short viewport, the outer dialog provides scrolling as a fallback. Long labels wrap, form controls can shrink, small-screen field grids stack, and action rows wrap. Performance logging no longer has oversized inner margins or a narrow card inside a much wider dialog shell. Feedback is rendered within the popup layout rather than covering actions as a fixed toast.

Tour cards use bounded geometry with overflow scrolling. Header dropdowns use narrow-screen viewport positioning and bounded height. Dialog focus trapping, nested dialogs, Escape, busy-save protection and unsaved-change handling remain in place.

## Verification

Frontend TypeScript and 47 frontend tests pass. New tests exercise visual-viewport resize/pan and cleanup, window-size fallback, and tour placement at narrow/short dimensions. Browser checks used actual components in the backend-disabled fixture at `frontend/tests/fixtures/responsive-dialogs.html`: workout logging, schedule builder, session editor, performance standard editor and a long generic form. At 320×568, 568×320, 375×667 and 1024×600, all 20 dialog layouts stayed within viewport bounds and had zero horizontal overflow. Keyboard focus reached the performance editor's footer actions at phone and landscape sizes.

The test fixture contains layout-only objects; they are not seeds or application defaults. It blocks all fetch calls and never saves results or changes database state. To inspect it, run the existing Vite development server and open `/tests/fixtures/responsive-dialogs.html`. It is not imported by the production entry point.

Real mobile keyboard auto-panning, pinch zoom, browser-native date/time picker popovers and touch scrolling require device acceptance checks. The visual viewport math is unit-tested, but no claim of exhaustive device testing is made. Browser-native picker popovers are controlled by the browser, not the shared modal CSS.

No migrations, database operations, backend startup, Docker commands or production builds were run for this change. Rebuild the frontend using your usual deployment commands.
