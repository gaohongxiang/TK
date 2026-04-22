# BYO Supabase Local-First Order Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-owned Supabase sync option to the order tracker while keeping IndexedDB as the fast local source for reads and writes.

**Architecture:** The Cloudflare Pages app remains a static frontend. Order reads and writes stay local-first in IndexedDB; a new remote-provider layer syncs local changes to a user-supplied Supabase project. Gist remains available as a legacy adapter, but the new target architecture is `IndexedDB + BYO Supabase`, not app-owned cloud storage.

**Tech Stack:** Vanilla JS, IndexedDB, existing order modules, Supabase JS browser client, Supabase Auth + Postgres + RLS, Cloudflare Pages static hosting

---

## File Structure

### Modify

- `index.html`
  Purpose: Add storage mode UI, Supabase setup fields, and load the Supabase browser client before order modules.
- `js/orders/index.js`
  Purpose: Compose provider selection, session flow, render hooks, and adapter wiring.
- `js/orders/session.js`
  Purpose: Extend setup lifecycle to support Gist mode and BYO Supabase mode.
- `js/orders/sync.js`
  Purpose: Split existing Gist-specific behavior from generic local-first sync orchestration.
- `js/orders/shared.js`
  Purpose: Add provider config helpers, timestamps, and sync-safe normalization helpers if needed.
- `css/style.css`
  Purpose: Style storage mode selector and Supabase setup panel without changing current visual language.

### Create

- `js/orders/provider-gist.js`
  Purpose: Move current Gist-specific remote behavior out of `sync.js` behind a provider interface.
- `js/orders/provider-supabase.js`
  Purpose: Implement Supabase auth/session bootstrap, pull/push, and remote change queries.
- `js/orders/provider-local.js`
  Purpose: Provide a no-remote provider used for local-only mode and for tests.
- `tests/orders-provider-gist-module.test.js`
  Purpose: Lock the Gist provider interface after extraction.
- `tests/orders-provider-supabase-module.test.js`
  Purpose: Lock the Supabase provider interface and browser client integration points.
- `tests/orders-storage-mode-ui.test.js`
  Purpose: Lock setup UI additions and script loading order.
- `tests/orders-sync-provider-contract.test.js`
  Purpose: Lock generic sync orchestration against provider adapters.
- `docs/supabase/order-tracker-schema.sql`
  Purpose: Ship the exact SQL schema and RLS policies users run in their own Supabase project.
- `docs/supabase/order-tracker-setup.md`
  Purpose: Give users a concrete setup walkthrough for BYO Supabase.

## Provider Architecture

Use a single provider contract for the order tracker remote backend:

```js
const provider = {
  key: 'gist' | 'supabase' | 'local',
  label: 'GitHub Gist' | 'Supabase' | '仅本地',
  init: async (config) => {},
  isReady: () => true,
  getStatusLabel: () => '已连接',
  pullSnapshot: async () => ({
    orders: [],
    accounts: [],
    updatedAt: '',
    remoteCursor: ''
  }),
  pushChanges: async ({ upserts, deletions, cursor }) => ({
    updatedAt: '',
    remoteCursor: ''
  }),
  signIn: async () => {},
  signOut: async () => {},
  serializeConfig: () => ({}),
  hydrateConfig: raw => raw || {}
};
```

Keep the UI and local cache talking only to generic sync functions. Do not let `session.js` or `index.js` know whether the remote side is Gist or Supabase beyond provider selection and auth prompts.

## Supabase Data Model

Implement row-based sync from the start. Do not store a giant JSON snapshot in one Supabase row.

### Tables

```sql
create table if not exists order_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists orders (
  id text primary key,
  user_id uuid not null,
  account_name text null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists sync_state (
  user_id uuid primary key,
  updated_at timestamptz not null default now(),
  last_client_id text null
);
```

### RLS Direction

Every row must be owned by `auth.uid()`. Policies should be simple:

```sql
alter table order_accounts enable row level security;
alter table orders enable row level security;
alter table sync_state enable row level security;

create policy "users manage own accounts"
on order_accounts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users manage own orders"
on orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users manage own sync_state"
on sync_state
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### Auth Choice

Use Supabase Auth with email magic link in v1. Do not rely on open anon-write tables.

Reason:

- Browser-safe `anon key` is acceptable only when RLS is doing the real protection.
- Anonymous auth is awkward for cross-device restore.
- Magic link keeps the setup smaller than custom OAuth while still allowing the same user to re-connect on another device.

## Local-First Sync Model

The UI source of truth remains local.

### Local write path

1. User creates/edits/deletes an order
2. Save immediately into IndexedDB
3. Mark local record dirty with `updatedAt`, `deletedAt`, and `pendingSync`
4. Re-render from local state
5. Queue background sync

### Remote pull path

1. Load local cache into UI first
2. After provider init succeeds, pull remote rows updated since last cursor
3. Merge remote rows into local cache
4. Resolve conflicts using deterministic rule
5. Re-render if local state changed

### Conflict rule for v1

Use last-write-wins by `updatedAt` for the same order ID.

```js
function pickWinningRow(localRow, remoteRow) {
  const localTs = Date.parse(localRow?.updatedAt || 0);
  const remoteTs = Date.parse(remoteRow?.updatedAt || 0);
  return localTs >= remoteTs ? localRow : remoteRow;
}
```

This is enough for the first pass. Keep the current Gist conflict picker UI out of the Supabase v1 scope.

### Deletion model

Use soft delete, not hard delete, in remote sync.

```js
{
  id: 'order-id',
  deletedAt: '2026-04-20T10:20:30.000Z'
}
```

Remote deletes become `deleted_at`, and local compaction can physically purge old soft-deleted rows later.

## Incremental Rollout

Break the work into six tasks. Each task should ship a working slice.

### Task 1: Add storage-mode foundation

**Files:**
- Create: `tests/orders-storage-mode-ui.test.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/orders/index.js`
- Modify: `js/orders/session.js`

- [ ] **Step 1: Write the failing UI contract test**

```js
assert.match(indexSource, /name="ot-storage-mode"/);
assert.match(indexSource, /id="ot-supabase-url"/);
assert.match(indexSource, /id="ot-supabase-anon-key"/);
assert.match(indexSource, /id="ot-supabase-email"/);
assert.match(indexSource, /supabase-js/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-storage-mode-ui.test.js`
Expected: FAIL because storage-mode controls and Supabase fields do not exist yet

- [ ] **Step 3: Add minimal setup UI**

```html
<div class="ot-storage-modes">
  <label><input type="radio" name="ot-storage-mode" value="gist" checked> GitHub Gist</label>
  <label><input type="radio" name="ot-storage-mode" value="supabase"> Supabase</label>
  <label><input type="radio" name="ot-storage-mode" value="local"> 仅本地</label>
</div>
<div id="ot-supabase-fields" style="display:none">
  <input id="ot-supabase-url" type="url">
  <input id="ot-supabase-anon-key" type="password">
  <input id="ot-supabase-email" type="email">
</div>
```

- [ ] **Step 4: Load the browser client and toggle fields**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

```js
function syncStorageModeFields(mode) {
  $('#ot-supabase-fields').style.display = mode === 'supabase' ? 'block' : 'none';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node tests/orders-storage-mode-ui.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/orders/index.js js/orders/session.js tests/orders-storage-mode-ui.test.js
git commit -m "feat: add order storage mode setup UI"
```

### Task 2: Extract the current Gist provider

**Files:**
- Create: `js/orders/provider-gist.js`
- Create: `tests/orders-provider-gist-module.test.js`
- Modify: `js/orders/sync.js`
- Modify: `js/orders/index.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing provider extraction test**

```js
assert.match(source, /const OrderTrackerProviderGist = \(function \(\) \{/);
assert.match(source, /function create\(/);
assert.match(source, /pullSnapshot/);
assert.match(source, /pushChanges/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-provider-gist-module.test.js`
Expected: FAIL because the provider file does not exist

- [ ] **Step 3: Move Gist-specific remote calls behind the provider**

```js
const OrderTrackerProviderGist = (function () {
  function create(deps) {
    return {
      key: 'gist',
      label: 'GitHub Gist',
      init: async config => config,
      pullSnapshot: async () => fetchGistSnapshot(),
      pushChanges: async payload => pushSnapshotToGist(payload),
      signOut: async () => {}
    };
  }
  return { create };
})();
```

- [ ] **Step 4: Make sync.js depend on a provider, not raw Gist helpers**

```js
const remote = state.remoteProvider;
const snapshot = await remote.pullSnapshot();
await remote.pushChanges(batch);
```

- [ ] **Step 5: Run tests to verify provider extraction works**

Run: `node tests/orders-provider-gist-module.test.js`
Expected: PASS

Run: `node tests/orders-sync-module.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/orders/provider-gist.js js/orders/sync.js js/orders/index.js index.html tests/orders-provider-gist-module.test.js
git commit -m "refactor: extract gist sync provider"
```

### Task 3: Add the Supabase provider skeleton

**Files:**
- Create: `js/orders/provider-supabase.js`
- Create: `tests/orders-provider-supabase-module.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing Supabase provider contract test**

```js
assert.match(source, /const OrderTrackerProviderSupabase = \(function \(\) \{/);
assert.match(source, /supabase\.createClient|createClient/);
assert.match(source, /signInWithOtp/);
assert.match(source, /pullSnapshot/);
assert.match(source, /pushChanges/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-provider-supabase-module.test.js`
Expected: FAIL because the provider file does not exist

- [ ] **Step 3: Add provider bootstrap and auth entry points**

```js
const OrderTrackerProviderSupabase = (function () {
  function create({ state, helpers }) {
    let client = null;
    return {
      key: 'supabase',
      label: 'Supabase',
      init: async config => {
        client = window.supabase.createClient(config.url, config.anonKey);
      },
      signIn: async ({ email }) => client.auth.signInWithOtp({ email }),
      pullSnapshot: async () => ({ orders: [], accounts: [], updatedAt: '', remoteCursor: '' }),
      pushChanges: async () => ({ updatedAt: '', remoteCursor: '' })
    };
  }
  return { create };
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/orders-provider-supabase-module.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/orders/provider-supabase.js index.html tests/orders-provider-supabase-module.test.js
git commit -m "feat: add supabase provider skeleton"
```

### Task 4: Implement row-based pull/push and local merge

**Files:**
- Create: `tests/orders-sync-provider-contract.test.js`
- Modify: `js/orders/provider-supabase.js`
- Modify: `js/orders/sync.js`
- Modify: `js/orders/shared.js`

- [ ] **Step 1: Write the failing sync contract test**

```js
assert.equal(mergeResult.orders.length, 2);
assert.equal(mergeResult.remoteCursor, '2026-04-20T10:00:00.000Z');
assert.equal(mergeResult.orders.find(o => o.id === '1')['订单号'], 'A-1');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-sync-provider-contract.test.js`
Expected: FAIL because provider-based merge/cursor logic does not exist

- [ ] **Step 3: Implement Supabase pull by timestamp cursor**

```js
const { data } = await client
  .from('orders')
  .select('id, account_name, payload, updated_at, deleted_at')
  .gt('updated_at', cursor || '1970-01-01T00:00:00.000Z')
  .order('updated_at', { ascending: true });
```

- [ ] **Step 4: Implement Supabase batched upsert and soft delete**

```js
await client.from('orders').upsert(rows, { onConflict: 'id' });
await client.from('order_accounts').upsert(accountRows, { onConflict: 'user_id,name' });
```

- [ ] **Step 5: Implement local-first merge in sync.js**

```js
const merged = mergeRowsById({
  localOrders: state.orders,
  remoteOrders: snapshot.orders,
  resolver: pickWinningRow
});
state.orders = merged.orders;
state.remoteCursor = merged.remoteCursor || snapshot.remoteCursor;
```

- [ ] **Step 6: Run tests to verify it passes**

Run: `node tests/orders-sync-provider-contract.test.js`
Expected: PASS

Run: `node tests/orders-sync-module.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add js/orders/provider-supabase.js js/orders/sync.js js/orders/shared.js tests/orders-sync-provider-contract.test.js
git commit -m "feat: add local-first supabase sync flow"
```

### Task 5: Integrate session flow and provider switching

**Files:**
- Modify: `js/orders/session.js`
- Modify: `js/orders/index.js`
- Modify: `css/style.css`
- Modify: `index.html`

- [ ] **Step 1: Write the failing session flow test**

```js
assert.match(source, /mode === 'supabase'/);
assert.match(source, /provider\.signIn/);
assert.match(source, /provider\.init/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/orders-session-module.test.js`
Expected: FAIL because session flow does not branch by storage mode

- [ ] **Step 3: Add provider-aware setup flow**

```js
if (mode === 'supabase') {
  await provider.init({ url, anonKey });
  await provider.signIn({ email });
} else if (mode === 'gist') {
  await provider.init({ token, gistId });
}
```

- [ ] **Step 4: Keep local-only mode explicit**

```js
if (mode === 'local') {
  state.remoteProvider = OrderTrackerProviderLocal.create();
  showMain();
  renderTable();
  setSync('仅本地保存', 'local');
  return;
}
```

- [ ] **Step 5: Run tests to verify it passes**

Run: `node tests/orders-session-module.test.js`
Expected: PASS

Run: `node tests/orders-storage-mode-ui.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/orders/session.js js/orders/index.js css/style.css index.html
git commit -m "feat: support local, gist, and supabase storage modes"
```

### Task 6: Ship user-facing Supabase setup docs and schema

**Files:**
- Create: `docs/supabase/order-tracker-schema.sql`
- Create: `docs/supabase/order-tracker-setup.md`

- [ ] **Step 1: Write the exact SQL schema file**

```sql
create extension if not exists pgcrypto;
-- tables and RLS policies from this plan
```

- [ ] **Step 2: Write the setup guide**

```md
1. Create a Supabase project
2. Enable email auth
3. Run `order-tracker-schema.sql`
4. Copy Project URL and anon key
5. Open the tool and choose `Supabase`
6. Enter your email, receive magic link, and finish sign-in
```

- [ ] **Step 3: Run a placeholder scan on the docs**

Run: `python - <<'PY'
from pathlib import Path
for path in Path('docs/supabase').rglob('*'):
    if path.is_file():
        text = path.read_text(encoding='utf-8')
        for token in ('to-do-marker', 'tbd-marker', 'zh-placeholder'):
            if token in text:
                print(path, token)
PY`
Expected: no matches

- [ ] **Step 4: Commit**

```bash
git add docs/supabase/order-tracker-schema.sql docs/supabase/order-tracker-setup.md
git commit -m "docs: add byo supabase setup guide for order tracker"
```

## Verification Matrix

Run this full verification set before claiming the work is complete:

```bash
node tests/orders-storage-mode-ui.test.js
node tests/orders-provider-gist-module.test.js
node tests/orders-provider-supabase-module.test.js
node tests/orders-sync-provider-contract.test.js
node tests/orders-sync-module.test.js
node tests/orders-session-module.test.js
node tests/orders-table-view.test.js
node tests/orders-crud-module.test.js
node tests/orders-export-module.test.js
node --check js/orders/provider-gist.js
node --check js/orders/provider-supabase.js
node --check js/orders/sync.js
git diff --check
```

Expected:

- all tests pass
- syntax checks return exit code `0`
- no whitespace or merge-marker issues from `git diff --check`

## Scope Guardrails

Do not include these in the first implementation:

- multi-user collaboration in the same Supabase project
- shared team workspaces
- realtime subscriptions
- manual conflict resolution UI for Supabase mode
- migrating existing Gist data automatically inside the tool

Keep v1 focused:

- one user
- one BYO Supabase project
- local-first
- pull/push sync
- deterministic merge
