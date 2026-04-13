# Handoff — `istefox/obsidian-mcp-tools`

> **Aggiornato 2026-04-13 (sessione serale).** Documento di passaggio di consegne
> tra macchine. Self-contained: dal clone iniziale al primo prompt
> da mandare a Claude Code sul nuovo Mac, qui c'è tutto.
>
> **Per il quadro architetturale completo** (gotcha, stack,
> convenzioni di codice): leggere **`CLAUDE.md`** in radice — è
> mantenuto aggiornato dopo ogni sessione significativa. Questo
> file è la sintesi *operativa*; CLAUDE.md è la sintesi *tecnica*.

---

## Indice

1. [Stato attuale del fork](#1-stato-attuale-del-fork)
2. [Setup del nuovo Mac dell'ufficio](#2-setup-del-nuovo-mac-dellufficio)
3. [Setup del vault TEST](#3-setup-del-vault-test-per-integration-manuale)
4. [Avvio della prima sessione Claude Code](#4-avvio-della-prima-sessione-claude-code)
5. [Cosa è stato fatto recentemente](#5-cosa-è-stato-fatto-nella-serie-di-sessioni-2026-04-09--2026-04-12)
6. [Cosa resta aperto](#6-cosa-resta-aperto)
7. [File chiave da conoscere](#7-file-chiave-da-conoscere)
8. [Cosa NON fare](#8-cosa-non-fare)
9. [Riferimenti esterni](#9-riferimenti-esterni)

---

## 1. Stato attuale del fork

### Repository
- Branch attivo: **`main`**
- Up to date con `myfork/main` su `https://github.com/istefox/obsidian-mcp-tools`
- Ultimo commit (al momento di scrittura): **`23f5362`** (`chore: ignore bun build artifacts`) sopra `f62c47f` (docs: slim CLAUDE.md) sopra `eff807a` (consolidate handoff)
- Working tree: clean. I 2 file `.bun-build` orfani (~118 MB totali)
  restano su disco ma ora sono gitignored — cancellabili a piacere
  senza sporcare git status
- Branch feature aperti: nessuno

### Health
| | |
|---|---|
| `bun run check` (4 package) | ✅ passa |
| Test obsidian-plugin | ✅ **126 pass / 0 fail / 9 file** |
| Test mcp-server | ✅ **93 pass / 0 fail / 8 file** |
| Plugin prod build | ✅ |
| Server cross-compile (4 target: mac-arm64, mac-x64, linux, windows) | ✅ |

### Funzionalità complete

Il fork ha tutto Cluster A-F chiuso e Cluster G praticamente chiuso:

- **Cluster A-F** (bug fix upstream noti): tutti landed
- **#29 (command execution)**: Fase 1 + Fase 2 landed; solo Fase 3
  (polish) aperta
- **#28** (install outside vault): completo
- **#26** (platform override per WSL): completo
- **#62, #61, #60, #59, #35**: tutti completi
- **Roadmap originale**: 11/12 chiusi; l'unico aperto (#11 — prune
  branch upstream stale) non è risolvibile dal fork

---

## 2. Setup del nuovo Mac dell'ufficio

Da seguire una volta sola al primo accesso. Tempo stimato: ~10 minuti.

### 2.1 Prerequisiti

```bash
# Bun (runtime + package manager). Non installare npm/yarn/pnpm —
# il monorepo è bun-only.
curl -fsSL https://bun.sh/install | bash

# GitHub auth — scegli UNO dei due metodi:

#   (a) gh CLI con login interattivo (consigliato se nuovo Mac)
brew install gh && gh auth login

#   (b) SSH key esistente già caricata su github.com (più rapido se
#       hai già la chiave configurata)
ssh -T git@github.com  # test della chiave

# Obsidian app
brew install --cask obsidian
# oppure manualmente da https://obsidian.md
```

### 2.2 Clone del fork

```bash
# Crea la cartella di lavoro (path a tua scelta, esempio coerente
# con il Mac di casa):
mkdir -p ~/Documents/Projects/Obsidian\ MCP
cd ~/Documents/Projects/Obsidian\ MCP

# HTTPS (richiede gh login):
gh repo clone istefox/obsidian-mcp-tools

# Oppure SSH se preferisci:
git clone git@github.com:istefox/obsidian-mcp-tools.git

cd obsidian-mcp-tools
```

### 2.3 Sistema i remote

Quando cloni dalla tua fork, `origin` punta già a `istefox/...`. Per
coerenza con il workflow attuale (in cui il remote si chiama
`myfork`), rinomina:

```bash
git remote rename origin myfork

# Opzionale — se vuoi anche seguire upstream (jacksteamdev) per
# eventuali cherry-pick futuri:
git remote add upstream https://github.com/jacksteamdev/obsidian-mcp-tools.git
git fetch --all
```

Verifica con `git remote -v`. Output atteso:
```
myfork    https://github.com/istefox/obsidian-mcp-tools.git (fetch)
myfork    https://github.com/istefox/obsidian-mcp-tools.git (push)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (fetch)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (push)
```

### 2.4 Install dipendenze

```bash
bun install   # installa workspace: server + plugin + shared + test-site
```

### 2.5 Verifica salute (smoke test)

```bash
# Type-check su tutti i package
bun run check

# Test del plugin
cd packages/obsidian-plugin && bun test && cd ../..

# Test del server
cd packages/mcp-server && bun test && cd ../..
```

**Aspettative**: type check verde; **219 test totali, 0 failure**
(126 plugin + 93 server).

### 2.6 Build una tantum (per esercitare il path)

```bash
# Plugin → produce main.js + styles.css IN RADICE del repo
# (Obsidian si aspetta lì, NON in dist/)
cd packages/obsidian-plugin && bun run build && cd ../..

# Server binario → produce packages/mcp-server/dist/mcp-server (60 MB)
cd packages/mcp-server && bun run build && cd ../..
```

`dist/` è gitignored, quindi i binari restano locali. La CI li
rigenera per le release tag.

---

## 3. Setup del vault TEST per integration manuale

Le sessioni precedenti hanno usato un vault Obsidian dedicato per i
test manuali end-to-end (path su Mac di casa: `~/Obsidian/TEST`).
Sul nuovo Mac devi ricrearlo:

### 3.1 Crea il vault

1. Apri Obsidian → **Create new vault** → nome `TEST`, path
   `~/Obsidian/TEST` (o dove preferisci).

### 3.2 Abilita Local REST API

Il plugin MCP Tools dipende da Local REST API per esporre le route
HTTP custom (incluso il gate `/mcp-tools/command-permission/` di
#29).

2. Settings → Community plugins → **Turn on community plugins**
3. Browse → cerca **"Local REST API"** di Adam Coddington
4. Install → Enable
5. Settings → Local REST API → verifica che ci sia una **API key**
   già generata. **Annotala** — ti serve per le curl di test
   manuali.

### 3.3 Symlinka il plugin di sviluppo nel vault

```bash
# Sostituisci il path con quello reale del checkout
REPO=~/Documents/Projects/Obsidian\ MCP/obsidian-mcp-tools
mkdir -p ~/Obsidian/TEST/.obsidian/plugins
ln -s "$REPO" ~/Obsidian/TEST/.obsidian/plugins/mcp-tools
```

### 3.4 Attiva il plugin

6. In Obsidian → Settings → Community plugins → attiva **MCP Tools**
7. Settings → MCP Tools → opzionalmente "Install server" se vuoi
   testare il server end-to-end (NON serve per Fase 3 di #29 — la
   Fase 3 è solo plugin-side)

### 3.5 Esempio di curl per testare il command-permission gate

(Sostituire `YOUR_API_KEY_HERE` con la API key del passo 3.2.5.)

```bash
# Allow path (assumendo "editor:toggle-bold" in allowlist)
curl -sk -X POST "https://127.0.0.1:27124/mcp-tools/command-permission/" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"editor:toggle-bold"}'

# Modal path (comando non in allowlist con master toggle ON →
# apre il modal in Obsidian, long-poll fino a 30s)
curl -sk -X POST "https://127.0.0.1:27124/mcp-tools/command-permission/" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"workspace:edit-file-title"}' --max-time 35
```

---

## 4. Avvio della prima sessione Claude Code

Dentro la directory del repo, lancia `claude`. Come **primo prompt**
da mandare:

```
Stiamo continuando il lavoro sul fork istefox/obsidian-mcp-tools.
Ho appena fatto setup su questo Mac (Bun installato, repo clonato,
remote myfork sistemato, bun install fatto, vault TEST configurato
con Local REST API). Leggi prima handoff.md per orientarti, poi
CLAUDE.md per il quadro architetturale. Riassumimi in 5 righe lo
stato attuale e dimmi quale dei follow-up A/B/C/D/E/F proposti
vogliamo fare.
```

Claude Code ha memoria locale separata per macchina, quindi sul
nuovo Mac partirà senza il contesto delle sessioni precedenti. Questo
handoff + CLAUDE.md sono i suoi due input principali.

### Promemoria di stile

(Dovrebbero già essere in `~/.claude/CLAUDE.md` se hai sincronizzato
le tue user instructions globali. Se non lo sono, comunica
esplicitamente:)

- Risposte in italiano, codice/commenti in inglese
- Tono diretto, no filler
- Includere il livello di confidenza (alta / media / bassa) nelle
  risposte tecniche
- Pattern git: feature branch + merge `--no-ff` su main + push su
  `myfork`. Mai commit diretti su main per cambiamenti sostanziali
- Test manuale in vault TEST quando si tocca UI o flow runtime
- Mai tag/release senza chiedere

---

## 5. Cosa è stato fatto nella serie di sessioni (2026-04-09 → 2026-04-12)

In ordine cronologico inverso, con commit SHA su `myfork/main`:

| Date approx | Lavoro | Commit/merge |
|---|---|---|
| 2026-04-13 | Rename cartella progetto a `Obsidian MCP.nosync` (iCloud exclusion), fix `core.hooksPath` stale in git config, gitignore `*.bun-build`, rimosso doc stale `docs/features/prompt-requirements.md` | `f62c47f`, `23f5362` |
| 2026-04-12 | **#29 Fase 2 + race fix** — modal long-polling, soft rate warning, destructive heuristic, mutex per audit log | `de39e61`, `d134924`, merge `e29cf7b` |
| 2026-04-11 | Fix build mcp-server (type-only imports in `plugin-templater.ts`) | `2c482a6`, merge `1582fb4` |
| 2026-04-11 | **#29 Fase 1 MVP** — allowlist gating, audit log, rate limiter | `c2f4549`, merge `148d875` |
| 2026-04-11 | Doc prompt system end-to-end (roadmap #12) | `9f3d432`, merge `f202b51` |
| 2026-04-11 | `cline_docs/` directory (roadmap #10) | `a88fda2`, merge `2577f49` |
| 2026-04-11 | Upgrade MCP SDK 1.0.4 → 1.29.0 (roadmap #8) | `d925da3`, merge `cc7b849` |
| 2026-04-11 | Design review #29 (Option F hybrid) | merge `37e326a` |
| 2026-04-10 | Cluster G items, installer tests, platform override #26, install location #28 | (vedi `git log --oneline`) |

Per il dettaglio completo:

```bash
git log --oneline --first-parent main   # solo i merge in cronologia
git log --oneline                       # tutti i commit
```

---

## 6. Cosa resta aperto

In ordine di priorità potenziale (decidi tu — il fork è in stato
funzionale stabile, nessuna di queste è urgente):

### A — Tag release `v0.2.27-istefox.1`
- **Effort**: ~10 minuti (più tempo di esecuzione CI)
- **Valore**: produce artefatti GitHub Release distribuibili,
  sblocca installazione su altri vault senza dover buildare
  localmente
- **Note**: usare `bun run version` per coerenza atomica tra
  `package.json`, `manifest.json`, `versions.json`. Verificare che
  `.github/workflows/release.yml` funzioni davvero — nessuno l'ha
  testato dopo il fix `2c482a6`.

### B — #29 Fase 3 (polish)
- **Effort**: 2-4 ore
- **Scope**:
  1. Test automatizzati del flow modal — richiede mock di `Modal`
     in `test-setup.ts` + harness spy-based per simulare click
  2. Categorized presets ("Editing", "Navigation", "Search") nella
     settings UI per ridurre attrito di bootstrap dell'allowlist
  3. Rate limiter configurabile via Advanced disclosure
  4. CSV export dell'audit log dalla settings UI
- **Riferimento**: `docs/design/issue-29-command-execution.md` —
  contiene il piano completo, leggere prima di iniziare

### C — Decisione di maintainership / rebrand
- **Effort**: ~30 minuti decisione + edit, poi tempo di pubblicazione
- **Scope**:
  - Cambiare `manifest.json#id` (attualmente `mcp-tools`) per
    evitare collisione con upstream nel community plugin store
  - Aggiornare README per chiarire che è un fork attivo
  - Eventuale cambio del nome del package npm/Bun
- **Decisione posticipata**: non è stato ancora deciso se
  positionare il fork come autonomo a lungo termine

### D — Sync con upstream
- **Effort**: 5 minuti per il check, ore se ci sono cose da
  cherry-pickare
- **Scope**: `git fetch upstream && git log upstream/main --oneline -20`
  per vedere se è stato pushato qualcosa di interessante. Storico:
  upstream è dormant, probabilmente niente di nuovo.

### E — Pulizia operativa
- ✅ `*.bun-build` aggiunto a `.gitignore` (commit `23f5362`, 2026-04-13)
- ✅ `docs/features/prompt-requirements.md` rimosso (era stale, sostituito da `prompt-system.md`)
- Rimasto: cancellare i 2 file `.bun-build` fisici in `packages/mcp-server/.18a5*.bun-build` (~118 MB). Opzionale, si rigenerano al prossimo build

### F — CI release.yml — esercitare per la prima volta
- **Effort**: dipende. Se rotta serve fix
- **Scope**: la CI release-on-tag non è mai stata triggerata sul
  fork. Potrebbe avere problemi (env var mancanti, secret,
  permission). Da provare con un pre-release tag (`v0.2.27-test.1`)
  monouso.

---

## 7. File chiave da conoscere

| File | Cosa contiene |
|---|---|
| `handoff.md` | **Questo file** — sintesi operativa per cambio macchina |
| `CLAUDE.md` | Architettura, convenzioni, gotcha, snapshot fork — **leggere sempre dopo questo handoff** |
| `.clinerules` | Contratto autoritativo della feature architecture (più rigido di CLAUDE.md, raramente cambia) |
| `docs/design/issue-29-command-execution.md` | Design completo Fase 1+2+3 di #29, includendo il diario di Fase 2 |
| `docs/features/prompt-system.md` | Reference del sistema prompts (vault → MCP) |
| `docs/features/mcp-server-install.md` | Reference dell'installer flow |
| `docs/project-architecture.md` | Vista alto livello (allineato con `.clinerules`) |
| `docs/migration-plan.md` | Storico — può essere stantio, da verificare prima di seguire |
| `cline_docs/` | Directory per task records on-demand (workflow opzionale, non in uso attivo) |
| `packages/obsidian-plugin/src/main.ts` | Entry point del plugin Obsidian |
| `packages/mcp-server/src/index.ts` | Entry point del server MCP standalone |
| `packages/shared/src/types/plugin-local-rest-api.ts` | Schemi ArkType per le route HTTP del plugin |
| `packages/obsidian-plugin/src/features/command-permissions/` | Tutta Fase 1 + 2 di #29 |

---

## 8. Cosa NON fare

- **Non bumpare versione manualmente** — usare sempre `bun run version [patch|minor|major]`
- **Non committare `dist/`** — è gitignored, deve restarlo
- **Non usare npm/yarn/pnpm** — il monorepo è bun-only (vedi `bun.lock`)
- **Non modificare** `patches/svelte@5.16.0.patch` senza prima
  capire perché esiste (vedi gotcha in CLAUDE.md)
- **Non rimuovere** `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"`
  in `packages/mcp-server/src/.../makeRequest.ts` — rompe ogni
  chiamata server → Obsidian
- **Non importare valori runtime da `"obsidian"`** dentro
  `packages/shared/` — usare `import type`. Vedi gotcha
  `2c482a6` in CLAUDE.md.
- **Non assumere atomicità di `loadData`/`saveData`** —
  serializzare con un mutex (vedi
  `packages/obsidian-plugin/src/features/command-permissions/services/settingsLock.ts`)
  per ogni feature che fa load → modify → save sotto carico concorrente.
- **Non commit diretti su main** per cambiamenti non banali — usare
  feature branch + merge `--no-ff`

---

## 9. Riferimenti esterni

- **Issue tracker upstream**: https://github.com/jacksteamdev/obsidian-mcp-tools/issues
- **Discord MCP Tools**: invito nel README, canale `#maintainers`
- **Obsidian Local REST API**: https://github.com/coddingtonbear/obsidian-local-rest-api
- **MCP spec**: https://modelcontextprotocol.io
- **Jason Bates fork** (per cherry-pick storici): commit `8adb7dd`

---

*Documento mantenuto come riferimento operativo "ponte tra macchine".
Quando una sessione finisce o si chiude un blocco di lavoro
significativo, è ragionevole aggiornarlo con un changelog conciso
in cima alla sezione 5.*
