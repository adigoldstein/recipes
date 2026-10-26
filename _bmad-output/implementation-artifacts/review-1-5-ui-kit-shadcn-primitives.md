# Review: Story 1.5 UI kit (shadcn primitives, Storybook, AppProviders, --input)

Status: ready for Adi's review. Nothing is committed or pushed.

## Checks run (all green, `--skip-nx-cache`)

- `npx nx run-many -t lint typecheck test build build-storybook` (7 projects): ui-components 67 tests, web 17, i18n 3, lint-checks 75.
- `npx nx format:check`: clean.

## Needs Adi's decision

1. **`--input` border preview.** Storybook story "Foundations / Input border (for approval)": `npx nx storybook ui-components --port 6006`, then http://localhost:6006/?path=/story/foundations-input-border-for-approval--before-and-after, Light/Dark toolbar toggle. Values: light `#857f75`, dark `#7a726a` (>= 3:1 on background, card and popover, asserted in `theme-contrast.spec.ts`). The Input does not ship until this is approved.
2. **Hebrew lint exemption for `*.stories.tsx`** (stories show sample copy). Colour ban stays; fixtures added in `tools/lint-checks`.
3. Small adaptations of shadcn output (listed in `ui-component-inventory.md`): 44 px controls, ToggleGroup trimmed to pill chips, `closeLabel` prop instead of English "Close", Toaster `theme` prop, `bg-black/10` overlay replaced by `bg-foreground/20`.

## Decisions applied (Adi, "okay for all 3")

- `AppProviders` in `apps/web/src/app/app-providers.tsx` (also mounts the Toaster with the app's theme and a Hebrew region label from `he.json`).
- Toaster takes `theme` from the app; no `next-themes`.
- Stronger `--input` values as above.

## Notes

- `shadcn add` wrote `cn` and `next-themes` dependencies into `libs/ui-components/package.json` and a bogus `from "cn"` import; both removed (README notes the gotcha).
- `@nx/storybook` pinned at 24.0.0 (matches the other Nx packages); Storybook packages pinned at 10.6.4. `storybook-static` is git- and prettier-ignored and ESLint-ignored.
- `.claude/launch.json` (git-ignored) got a `storybook` entry for the preview pane.
- Not done in this story: sprint-status.yaml sync, README link to published Storybook (Story 6.5).

## Changed files

```
 M .github/workflows/ci.yml
 M .gitignore
 M .prettierignore
 M _bmad-output/implementation-artifacts/deferred-work.md
 M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
 M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
 M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/reviews/review-adversarial.md
 M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/reviews/review-rubric.md
 M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/reviews/review-versions.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/.memlog.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/review-adversarial-general.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/review-rubric.md
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/validation-report.html
 M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/validation-report.md
 M _bmad-output/planning-artifacts/ui-component-inventory.md
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/.memlog.md
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/DESIGN.md
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/EXPERIENCE.md
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/mockups/assets/credits.json
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/mockups/directions.html
 M _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/mockups/key-screens.html
 M apps/web/src/app/router.spec.tsx
 M apps/web/src/app/theme.spec.tsx
 M apps/web/src/main.tsx
 M apps/web/src/test-setup.ts
 M eslint.config.mjs
 M libs/i18n/src/he.json
 M libs/ui-components/README.md
 M libs/ui-components/package.json
 M libs/ui-components/src/index.ts
 M libs/ui-components/src/styles/theme-contrast.spec.ts
 M libs/ui-components/src/styles/theme.css
 M libs/ui-components/tsconfig.json
 M libs/ui-components/tsconfig.lib.json
 M libs/ui-components/tsconfig.spec.json
 M libs/ui-components/vite.config.mts
 M nx.json
 M package.json
 M tools/lint-checks/src/eslint-rules.spec.ts
?? _bmad-output/implementation-artifacts/review-1-5-ui-kit-shadcn-primitives.md
?? _bmad-output/implementation-artifacts/spec-1-5-ui-kit-shadcn-primitives.md
?? apps/web/src/app/app-providers.tsx
?? apps/web/src/main.spec.tsx
?? libs/ui-components/.storybook/
?? libs/ui-components/src/components/shell.stories.tsx
?? libs/ui-components/src/components/ui/alert-dialog.tsx
?? libs/ui-components/src/components/ui/button.stories.tsx
?? libs/ui-components/src/components/ui/dialog.tsx
?? libs/ui-components/src/components/ui/dropdown-menu.tsx
?? libs/ui-components/src/components/ui/form-controls.spec.tsx
?? libs/ui-components/src/components/ui/forms.stories.tsx
?? libs/ui-components/src/components/ui/input.tsx
?? libs/ui-components/src/components/ui/label.tsx
?? libs/ui-components/src/components/ui/overlays.spec.tsx
?? libs/ui-components/src/components/ui/overlays.stories.tsx
?? libs/ui-components/src/components/ui/select.tsx
?? libs/ui-components/src/components/ui/skeleton.tsx
?? libs/ui-components/src/components/ui/sonner.tsx
?? libs/ui-components/src/components/ui/table.tsx
?? libs/ui-components/src/components/ui/toggle-group.tsx
?? libs/ui-components/src/components/ui/toggle.tsx
?? libs/ui-components/src/styles/input-border.stories.tsx
?? libs/ui-components/src/test-setup.ts
?? libs/ui-components/tsconfig.storybook.json
```

(`package-lock.json` also changed: adds the Storybook, `@nx/storybook` and `sonner` packages; diff omitted for size.)

## Full diff (new files included, lockfile excluded)

```diff
diff --git a/_bmad-output/implementation-artifacts/spec-1-5-ui-kit-shadcn-primitives.md b/_bmad-output/implementation-artifacts/spec-1-5-ui-kit-shadcn-primitives.md
new file mode 100644
index 0000000..0bcc581
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-1-5-ui-kit-shadcn-primitives.md
@@ -0,0 +1,61 @@
+---
+title: 'Story 1.5: UI kit: shadcn primitives in ui-components'
+type: 'feature'
+created: '2026-10-26'
+status: 'draft'
+route: 'dispatch'
+baseline_commit: '15ca06c'
+context:
+  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
+  - '{project-root}/_bmad-output/planning-artifacts/ui-component-inventory.md'
+  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** `libs/ui-components` has only Button, TopBar, ThemeToggle and Board. Epics 1-2 need ten more primitives, no Storybook documents the kit, `main.tsx`'s provider tree is untested, and input borders (`--input`, 1.25:1) fail WCAG 1.4.11.
+
+**Approach:** Add the ten primitives with the shadcn CLI (tokens only), set up Storybook 10 on `libs/ui-components` (theme CSS, RTL decorator, light/dark toggle, a11y), extract a shared `AppProviders`, and add a stronger `--input` token with a contrast test and a Storybook preview for Adi's approval.
+
+## Boundaries & Constraints
+
+**Always:**
+
+- ACs of Story 1.5 in `epics.md` are the contract.
+- Tokens only; logical utilities only; no arbitrary values (ESLint already enforces).
+- `libs/ui-components` stays presentational: no i18next, router, TanStack Query, storage, or app theme context (AD-2).
+- Exact pinned versions for new packages (Storybook 10.6.4).
+- Generated shadcn files get their imports rewritten to relative paths (see ui-components README).
+
+**Never:**
+
+- No commit or push before Adi approves the review file.
+- The Input does not ship before Adi approves the `--input` preview.
+- No primitives beyond the ten (Textarea, Tabs, etc. are just-in-time in later stories).
+
+</frozen-after-approval>
+
+## Plan (awaiting Adi)
+
+1. Packages: `@nx/storybook`, `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y` (10.6.4 exact), `sonner`.
+2. Primitives via `shadcn add`: input, label, skeleton, toggle-group, dropdown-menu, sonner, dialog, alert-dialog, select, table. Tokenise arbitrary values, rewrite imports.
+3. Specs: render, keyboard operability, dialog focus trap and restore.
+4. Storybook: `.storybook/` (preview with theme CSS, RTL + DirectionProvider decorator, light/dark toolbar, a11y), one `*.stories.tsx` per component (14 total incl. Button, TopBar, ThemeToggle, Board), `build-storybook` in CI via `nx affected`.
+5. `AppProviders` shared by `main.tsx` and specs, plus a bootstrap test.
+6. `--input` token: stronger value in both themes, assertions in `theme-contrast.spec.ts`, Storybook "Input border" preview for approval.
+7. Docs: inventory, deferred-work, README, spine/memlog.
+
+## Open choices (Adi)
+
+- **AppProviders location:** `apps/web/src/app/app-providers.tsx` (recommended; it needs i18n and ThemeProvider, which `type:ui` may not import) vs a new `libs/app-shell`.
+- **Sonner theme:** `Toaster` takes a `theme` prop passed by the app (recommended; keeps ui-components free of app theme context) vs adding `next-themes`.
+- **`--input` values:** light `#857f75` (3.42:1 on background, 3.77:1 on card), dark `#7a726a` (3.75:1 on background, 3.38:1 on card). `--border` stays subtle.
+
+## Spec Change Log
+
+## Verification
+
+- `npx nx run-many -t lint typecheck test build build-storybook --skip-nx-cache` -- all green
+- `npx nx format:check` -- clean
diff --git a/apps/web/src/app/app-providers.tsx b/apps/web/src/app/app-providers.tsx
new file mode 100644
index 0000000..f287421
--- /dev/null
+++ b/apps/web/src/app/app-providers.tsx
@@ -0,0 +1,30 @@
+import type { ReactNode } from 'react';
+import { useTranslation } from 'react-i18next';
+import { initI18n } from '@bite-and-board/i18n';
+import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
+import { ThemeProvider, useTheme } from './theme';
+
+initI18n();
+
+// The Toaster is a UI-lib component that cannot read the app's theme, so the
+// app passes the mode in.
+function AppToaster() {
+  const { t } = useTranslation();
+  const { mode } = useTheme();
+  return <Toaster theme={mode} customAriaLabel={t('toast.region')} />;
+}
+
+/**
+ * The one provider tree (i18n, RTL, theme, toasts). `main.tsx` and the specs
+ * both render through it, so a missing provider fails a test.
+ */
+export function AppProviders({ children }: { children: ReactNode }) {
+  return (
+    <DirectionProvider dir="rtl">
+      <ThemeProvider>
+        {children}
+        <AppToaster />
+      </ThemeProvider>
+    </DirectionProvider>
+  );
+}
diff --git a/apps/web/src/main.spec.tsx b/apps/web/src/main.spec.tsx
new file mode 100644
index 0000000..9078863
--- /dev/null
+++ b/apps/web/src/main.spec.tsx
@@ -0,0 +1,15 @@
+import { screen } from '@testing-library/react';
+
+// Loads the real entry point the way index.html does, so a broken provider
+// tree or route table in main.tsx fails here.
+describe('main.tsx bootstrap', () => {
+  it('mounts the app into #root in Hebrew RTL', async () => {
+    document.body.innerHTML = '<div id="root"></div>';
+    await import('./main');
+    expect(
+      await screen.findByRole('heading', { name: 'מתכונים' }),
+    ).toBeTruthy();
+    expect(screen.getByRole('banner')).toBeTruthy();
+    expect(screen.getByRole('region', { name: 'התראות' })).toBeTruthy();
+  });
+});
diff --git a/libs/ui-components/.storybook/main.ts b/libs/ui-components/.storybook/main.ts
new file mode 100644
index 0000000..f26193e
--- /dev/null
+++ b/libs/ui-components/.storybook/main.ts
@@ -0,0 +1,15 @@
+import tailwindcss from '@tailwindcss/vite';
+import type { StorybookConfig } from '@storybook/react-vite';
+
+const config: StorybookConfig = {
+  framework: '@storybook/react-vite',
+  stories: ['../src/**/*.stories.@(ts|tsx)'],
+  addons: ['@storybook/addon-a11y'],
+  // Same Tailwind pipeline as apps/web, so stories render the real tokens.
+  viteFinal: (viteConfig) => ({
+    ...viteConfig,
+    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
+  }),
+};
+
+export default config;
diff --git a/libs/ui-components/.storybook/preview.tsx b/libs/ui-components/.storybook/preview.tsx
new file mode 100644
index 0000000..63b5cc4
--- /dev/null
+++ b/libs/ui-components/.storybook/preview.tsx
@@ -0,0 +1,62 @@
+import { useEffect, type ReactNode } from 'react';
+import type { Decorator, Preview } from '@storybook/react-vite';
+import { DirectionProvider } from '../src/components/ui/direction';
+import '../src/styles/theme.css';
+
+type StoryTheme = 'light' | 'dark';
+
+// Every story renders RTL in Hebrew, inside the Radix DirectionProvider, on the
+// page background, with `.dark` on <html> exactly as the app's ThemeProvider does.
+function AppShell({
+  theme,
+  children,
+}: {
+  theme: StoryTheme;
+  children: ReactNode;
+}) {
+  useEffect(() => {
+    const root = document.documentElement;
+    root.lang = 'he';
+    root.dir = 'rtl';
+    root.classList.toggle('dark', theme === 'dark');
+  }, [theme]);
+
+  return (
+    <DirectionProvider dir="rtl">
+      <div className="min-h-dvh bg-background p-6 text-foreground">
+        {children}
+      </div>
+    </DirectionProvider>
+  );
+}
+
+const withAppShell: Decorator = (Story, context) => (
+  <AppShell theme={context.globals['theme'] === 'dark' ? 'dark' : 'light'}>
+    <Story />
+  </AppShell>
+);
+
+const preview: Preview = {
+  decorators: [withAppShell],
+  globalTypes: {
+    theme: {
+      description: 'Colour theme',
+      toolbar: {
+        title: 'Theme',
+        icon: 'circlehollow',
+        items: [
+          { value: 'light', title: 'Light' },
+          { value: 'dark', title: 'Dark' },
+        ],
+        dynamicTitle: true,
+      },
+    },
+  },
+  initialGlobals: { theme: 'light' },
+  parameters: {
+    layout: 'fullscreen',
+    a11y: { test: 'error' },
+  },
+};
+
+export default preview;
diff --git a/libs/ui-components/src/components/shell.stories.tsx b/libs/ui-components/src/components/shell.stories.tsx
new file mode 100644
index 0000000..1439353
--- /dev/null
+++ b/libs/ui-components/src/components/shell.stories.tsx
@@ -0,0 +1,62 @@
+import { useState } from 'react';
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Board } from './board';
+import { ThemeToggle, type ThemeMode } from './theme-toggle';
+import { TopBar, Wordmark } from './top-bar';
+
+const LABELS: Record<ThemeMode, string> = {
+  system: 'צבעים: לפי המכשיר',
+  light: 'צבעים: בהיר',
+  dark: 'צבעים: כהה',
+};
+
+const meta = {
+  title: 'Shell/Shared pieces',
+} satisfies Meta;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+export const TopBarWithThemeToggle: Story = {
+  name: 'TopBar + ThemeToggle',
+  render: function Render() {
+    const [mode, setMode] = useState<ThemeMode>('system');
+    return (
+      <TopBar
+        brand={<Wordmark href="/">ביס & סיר</Wordmark>}
+        actions={
+          <ThemeToggle
+            value={mode}
+            onValueChange={setMode}
+            label={LABELS[mode]}
+          />
+        }
+      />
+    );
+  },
+};
+
+export const ThemeToggleStates: Story = {
+  render: () => (
+    <div className="flex gap-3">
+      {(['system', 'light', 'dark'] as const).map((mode) => (
+        <ThemeToggle
+          key={mode}
+          value={mode}
+          onValueChange={() => undefined}
+          label={LABELS[mode]}
+        />
+      ))}
+    </div>
+  ),
+};
+
+export const BoardSlab: Story = {
+  name: 'Board',
+  render: () => (
+    <Board className="max-w-detail">
+      <h2 className="text-title">שקשוקה</h2>
+      <p className="text-body">ארוחת בוקר, 4 מנות</p>
+    </Board>
+  ),
+};
diff --git a/libs/ui-components/src/components/ui/alert-dialog.tsx b/libs/ui-components/src/components/ui/alert-dialog.tsx
new file mode 100644
index 0000000..ce12f94
--- /dev/null
+++ b/libs/ui-components/src/components/ui/alert-dialog.tsx
@@ -0,0 +1,199 @@
+'use client';
+
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
+
+import { Button } from './button';
+
+function AlertDialog({
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
+  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
+}
+
+function AlertDialogTrigger({
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
+  return (
+    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
+  );
+}
+
+function AlertDialogPortal({
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
+  return (
+    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
+  );
+}
+
+function AlertDialogOverlay({
+  className,
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
+  return (
+    <AlertDialogPrimitive.Overlay
+      data-slot="alert-dialog-overlay"
+      className={cn(
+        'fixed inset-0 z-50 bg-foreground/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogContent({
+  className,
+  size = 'default',
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
+  size?: 'default' | 'sm';
+}) {
+  return (
+    <AlertDialogPortal>
+      <AlertDialogOverlay />
+      <AlertDialogPrimitive.Content
+        data-slot="alert-dialog-content"
+        data-size={size}
+        className={cn(
+          'group/alert-dialog-content fixed top-1/2 start-1/2 z-50 grid w-full -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
+          className,
+        )}
+        {...props}
+      />
+    </AlertDialogPortal>
+  );
+}
+
+function AlertDialogHeader({
+  className,
+  ...props
+}: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="alert-dialog-header"
+      className={cn(
+        'grid place-items-center gap-1.5 text-center sm:place-items-start sm:text-start',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogFooter({
+  className,
+  ...props
+}: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="alert-dialog-footer"
+      className={cn(
+        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogMedia({
+  className,
+  ...props
+}: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="alert-dialog-media"
+      className={cn(
+        "mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogTitle({
+  className,
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
+  return (
+    <AlertDialogPrimitive.Title
+      data-slot="alert-dialog-title"
+      className={cn(
+        'font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogDescription({
+  className,
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
+  return (
+    <AlertDialogPrimitive.Description
+      data-slot="alert-dialog-description"
+      className={cn(
+        'text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function AlertDialogAction({
+  className,
+  variant = 'default',
+  size = 'default',
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
+  Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
+  return (
+    <Button variant={variant} size={size} asChild>
+      <AlertDialogPrimitive.Action
+        data-slot="alert-dialog-action"
+        className={cn(className)}
+        {...props}
+      />
+    </Button>
+  );
+}
+
+function AlertDialogCancel({
+  className,
+  variant = 'outline',
+  size = 'default',
+  ...props
+}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
+  Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
+  return (
+    <Button variant={variant} size={size} asChild>
+      <AlertDialogPrimitive.Cancel
+        data-slot="alert-dialog-cancel"
+        className={cn(className)}
+        {...props}
+      />
+    </Button>
+  );
+}
+
+export {
+  AlertDialog,
+  AlertDialogAction,
+  AlertDialogCancel,
+  AlertDialogContent,
+  AlertDialogDescription,
+  AlertDialogFooter,
+  AlertDialogHeader,
+  AlertDialogMedia,
+  AlertDialogOverlay,
+  AlertDialogPortal,
+  AlertDialogTitle,
+  AlertDialogTrigger,
+};
diff --git a/libs/ui-components/src/components/ui/button.stories.tsx b/libs/ui-components/src/components/ui/button.stories.tsx
new file mode 100644
index 0000000..d778a06
--- /dev/null
+++ b/libs/ui-components/src/components/ui/button.stories.tsx
@@ -0,0 +1,32 @@
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Plus } from 'lucide-react';
+import { Button } from './button';
+
+const meta = {
+  title: 'UI kit/Button',
+  component: Button,
+  args: { children: 'שמירה' },
+} satisfies Meta<typeof Button>;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+export const Primary: Story = {};
+
+export const Variants: Story = {
+  render: () => (
+    <div className="flex flex-wrap items-center gap-3">
+      <Button>ראשי</Button>
+      <Button variant="secondary">משני</Button>
+      <Button variant="outline">מסגרת</Button>
+      <Button variant="ghost">שקוף</Button>
+      <Button variant="destructive">מחיקה</Button>
+      <Button variant="link">קישור</Button>
+      <Button size="lg">גדול</Button>
+      <Button size="icon" aria-label="הוספה">
+        <Plus aria-hidden="true" />
+      </Button>
+      <Button disabled>מושבת</Button>
+    </div>
+  ),
+};
diff --git a/libs/ui-components/src/components/ui/dialog.tsx b/libs/ui-components/src/components/ui/dialog.tsx
new file mode 100644
index 0000000..e89d29a
--- /dev/null
+++ b/libs/ui-components/src/components/ui/dialog.tsx
@@ -0,0 +1,167 @@
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+import { Dialog as DialogPrimitive } from 'radix-ui';
+
+import { Button } from './button';
+import { XIcon } from 'lucide-react';
+
+function Dialog({
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Root>) {
+  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
+}
+
+function DialogTrigger({
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
+  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
+}
+
+function DialogPortal({
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
+  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
+}
+
+function DialogClose({
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Close>) {
+  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
+}
+
+function DialogOverlay({
+  className,
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
+  return (
+    <DialogPrimitive.Overlay
+      data-slot="dialog-overlay"
+      className={cn(
+        'fixed inset-0 isolate z-50 bg-foreground/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function DialogContent({
+  className,
+  children,
+  closeLabel,
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Content> & {
+  /** Accessible name of the corner close button; omit to hide the button. */
+  closeLabel?: string;
+}) {
+  return (
+    <DialogPortal>
+      <DialogOverlay />
+      <DialogPrimitive.Content
+        data-slot="dialog-content"
+        className={cn(
+          'fixed top-1/2 start-1/2 z-50 grid w-11/12 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
+          className,
+        )}
+        {...props}
+      >
+        {children}
+        {closeLabel && (
+          <DialogPrimitive.Close data-slot="dialog-close" asChild>
+            <Button
+              variant="ghost"
+              className="absolute top-2 end-2"
+              size="icon"
+            >
+              <XIcon />
+              <span className="sr-only">{closeLabel}</span>
+            </Button>
+          </DialogPrimitive.Close>
+        )}
+      </DialogPrimitive.Content>
+    </DialogPortal>
+  );
+}
+
+function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="dialog-header"
+      className={cn('flex flex-col gap-2', className)}
+      {...props}
+    />
+  );
+}
+
+function DialogFooter({
+  className,
+  closeLabel,
+  children,
+  ...props
+}: React.ComponentProps<'div'> & {
+  /** Adds a close button with this label; omit for none. */
+  closeLabel?: string;
+}) {
+  return (
+    <div
+      data-slot="dialog-footer"
+      className={cn(
+        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
+        className,
+      )}
+      {...props}
+    >
+      {children}
+      {closeLabel && (
+        <DialogPrimitive.Close asChild>
+          <Button variant="outline">{closeLabel}</Button>
+        </DialogPrimitive.Close>
+      )}
+    </div>
+  );
+}
+
+function DialogTitle({
+  className,
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Title>) {
+  return (
+    <DialogPrimitive.Title
+      data-slot="dialog-title"
+      className={cn(
+        'font-heading text-base leading-none font-medium',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function DialogDescription({
+  className,
+  ...props
+}: React.ComponentProps<typeof DialogPrimitive.Description>) {
+  return (
+    <DialogPrimitive.Description
+      data-slot="dialog-description"
+      className={cn(
+        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+export {
+  Dialog,
+  DialogClose,
+  DialogContent,
+  DialogDescription,
+  DialogFooter,
+  DialogHeader,
+  DialogOverlay,
+  DialogPortal,
+  DialogTitle,
+  DialogTrigger,
+};
diff --git a/libs/ui-components/src/components/ui/dropdown-menu.tsx b/libs/ui-components/src/components/ui/dropdown-menu.tsx
new file mode 100644
index 0000000..b42cd27
--- /dev/null
+++ b/libs/ui-components/src/components/ui/dropdown-menu.tsx
@@ -0,0 +1,272 @@
+'use client';
+
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
+import { CheckIcon, ChevronRightIcon } from 'lucide-react';
+
+function DropdownMenu({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
+  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
+}
+
+function DropdownMenuPortal({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
+  return (
+    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
+  );
+}
+
+function DropdownMenuTrigger({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
+  return (
+    <DropdownMenuPrimitive.Trigger
+      data-slot="dropdown-menu-trigger"
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuContent({
+  className,
+  align = 'start',
+  sideOffset = 4,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
+  return (
+    <DropdownMenuPrimitive.Portal>
+      <DropdownMenuPrimitive.Content
+        data-slot="dropdown-menu-content"
+        sideOffset={sideOffset}
+        align={align}
+        className={cn(
+          'z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
+          className,
+        )}
+        {...props}
+      />
+    </DropdownMenuPrimitive.Portal>
+  );
+}
+
+function DropdownMenuGroup({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
+  return (
+    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
+  );
+}
+
+function DropdownMenuItem({
+  className,
+  inset,
+  variant = 'default',
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
+  inset?: boolean;
+  variant?: 'default' | 'destructive';
+}) {
+  return (
+    <DropdownMenuPrimitive.Item
+      data-slot="dropdown-menu-item"
+      data-inset={inset}
+      data-variant={variant}
+      className={cn(
+        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:ps-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuCheckboxItem({
+  className,
+  children,
+  checked,
+  inset,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
+  inset?: boolean;
+}) {
+  return (
+    <DropdownMenuPrimitive.CheckboxItem
+      data-slot="dropdown-menu-checkbox-item"
+      data-inset={inset}
+      className={cn(
+        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:ps-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      checked={checked}
+      {...props}
+    >
+      <span
+        className="pointer-events-none absolute end-2 flex items-center justify-center"
+        data-slot="dropdown-menu-checkbox-item-indicator"
+      >
+        <DropdownMenuPrimitive.ItemIndicator>
+          <CheckIcon />
+        </DropdownMenuPrimitive.ItemIndicator>
+      </span>
+      {children}
+    </DropdownMenuPrimitive.CheckboxItem>
+  );
+}
+
+function DropdownMenuRadioGroup({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
+  return (
+    <DropdownMenuPrimitive.RadioGroup
+      data-slot="dropdown-menu-radio-group"
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuRadioItem({
+  className,
+  children,
+  inset,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
+  inset?: boolean;
+}) {
+  return (
+    <DropdownMenuPrimitive.RadioItem
+      data-slot="dropdown-menu-radio-item"
+      data-inset={inset}
+      className={cn(
+        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:ps-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      {...props}
+    >
+      <span
+        className="pointer-events-none absolute end-2 flex items-center justify-center"
+        data-slot="dropdown-menu-radio-item-indicator"
+      >
+        <DropdownMenuPrimitive.ItemIndicator>
+          <CheckIcon />
+        </DropdownMenuPrimitive.ItemIndicator>
+      </span>
+      {children}
+    </DropdownMenuPrimitive.RadioItem>
+  );
+}
+
+function DropdownMenuLabel({
+  className,
+  inset,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
+  inset?: boolean;
+}) {
+  return (
+    <DropdownMenuPrimitive.Label
+      data-slot="dropdown-menu-label"
+      data-inset={inset}
+      className={cn(
+        'px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:ps-7',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuSeparator({
+  className,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
+  return (
+    <DropdownMenuPrimitive.Separator
+      data-slot="dropdown-menu-separator"
+      className={cn('-mx-1 my-1 h-px bg-border', className)}
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuShortcut({
+  className,
+  ...props
+}: React.ComponentProps<'span'>) {
+  return (
+    <span
+      data-slot="dropdown-menu-shortcut"
+      className={cn(
+        'ms-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function DropdownMenuSub({
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
+  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
+}
+
+function DropdownMenuSubTrigger({
+  className,
+  inset,
+  children,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
+  inset?: boolean;
+}) {
+  return (
+    <DropdownMenuPrimitive.SubTrigger
+      data-slot="dropdown-menu-sub-trigger"
+      data-inset={inset}
+      className={cn(
+        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:ps-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      {...props}
+    >
+      {children}
+      <ChevronRightIcon className="rtl:rotate-180 ms-auto" />
+    </DropdownMenuPrimitive.SubTrigger>
+  );
+}
+
+function DropdownMenuSubContent({
+  className,
+  ...props
+}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
+  return (
+    <DropdownMenuPrimitive.SubContent
+      data-slot="dropdown-menu-sub-content"
+      className={cn(
+        'z-50 min-w-24 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+export {
+  DropdownMenu,
+  DropdownMenuPortal,
+  DropdownMenuTrigger,
+  DropdownMenuContent,
+  DropdownMenuGroup,
+  DropdownMenuLabel,
+  DropdownMenuItem,
+  DropdownMenuCheckboxItem,
+  DropdownMenuRadioGroup,
+  DropdownMenuRadioItem,
+  DropdownMenuSeparator,
+  DropdownMenuShortcut,
+  DropdownMenuSub,
+  DropdownMenuSubTrigger,
+  DropdownMenuSubContent,
+};
diff --git a/libs/ui-components/src/components/ui/form-controls.spec.tsx b/libs/ui-components/src/components/ui/form-controls.spec.tsx
new file mode 100644
index 0000000..ea40ece
--- /dev/null
+++ b/libs/ui-components/src/components/ui/form-controls.spec.tsx
@@ -0,0 +1,132 @@
+import { fireEvent, render, screen, waitFor } from '@testing-library/react';
+import { DirectionProvider } from './direction';
+import { Input } from './input';
+import { Label } from './label';
+import {
+  Select,
+  SelectContent,
+  SelectItem,
+  SelectTrigger,
+  SelectValue,
+} from './select';
+import { Skeleton } from './skeleton';
+import {
+  Table,
+  TableBody,
+  TableCell,
+  TableHead,
+  TableHeader,
+  TableRow,
+} from './table';
+import { ToggleGroup, ToggleGroupItem } from './toggle-group';
+
+describe('Input and Label', () => {
+  it('is a 44px field named by its label', () => {
+    const onChange = vi.fn();
+    render(
+      <>
+        <Label htmlFor="name">שם</Label>
+        <Input id="name" onChange={onChange} />
+      </>,
+    );
+    const input = screen.getByLabelText('שם');
+    expect(input.className).toContain('h-11');
+    expect(input.className).toContain('border-input');
+    fireEvent.change(input, { target: { value: 'חומוס' } });
+    expect(onChange).toHaveBeenCalled();
+  });
+
+  it('is skipped by the keyboard when disabled', () => {
+    render(<Input aria-label="חיפוש" disabled />);
+    expect(screen.getByLabelText('חיפוש')).toHaveProperty('disabled', true);
+  });
+});
+
+describe('Skeleton', () => {
+  it('renders a pulsing placeholder block', () => {
+    render(<Skeleton data-testid="sk" className="h-4" />);
+    const block = screen.getByTestId('sk');
+    expect(block.className).toContain('animate-pulse');
+    expect(block.className).toContain('h-4');
+  });
+});
+
+describe('Table', () => {
+  it('renders table semantics', () => {
+    render(
+      <Table>
+        <TableHeader>
+          <TableRow>
+            <TableHead>שם</TableHead>
+          </TableRow>
+        </TableHeader>
+        <TableBody>
+          <TableRow>
+            <TableCell>עדי</TableCell>
+          </TableRow>
+        </TableBody>
+      </Table>,
+    );
+    expect(screen.getByRole('table')).toBeTruthy();
+    expect(screen.getByRole('columnheader', { name: 'שם' })).toBeTruthy();
+    expect(screen.getByRole('cell', { name: 'עדי' })).toBeTruthy();
+  });
+});
+
+describe('ToggleGroup', () => {
+  function renderChips(onValueChange = vi.fn()) {
+    render(
+      <DirectionProvider dir="rtl">
+        <ToggleGroup type="single" onValueChange={onValueChange}>
+          <ToggleGroupItem value="all">הכל</ToggleGroupItem>
+          <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
+        </ToggleGroup>
+      </DirectionProvider>,
+    );
+    return onValueChange;
+  }
+
+  it('selects one chip at a time', () => {
+    const onValueChange = renderChips();
+    const dinner = screen.getByRole('radio', { name: 'ערב' });
+    fireEvent.click(dinner);
+    expect(onValueChange).toHaveBeenCalledWith('dinner');
+    expect(dinner.getAttribute('aria-checked')).toBe('true');
+    expect(dinner.className).toContain('rounded-full');
+  });
+
+  it('moves focus between chips with the arrow keys, following RTL', async () => {
+    renderChips();
+    const [all, dinner] = screen.getAllByRole('radio');
+    all.focus();
+    // In RTL the next chip lies to the left.
+    fireEvent.keyDown(all, { key: 'ArrowLeft' });
+    await waitFor(() => expect(document.activeElement).toBe(dinner));
+  });
+});
+
+describe('Select', () => {
+  it('opens from the keyboard and picks an option', () => {
+    const onValueChange = vi.fn();
+    render(
+      <DirectionProvider dir="rtl">
+        <Select onValueChange={onValueChange}>
+          <SelectTrigger aria-label="תפקיד">
+            <SelectValue placeholder="בחירה" />
+          </SelectTrigger>
+          <SelectContent>
+            <SelectItem value="admin">מנהל</SelectItem>
+            <SelectItem value="viewer">צופה</SelectItem>
+          </SelectContent>
+        </Select>
+      </DirectionProvider>,
+    );
+    const trigger = screen.getByRole('combobox', { name: 'תפקיד' });
+    expect(trigger.className).toContain('h-11');
+    trigger.focus();
+    fireEvent.keyDown(trigger, { key: 'Enter' });
+    const option = screen.getByRole('option', { name: 'צופה' });
+    fireEvent.keyDown(option, { key: 'Enter' });
+    expect(onValueChange).toHaveBeenCalledWith('viewer');
+  });
+});
diff --git a/libs/ui-components/src/components/ui/forms.stories.tsx b/libs/ui-components/src/components/ui/forms.stories.tsx
new file mode 100644
index 0000000..2f998fb
--- /dev/null
+++ b/libs/ui-components/src/components/ui/forms.stories.tsx
@@ -0,0 +1,106 @@
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Input } from './input';
+import { Label } from './label';
+import {
+  Select,
+  SelectContent,
+  SelectItem,
+  SelectTrigger,
+  SelectValue,
+} from './select';
+import { Skeleton } from './skeleton';
+import {
+  Table,
+  TableBody,
+  TableCell,
+  TableHead,
+  TableHeader,
+  TableRow,
+} from './table';
+import { ToggleGroup, ToggleGroupItem } from './toggle-group';
+
+const meta = { title: 'UI kit/Form and data' } satisfies Meta;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+export const InputWithLabel: Story = {
+  name: 'Input + Label',
+  render: () => (
+    <div className="grid max-w-sm gap-2">
+      <Label htmlFor="story-name">שם המתכון</Label>
+      <Input id="story-name" placeholder="שקשוקה" />
+      <Label htmlFor="story-disabled">שדה מושבת</Label>
+      <Input id="story-disabled" disabled placeholder="לא זמין" />
+      <Label htmlFor="story-invalid">שדה שגוי</Label>
+      <Input id="story-invalid" aria-invalid defaultValue="???" />
+    </div>
+  ),
+};
+
+export const SkeletonCards: Story = {
+  name: 'Skeleton',
+  render: () => (
+    <div className="grid max-w-sm gap-3">
+      <Skeleton className="h-40 w-full rounded-board" />
+      <Skeleton className="h-5 w-3/4" />
+      <Skeleton className="h-5 w-1/2" />
+    </div>
+  ),
+};
+
+export const MealTypeChips: Story = {
+  name: 'ToggleGroup',
+  render: () => (
+    <ToggleGroup type="single" defaultValue="all" aria-label="סוג ארוחה">
+      <ToggleGroupItem value="all">הכל</ToggleGroupItem>
+      <ToggleGroupItem value="breakfast">בוקר</ToggleGroupItem>
+      <ToggleGroupItem value="lunch">צהריים</ToggleGroupItem>
+      <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
+      <ToggleGroupItem value="dessert">קינוח</ToggleGroupItem>
+    </ToggleGroup>
+  ),
+};
+
+export const RoleSelect: Story = {
+  name: 'Select',
+  render: () => (
+    <Select defaultValue="viewer">
+      <SelectTrigger aria-label="תפקיד" className="w-48">
+        <SelectValue placeholder="בחירת תפקיד" />
+      </SelectTrigger>
+      <SelectContent>
+        <SelectItem value="admin">מנהל</SelectItem>
+        <SelectItem value="editor">עורך</SelectItem>
+        <SelectItem value="viewer">צופה</SelectItem>
+      </SelectContent>
+    </Select>
+  ),
+};
+
+export const UsersTable: Story = {
+  name: 'Table',
+  render: () => (
+    <Table className="max-w-detail">
+      <TableHeader>
+        <TableRow>
+          <TableHead>שם</TableHead>
+          <TableHead>תפקיד</TableHead>
+          <TableHead>סטטוס</TableHead>
+        </TableRow>
+      </TableHeader>
+      <TableBody>
+        <TableRow>
+          <TableCell>עדי</TableCell>
+          <TableCell>מנהל</TableCell>
+          <TableCell>פעיל</TableCell>
+        </TableRow>
+        <TableRow>
+          <TableCell>נועה</TableCell>
+          <TableCell>צופה</TableCell>
+          <TableCell>חסום</TableCell>
+        </TableRow>
+      </TableBody>
+    </Table>
+  ),
+};
diff --git a/libs/ui-components/src/components/ui/input.tsx b/libs/ui-components/src/components/ui/input.tsx
new file mode 100644
index 0000000..ad715cb
--- /dev/null
+++ b/libs/ui-components/src/components/ui/input.tsx
@@ -0,0 +1,18 @@
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+
+function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
+  return (
+    <input
+      type={type}
+      data-slot="input"
+      className={cn(
+        'h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+export { Input };
diff --git a/libs/ui-components/src/components/ui/label.tsx b/libs/ui-components/src/components/ui/label.tsx
new file mode 100644
index 0000000..0b035fe
--- /dev/null
+++ b/libs/ui-components/src/components/ui/label.tsx
@@ -0,0 +1,21 @@
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+import { Label as LabelPrimitive } from 'radix-ui';
+
+function Label({
+  className,
+  ...props
+}: React.ComponentProps<typeof LabelPrimitive.Root>) {
+  return (
+    <LabelPrimitive.Root
+      data-slot="label"
+      className={cn(
+        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+export { Label };
diff --git a/libs/ui-components/src/components/ui/overlays.spec.tsx b/libs/ui-components/src/components/ui/overlays.spec.tsx
new file mode 100644
index 0000000..fcd5544
--- /dev/null
+++ b/libs/ui-components/src/components/ui/overlays.spec.tsx
@@ -0,0 +1,162 @@
+import {
+  act,
+  fireEvent,
+  render,
+  screen,
+  waitFor,
+} from '@testing-library/react';
+import {
+  AlertDialog,
+  AlertDialogAction,
+  AlertDialogCancel,
+  AlertDialogContent,
+  AlertDialogDescription,
+  AlertDialogFooter,
+  AlertDialogHeader,
+  AlertDialogTitle,
+  AlertDialogTrigger,
+} from './alert-dialog';
+import {
+  Dialog,
+  DialogContent,
+  DialogDescription,
+  DialogHeader,
+  DialogTitle,
+  DialogTrigger,
+} from './dialog';
+import { DirectionProvider } from './direction';
+import {
+  DropdownMenu,
+  DropdownMenuContent,
+  DropdownMenuItem,
+  DropdownMenuTrigger,
+} from './dropdown-menu';
+import { Toaster, toast } from './sonner';
+
+describe('Dialog', () => {
+  function renderDialog() {
+    render(
+      <DirectionProvider dir="rtl">
+        <Dialog>
+          <DialogTrigger>הוספת משתמש</DialogTrigger>
+          <DialogContent closeLabel="סגירה">
+            <DialogHeader>
+              <DialogTitle>משתמש חדש</DialogTitle>
+              <DialogDescription>פרטי המשתמש</DialogDescription>
+            </DialogHeader>
+            <input aria-label="שם" />
+          </DialogContent>
+        </Dialog>
+      </DirectionProvider>,
+    );
+    return screen.getByRole('button', { name: 'הוספת משתמש' });
+  }
+
+  it('traps focus inside and restores it to the trigger on close', async () => {
+    const trigger = renderDialog();
+    trigger.focus();
+    fireEvent.click(trigger);
+    const dialog = await screen.findByRole('dialog', { name: 'משתמש חדש' });
+    await waitFor(() =>
+      expect(dialog.contains(document.activeElement)).toBe(true),
+    );
+
+    fireEvent.keyDown(dialog, { key: 'Escape' });
+    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
+    await waitFor(() => expect(document.activeElement).toBe(trigger));
+  });
+
+  it('closes with the labelled corner button', async () => {
+    fireEvent.click(renderDialog());
+    fireEvent.click(await screen.findByRole('button', { name: 'סגירה' }));
+    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
+  });
+});
+
+describe('AlertDialog', () => {
+  function renderAlert(onAction = vi.fn()) {
+    render(
+      <DirectionProvider dir="rtl">
+        <AlertDialog>
+          <AlertDialogTrigger>מחיקה</AlertDialogTrigger>
+          <AlertDialogContent>
+            <AlertDialogHeader>
+              <AlertDialogTitle>למחוק את המתכון?</AlertDialogTitle>
+              <AlertDialogDescription>אי אפשר לבטל</AlertDialogDescription>
+            </AlertDialogHeader>
+            <AlertDialogFooter>
+              <AlertDialogCancel>ביטול</AlertDialogCancel>
+              <AlertDialogAction onClick={onAction}>אישור</AlertDialogAction>
+            </AlertDialogFooter>
+          </AlertDialogContent>
+        </AlertDialog>
+      </DirectionProvider>,
+    );
+    return screen.getByRole('button', { name: 'מחיקה' });
+  }
+
+  it('focuses inside, closes on Escape and restores focus', async () => {
+    const trigger = renderAlert();
+    trigger.focus();
+    fireEvent.click(trigger);
+    const dialog = await screen.findByRole('alertdialog', {
+      name: 'למחוק את המתכון?',
+    });
+    await waitFor(() =>
+      expect(dialog.contains(document.activeElement)).toBe(true),
+    );
+
+    fireEvent.keyDown(dialog, { key: 'Escape' });
+    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
+    await waitFor(() => expect(document.activeElement).toBe(trigger));
+  });
+
+  it('runs the action and closes', async () => {
+    const onAction = vi.fn();
+    fireEvent.click(renderAlert(onAction));
+    await screen.findByRole('alertdialog');
+    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
+    expect(onAction).toHaveBeenCalled();
+    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
+  });
+});
+
+describe('DropdownMenu', () => {
+  it('opens from the keyboard, lists items, and restores focus on Escape', async () => {
+    render(
+      <DirectionProvider dir="rtl">
+        <DropdownMenu>
+          <DropdownMenuTrigger>חשבון</DropdownMenuTrigger>
+          <DropdownMenuContent>
+            <DropdownMenuItem>יציאה</DropdownMenuItem>
+          </DropdownMenuContent>
+        </DropdownMenu>
+      </DirectionProvider>,
+    );
+    const trigger = screen.getByRole('button', { name: 'חשבון' });
+    trigger.focus();
+    fireEvent.keyDown(trigger, { key: 'Enter' });
+    const menu = await screen.findByRole('menu');
+    const item = screen.getByRole('menuitem', { name: 'יציאה' });
+    expect(menu.contains(item)).toBe(true);
+
+    fireEvent.keyDown(menu, { key: 'Escape' });
+    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
+    await waitFor(() => expect(document.activeElement).toBe(trigger));
+  });
+});
+
+describe('Toaster', () => {
+  it('shows a toast and uses the theme the app passes in', async () => {
+    render(<Toaster theme="dark" />);
+    act(() => {
+      toast('המתכון נשמר');
+    });
+    expect(await screen.findByText('המתכון נשמר')).toBeTruthy();
+    expect(
+      document
+        .querySelector('[data-sonner-toaster]')
+        ?.getAttribute('data-sonner-theme'),
+    ).toBe('dark');
+  });
+});
diff --git a/libs/ui-components/src/components/ui/overlays.stories.tsx b/libs/ui-components/src/components/ui/overlays.stories.tsx
new file mode 100644
index 0000000..a2f80dc
--- /dev/null
+++ b/libs/ui-components/src/components/ui/overlays.stories.tsx
@@ -0,0 +1,121 @@
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Button } from './button';
+import {
+  AlertDialog,
+  AlertDialogAction,
+  AlertDialogCancel,
+  AlertDialogContent,
+  AlertDialogDescription,
+  AlertDialogFooter,
+  AlertDialogHeader,
+  AlertDialogTitle,
+  AlertDialogTrigger,
+} from './alert-dialog';
+import {
+  Dialog,
+  DialogContent,
+  DialogDescription,
+  DialogFooter,
+  DialogHeader,
+  DialogTitle,
+  DialogTrigger,
+} from './dialog';
+import {
+  DropdownMenu,
+  DropdownMenuContent,
+  DropdownMenuItem,
+  DropdownMenuLabel,
+  DropdownMenuSeparator,
+  DropdownMenuTrigger,
+} from './dropdown-menu';
+import { Input } from './input';
+import { Label } from './label';
+import { Toaster, toast } from './sonner';
+
+const meta = { title: 'UI kit/Overlays' } satisfies Meta;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+export const AccountMenu: Story = {
+  name: 'DropdownMenu',
+  render: () => (
+    <DropdownMenu>
+      <DropdownMenuTrigger asChild>
+        <Button variant="outline">עדי</Button>
+      </DropdownMenuTrigger>
+      <DropdownMenuContent align="start">
+        <DropdownMenuLabel>עדי</DropdownMenuLabel>
+        <DropdownMenuSeparator />
+        <DropdownMenuItem>משתמשים</DropdownMenuItem>
+        <DropdownMenuItem>תגיות</DropdownMenuItem>
+        <DropdownMenuItem variant="destructive">יציאה</DropdownMenuItem>
+      </DropdownMenuContent>
+    </DropdownMenu>
+  ),
+};
+
+export const AddUserDialog: Story = {
+  name: 'Dialog',
+  render: () => (
+    <Dialog>
+      <DialogTrigger asChild>
+        <Button>הוספת משתמש</Button>
+      </DialogTrigger>
+      <DialogContent closeLabel="סגירה">
+        <DialogHeader>
+          <DialogTitle>משתמש חדש</DialogTitle>
+          <DialogDescription>פרטי המשתמש לכניסה לאפליקציה</DialogDescription>
+        </DialogHeader>
+        <div className="grid gap-2">
+          <Label htmlFor="dialog-email">אימייל</Label>
+          <Input id="dialog-email" type="email" dir="ltr" />
+        </div>
+        <DialogFooter>
+          <Button>הוספה</Button>
+        </DialogFooter>
+      </DialogContent>
+    </Dialog>
+  ),
+};
+
+export const DeleteConfirm: Story = {
+  name: 'AlertDialog',
+  render: () => (
+    <AlertDialog>
+      <AlertDialogTrigger asChild>
+        <Button variant="destructive">מחיקת מתכון</Button>
+      </AlertDialogTrigger>
+      <AlertDialogContent>
+        <AlertDialogHeader>
+          <AlertDialogTitle>למחוק את המתכון?</AlertDialogTitle>
+          <AlertDialogDescription>
+            אי אפשר לשחזר מתכון שנמחק
+          </AlertDialogDescription>
+        </AlertDialogHeader>
+        <AlertDialogFooter>
+          <AlertDialogCancel>ביטול</AlertDialogCancel>
+          <AlertDialogAction>מחיקה</AlertDialogAction>
+        </AlertDialogFooter>
+      </AlertDialogContent>
+    </AlertDialog>
+  ),
+};
+
+export const Toasts: Story = {
+  name: 'Sonner (Toaster)',
+  render: () => (
+    <>
+      <Toaster />
+      <div className="flex flex-wrap gap-3">
+        <Button onClick={() => toast('המתכון נשמר')}>הודעה</Button>
+        <Button variant="outline" onClick={() => toast.success('המתכון נמחק')}>
+          הצלחה
+        </Button>
+        <Button variant="outline" onClick={() => toast.error('השמירה נכשלה')}>
+          שגיאה
+        </Button>
+      </div>
+    </>
+  ),
+};
diff --git a/libs/ui-components/src/components/ui/select.tsx b/libs/ui-components/src/components/ui/select.tsx
new file mode 100644
index 0000000..fcba29f
--- /dev/null
+++ b/libs/ui-components/src/components/ui/select.tsx
@@ -0,0 +1,194 @@
+'use client';
+
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+import { Select as SelectPrimitive } from 'radix-ui';
+import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from 'lucide-react';
+
+function Select({
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Root>) {
+  return <SelectPrimitive.Root data-slot="select" {...props} />;
+}
+
+function SelectGroup({
+  className,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Group>) {
+  return (
+    <SelectPrimitive.Group
+      data-slot="select-group"
+      className={cn('scroll-my-1 p-1', className)}
+      {...props}
+    />
+  );
+}
+
+function SelectValue({
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Value>) {
+  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
+}
+
+function SelectTrigger({
+  className,
+  size = 'default',
+  children,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
+  size?: 'sm' | 'default';
+}) {
+  return (
+    <SelectPrimitive.Trigger
+      data-slot="select-trigger"
+      data-size={size}
+      className={cn(
+        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pe-2 ps-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-11 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      {...props}
+    >
+      {children}
+      <SelectPrimitive.Icon asChild>
+        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
+      </SelectPrimitive.Icon>
+    </SelectPrimitive.Trigger>
+  );
+}
+
+function SelectContent({
+  className,
+  children,
+  position = 'item-aligned',
+  align = 'center',
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Content>) {
+  return (
+    <SelectPrimitive.Portal>
+      <SelectPrimitive.Content
+        data-slot="select-content"
+        data-align-trigger={position === 'item-aligned'}
+        className={cn(
+          'relative z-50 max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
+          position === 'popper' &&
+            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 rtl:data-[side=left]:translate-x-1 data-[side=right]:translate-x-1 rtl:data-[side=right]:-translate-x-1 data-[side=top]:-translate-y-1',
+          className,
+        )}
+        position={position}
+        align={align}
+        {...props}
+      >
+        <SelectScrollUpButton />
+        <SelectPrimitive.Viewport
+          data-position={position}
+          className={cn(
+            'data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)',
+            position === 'popper' && '',
+          )}
+        >
+          {children}
+        </SelectPrimitive.Viewport>
+        <SelectScrollDownButton />
+      </SelectPrimitive.Content>
+    </SelectPrimitive.Portal>
+  );
+}
+
+function SelectLabel({
+  className,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Label>) {
+  return (
+    <SelectPrimitive.Label
+      data-slot="select-label"
+      className={cn('px-1.5 py-1 text-xs text-muted-foreground', className)}
+      {...props}
+    />
+  );
+}
+
+function SelectItem({
+  className,
+  children,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Item>) {
+  return (
+    <SelectPrimitive.Item
+      data-slot="select-item"
+      className={cn(
+        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
+        className,
+      )}
+      {...props}
+    >
+      <span className="pointer-events-none absolute end-2 flex size-4 items-center justify-center">
+        <SelectPrimitive.ItemIndicator>
+          <CheckIcon className="pointer-events-none" />
+        </SelectPrimitive.ItemIndicator>
+      </span>
+      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
+    </SelectPrimitive.Item>
+  );
+}
+
+function SelectSeparator({
+  className,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
+  return (
+    <SelectPrimitive.Separator
+      data-slot="select-separator"
+      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
+      {...props}
+    />
+  );
+}
+
+function SelectScrollUpButton({
+  className,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
+  return (
+    <SelectPrimitive.ScrollUpButton
+      data-slot="select-scroll-up-button"
+      className={cn(
+        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      {...props}
+    >
+      <ChevronUpIcon />
+    </SelectPrimitive.ScrollUpButton>
+  );
+}
+
+function SelectScrollDownButton({
+  className,
+  ...props
+}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
+  return (
+    <SelectPrimitive.ScrollDownButton
+      data-slot="select-scroll-down-button"
+      className={cn(
+        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
+        className,
+      )}
+      {...props}
+    >
+      <ChevronDownIcon />
+    </SelectPrimitive.ScrollDownButton>
+  );
+}
+
+export {
+  Select,
+  SelectContent,
+  SelectGroup,
+  SelectItem,
+  SelectLabel,
+  SelectScrollDownButton,
+  SelectScrollUpButton,
+  SelectSeparator,
+  SelectTrigger,
+  SelectValue,
+};
diff --git a/libs/ui-components/src/components/ui/skeleton.tsx b/libs/ui-components/src/components/ui/skeleton.tsx
new file mode 100644
index 0000000..dd552cb
--- /dev/null
+++ b/libs/ui-components/src/components/ui/skeleton.tsx
@@ -0,0 +1,13 @@
+import { cn } from '../../lib/utils';
+
+function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="skeleton"
+      className={cn('animate-pulse rounded-md bg-muted', className)}
+      {...props}
+    />
+  );
+}
+
+export { Skeleton };
diff --git a/libs/ui-components/src/components/ui/sonner.tsx b/libs/ui-components/src/components/ui/sonner.tsx
new file mode 100644
index 0000000..261457d
--- /dev/null
+++ b/libs/ui-components/src/components/ui/sonner.tsx
@@ -0,0 +1,34 @@
+import {
+  CircleCheckIcon,
+  InfoIcon,
+  Loader2Icon,
+  OctagonXIcon,
+  TriangleAlertIcon,
+} from 'lucide-react';
+import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';
+
+// shadcn's Toaster reads the theme from next-themes; here the app passes it in
+// (`theme`), so this lib needs no theme context. The toast colours come from
+// the `[data-sonner-toaster]` block in theme.css.
+function Toaster({ ...props }: ToasterProps) {
+  return (
+    <Sonner
+      className="toaster group"
+      icons={{
+        success: <CircleCheckIcon className="size-4" />,
+        info: <InfoIcon className="size-4" />,
+        warning: <TriangleAlertIcon className="size-4" />,
+        error: <OctagonXIcon className="size-4" />,
+        loading: <Loader2Icon className="size-4 animate-spin" />,
+      }}
+      toastOptions={{
+        classNames: {
+          toast: 'cn-toast',
+        },
+      }}
+      {...props}
+    />
+  );
+}
+
+export { Toaster, toast };
diff --git a/libs/ui-components/src/components/ui/table.tsx b/libs/ui-components/src/components/ui/table.tsx
new file mode 100644
index 0000000..ec8a41b
--- /dev/null
+++ b/libs/ui-components/src/components/ui/table.tsx
@@ -0,0 +1,113 @@
+import * as React from 'react';
+import { cn } from '../../lib/utils';
+
+function Table({ className, ...props }: React.ComponentProps<'table'>) {
+  return (
+    <div
+      data-slot="table-container"
+      className="relative w-full overflow-x-auto"
+    >
+      <table
+        data-slot="table"
+        className={cn('w-full caption-bottom text-sm', className)}
+        {...props}
+      />
+    </div>
+  );
+}
+
+function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
+  return (
+    <thead
+      data-slot="table-header"
+      className={cn('[&_tr]:border-b', className)}
+      {...props}
+    />
+  );
+}
+
+function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
+  return (
+    <tbody
+      data-slot="table-body"
+      className={cn('[&_tr:last-child]:border-0', className)}
+      {...props}
+    />
+  );
+}
+
+function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
+  return (
+    <tfoot
+      data-slot="table-footer"
+      className={cn(
+        'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
+  return (
+    <tr
+      data-slot="table-row"
+      className={cn(
+        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
+  return (
+    <th
+      data-slot="table-head"
+      className={cn(
+        'h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pe-0',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
+  return (
+    <td
+      data-slot="table-cell"
+      className={cn(
+        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
+
+function TableCaption({
+  className,
+  ...props
+}: React.ComponentProps<'caption'>) {
+  return (
+    <caption
+      data-slot="table-caption"
+      className={cn('mt-4 text-sm text-muted-foreground', className)}
+      {...props}
+    />
+  );
+}
+
+export {
+  Table,
+  TableHeader,
+  TableBody,
+  TableFooter,
+  TableHead,
+  TableRow,
+  TableCell,
+  TableCaption,
+};
diff --git a/libs/ui-components/src/components/ui/toggle-group.tsx b/libs/ui-components/src/components/ui/toggle-group.tsx
new file mode 100644
index 0000000..462c98f
--- /dev/null
+++ b/libs/ui-components/src/components/ui/toggle-group.tsx
@@ -0,0 +1,69 @@
+import * as React from 'react';
+import { type VariantProps } from 'class-variance-authority';
+import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
+import { cn } from '../../lib/utils';
+import { toggleVariants } from './toggle';
+
+// shadcn ToggleGroup, trimmed to the chip row we need: separate pills with a
+// fixed gap (shadcn's `spacing` prop and its inline `--gap` style are dropped).
+const ToggleGroupContext = React.createContext<
+  VariantProps<typeof toggleVariants>
+>({
+  size: 'default',
+  variant: 'default',
+});
+
+function ToggleGroup({
+  className,
+  variant,
+  size,
+  children,
+  ...props
+}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
+  VariantProps<typeof toggleVariants>) {
+  return (
+    <ToggleGroupPrimitive.Root
+      data-slot="toggle-group"
+      data-variant={variant}
+      data-size={size}
+      className={cn('flex w-fit flex-wrap items-center gap-2', className)}
+      {...props}
+    >
+      <ToggleGroupContext.Provider value={{ variant, size }}>
+        {children}
+      </ToggleGroupContext.Provider>
+    </ToggleGroupPrimitive.Root>
+  );
+}
+
+function ToggleGroupItem({
+  className,
+  children,
+  variant = 'default',
+  size = 'default',
+  ...props
+}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
+  VariantProps<typeof toggleVariants>) {
+  const context = React.useContext(ToggleGroupContext);
+
+  return (
+    <ToggleGroupPrimitive.Item
+      data-slot="toggle-group-item"
+      data-variant={context.variant || variant}
+      data-size={context.size || size}
+      className={cn(
+        'shrink-0 focus:z-10 focus-visible:z-10',
+        toggleVariants({
+          variant: context.variant || variant,
+          size: context.size || size,
+        }),
+        className,
+      )}
+      {...props}
+    >
+      {children}
+    </ToggleGroupPrimitive.Item>
+  );
+}
+
+export { ToggleGroup, ToggleGroupItem };
diff --git a/libs/ui-components/src/components/ui/toggle.tsx b/libs/ui-components/src/components/ui/toggle.tsx
new file mode 100644
index 0000000..a5d3a5f
--- /dev/null
+++ b/libs/ui-components/src/components/ui/toggle.tsx
@@ -0,0 +1,43 @@
+import * as React from 'react';
+import { cva, type VariantProps } from 'class-variance-authority';
+import { cn } from '../../lib/utils';
+import { Toggle as TogglePrimitive } from 'radix-ui';
+
+const toggleVariants = cva(
+  "group/toggle inline-flex items-center justify-center gap-1 rounded-full text-label whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
+  {
+    variants: {
+      variant: {
+        default: 'bg-transparent',
+        outline: 'border border-input bg-transparent hover:bg-muted',
+      },
+      size: {
+        default:
+          'h-11 min-w-11 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
+        lg: 'h-12 min-w-12 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4',
+      },
+    },
+    defaultVariants: {
+      variant: 'default',
+      size: 'default',
+    },
+  },
+);
+
+function Toggle({
+  className,
+  variant = 'default',
+  size = 'default',
+  ...props
+}: React.ComponentProps<typeof TogglePrimitive.Root> &
+  VariantProps<typeof toggleVariants>) {
+  return (
+    <TogglePrimitive.Root
+      data-slot="toggle"
+      className={cn(toggleVariants({ variant, size, className }))}
+      {...props}
+    />
+  );
+}
+
+export { Toggle, toggleVariants };
diff --git a/libs/ui-components/src/styles/input-border.stories.tsx b/libs/ui-components/src/styles/input-border.stories.tsx
new file mode 100644
index 0000000..c2e1406
--- /dev/null
+++ b/libs/ui-components/src/styles/input-border.stories.tsx
@@ -0,0 +1,69 @@
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Input } from '../components/ui/input';
+import { Label } from '../components/ui/label';
+import {
+  Select,
+  SelectContent,
+  SelectItem,
+  SelectTrigger,
+  SelectValue,
+} from '../components/ui/select';
+import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
+
+const meta = {
+  title: 'Foundations/Input border (for approval)',
+} satisfies Meta;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+/**
+ * Story 1.5 approval preview. Switch Light/Dark in the toolbar. "Before" is the
+ * old `--input` (= `--border`, about 1.25:1); "After" is the new stronger
+ * `--input` (>= 3:1 on background, card and popover; see theme-contrast.spec.ts).
+ */
+export const BeforeAndAfter: Story = {
+  render: () => (
+    <div className="grid max-w-detail gap-8 md:grid-cols-2">
+      <section className="grid content-start gap-4">
+        <h2 className="text-heading">לפני (הגבול העדין, --border)</h2>
+        <Label htmlFor="before-input">שם המתכון</Label>
+        <Input
+          id="before-input"
+          className="border-border"
+          placeholder="שקשוקה"
+        />
+        <Select>
+          <SelectTrigger aria-label="תפקיד לפני" className="w-48 border-border">
+            <SelectValue placeholder="בחירת תפקיד" />
+          </SelectTrigger>
+          <SelectContent>
+            <SelectItem value="viewer">צופה</SelectItem>
+          </SelectContent>
+        </Select>
+      </section>
+      <section className="grid content-start gap-4">
+        <h2 className="text-heading">אחרי (--input החדש)</h2>
+        <Label htmlFor="after-input">שם המתכון</Label>
+        <Input id="after-input" placeholder="שקשוקה" />
+        <Select>
+          <SelectTrigger aria-label="תפקיד אחרי" className="w-48">
+            <SelectValue placeholder="בחירת תפקיד" />
+          </SelectTrigger>
+          <SelectContent>
+            <SelectItem value="viewer">צופה</SelectItem>
+          </SelectContent>
+        </Select>
+        <ToggleGroup
+          type="single"
+          variant="outline"
+          aria-label="סוג ארוחה"
+          defaultValue="dinner"
+        >
+          <ToggleGroupItem value="lunch">צהריים</ToggleGroupItem>
+          <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
+        </ToggleGroup>
+      </section>
+    </div>
+  ),
+};
diff --git a/libs/ui-components/src/test-setup.ts b/libs/ui-components/src/test-setup.ts
new file mode 100644
index 0000000..cdaf326
--- /dev/null
+++ b/libs/ui-components/src/test-setup.ts
@@ -0,0 +1,26 @@
+// jsdom gaps that Radix (Select, menus) and Sonner rely on.
+window.matchMedia ??= (query: string) =>
+  ({
+    media: query,
+    matches: false,
+    addEventListener: () => undefined,
+    removeEventListener: () => undefined,
+  }) as unknown as MediaQueryList;
+
+class ResizeObserverStub {
+  observe() {
+    /* no layout in jsdom */
+  }
+  unobserve() {
+    /* no layout in jsdom */
+  }
+  disconnect() {
+    /* no layout in jsdom */
+  }
+}
+globalThis.ResizeObserver ??= ResizeObserverStub;
+
+Element.prototype.hasPointerCapture ??= () => false;
+Element.prototype.setPointerCapture ??= () => undefined;
+Element.prototype.releasePointerCapture ??= () => undefined;
+Element.prototype.scrollIntoView ??= () => undefined;
diff --git a/libs/ui-components/tsconfig.storybook.json b/libs/ui-components/tsconfig.storybook.json
new file mode 100644
index 0000000..1ee3b24
--- /dev/null
+++ b/libs/ui-components/tsconfig.storybook.json
@@ -0,0 +1,18 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "./out-tsc/storybook",
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "lib": ["es2022", "dom", "dom.iterable"],
+    "types": ["node", "vite/client"],
+    "noEmit": true
+  },
+  "include": [
+    ".storybook/**/*.ts",
+    ".storybook/**/*.tsx",
+    "src/**/*.stories.tsx",
+    "src/**/*.d.ts"
+  ]
+}
```
