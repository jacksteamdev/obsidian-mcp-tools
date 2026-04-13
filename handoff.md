# Handoff — `istefox/obsidian-mcp-connector` (was `obsidian-mcp-tools`)

> **Aggiornato 2026-04-13 (sessione notte — pubblicazione community).** Documento di passaggio di consegne
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
- **Repo rinominato 2026-04-13 notte:** `istefox/obsidian-mcp-tools` → **`istefox/obsidian-mcp-connector`**. GitHub mantiene il redirect HTTP del vecchio URL ma il git remote locale è già aggiornato.
- **Plugin id rinominato:** `mcp-tools` → **`mcp-tools-istefox`** (perché l'id deve essere unico nel community store, e `mcp-tools` è ancora occupato dall'entry upstream).
- **Display name del plugin:** "MCP Connector".
- Branch attivo: **`main`**
- **Remote setup canonico:**
  - `origin` → `https://github.com/istefox/obsidian-mcp-connector.git` (push allowed, dove ship le release)
  - `upstream` → `https://github.com/jacksteamdev/obsidian-mcp-tools.git` (read-only, per fetch + cherry-pick)
  - `main` tracks `origin/main`
- **Ultimo commit (al momento di scrittura):** **`2f99390`** (`0.3.1` version bump tag). Working tree clean.
- I 2 file `.bun-build` orfani (~118 MB totali) restano su disco ma sono gitignored.

### Release pubbliche
| Versione | Data | Note |
|---|---|---|
| **`0.3.1`** | 2026-04-13 notte | LATEST — manifest description corretta per community-store rules (drop "Obsidian", drop maintainer-attribution suffix). Rebuild after store reviewer-bot feedback. |
| `0.3.0` | 2026-04-13 notte | First public release. Brand "MCP Connector". Tag eliminato e re-emesso dopo un mishap del version script che aveva prodotto 0.2.28. |

URL release: https://github.com/istefox/obsidian-mcp-connector/releases

### Health
| | |
|---|---|
| `bun run check` (4 package) | ✅ passa |
| Test obsidian-plugin | ✅ **179 pass / 0 fail / 12 file** |
| Test mcp-server | ✅ **94 pass / 0 fail / 8 file** (+1 regression #77 stasera) |
| Plugin prod build | ✅ |
| Server cross-compile (4 target: mac-arm64, mac-x64, linux, windows) | ✅ |
| GitHub Actions release.yml | ✅ esercitata (run 0.3.0 + 0.3.1 entrambe verdi) |

### Funzionalità complete

Il fork ha tutto Cluster A-F chiuso e Cluster G praticamente chiuso:

- **Cluster A-F** (bug fix upstream noti): tutti landed
- **#29 (command execution)**: **Fase 1 + 2 + 3 tutte landed** (Fase 3 completata 2026-04-13 sera)
- **#28** (install outside vault): completo
- **#26** (platform override per WSL): completo
- **#77** (no-arg inputSchema, openai-codex compat): coperto (regression test stasera, fix latente in `normalizeInputSchema`)
- **#62, #61, #60, #59, #35**: tutti completi
- **Roadmap originale**: 11/12 chiusi
- **Coverage issue upstream aperte**: 21 di 24 risolte direttamente, +1 partial (#59), +2 probabilmente coperte da #28 (#27, #38). Solo 0 issue non risolte.

### Distribuzione community
- **PR community store aperta:** https://github.com/obsidianmd/obsidian-releases/pull/11919
- Stato: **"Ready for review"** (validation passed dopo 2 iterazioni di fix). In attesa di revisione umana del team Obsidian (tipicamente 2-8 settimane).
- **BRAT** già funzionante: utenti possono installare oggi puntando a `istefox/obsidian-mcp-connector`.

### Vault locali
Plugin symlinkato in due vault per dev/test:
- `~/Obsidian/TEST/.obsidian/plugins/mcp-tools-istefox/` (era `mcp-tools/` — rinominato dopo l'id change)
- `~/Obsidian/Lab/.obsidian/plugins/mcp-tools-istefox/` (vault "vero" dell'utente, configurato 2026-04-13 con Local REST API + binario in `~/Library/Application Support/obsidian-mcp-tools/bin/`, Claude Desktop config con `OBSIDIAN_API_KEY` di Lab)

`data.json` è dentro il symlink target = nel repo. **TEST e Lab condividono lo stesso `data.json`** (effetto del symlink). Per separarli serve distribuire come zip vero e proprio invece che symlink.

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
# Crea la cartella di lavoro:
mkdir -p ~/Documents/Projects
cd ~/Documents/Projects

# HTTPS (richiede gh login):
gh repo clone istefox/obsidian-mcp-connector

# Oppure SSH se preferisci:
git clone git@github.com:istefox/obsidian-mcp-connector.git

cd obsidian-mcp-connector
```

### 2.3 Sistema i remote

Quando cloni dalla tua fork, `origin` punta già a `istefox/obsidian-mcp-connector`. Aggiungi `upstream` per seguire `jacksteamdev`:

```bash
git remote add upstream https://github.com/jacksteamdev/obsidian-mcp-tools.git
git fetch --all
```

Verifica con `git remote -v`. Output atteso:
```
origin    https://github.com/istefox/obsidian-mcp-connector.git (fetch)
origin    https://github.com/istefox/obsidian-mcp-connector.git (push)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (fetch)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (push)
```

> **NOTA STORICA:** prima della sessione del 2026-04-13 il fork si chiamava `obsidian-mcp-tools` e il remote del fork era `myfork`. La sessione di stasera ha rinominato il repo a `obsidian-mcp-connector` e ha riallineato i nomi remote alla convenzione standard (`origin` = il tuo fork, `upstream` = sorgente). Se trovi commit/script che fanno riferimento a `myfork`, sono pre-rename.

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
| 2026-04-13 notte | **Pubblicazione community completa**: rebrand MCP Connector (id `mcp-tools-istefox`), repo rinominato `obsidian-mcp-connector`, README user-facing, migration guide, fix release pipeline (zip vuoto + version script argv bug + styles.css inesistente), release `0.3.0` + `0.3.1`, PR a `obsidianmd/obsidian-releases#11919` (validation passed). | merges `0028fd9`, `afc1a3c`, `b6d6f54`, `78e0854`, `8ce52aa`; tag `0.3.0` + `0.3.1` |
| 2026-04-13 notte | Setup vault Lab con MCP Connector end-to-end (Local REST API, install server, Claude Desktop config con OBSIDIAN_API_KEY di Lab). Smoke test: Claude Desktop legge il vault Lab via MCP. | (config esterna, no commit) |
| 2026-04-13 sera/notte | Regression test mirato per upstream issue #77 (`normalizeInputSchema` integrated path) | merge `c7c93be` |
| 2026-04-13 sera | **#29 Fase 3 completa (4/4 subtask)**: (1) test suite modal+handler con Modal/svelte mock in test-setup.ts, (2) export CSV audit log da settings UI, (3) soft rate-limit configurabile via Advanced disclosure, (4) quick-add presets (Editing/Navigation/Search) curati e filtrati sul registry. **+53 test**. | merge `4655e4b`, `fc00c4f`, `84e0a37`, `d60e907` |
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

In ordine di priorità potenziale per le prossime sessioni:

### A — Monitoraggio review PR community store
- **PR**: https://github.com/obsidianmd/obsidian-releases/pull/11919
- **Stato attuale**: "Ready for review", validation passed
- **Tempistica review umana**: 2-8 settimane tipiche
- **Cosa fare**: aspettare. Se ObsidianReviewBot o un maintainer chiede modifiche, rispondere con le iterazioni necessarie. Possibili request:
  - Modifiche al README
  - Modifiche al manifest
  - Code review issues
  - Supplementary docs
- **Notifiche**: GitHub manda email su qualsiasi commento sulla PR

### B — Fase 4 outreach — annuncia il fork sulle issue upstream risolte
- **Effort**: ~30 min totale (commento standard ripetuto)
- **Scope**: commentare sulle 21 issue upstream risolte (#26, #28, #30, #31, #33, #35, #36, #37, #39, #40, #41, #59, #60, #61, #62, #63, #66, #67, #68, #71, #77) per dire "this is fixed in the community fork at istefox/obsidian-mcp-connector". Ogni autore originale riceve notifica → outreach efficace.
- **Pattern del commento** (template salvato in memoria di sessione di stasera):
  ```
  For users still waiting on this — fixed in the community fork
  at github.com/istefox/obsidian-mcp-connector
  ([commit X], release vY.Z). Install via BRAT or wait for the
  pending community-store entry (PR #11919).
  ```
- **Quando farlo**: meglio dopo che PR community store è merged (così l'utente può cliccare-e-installare direttamente nello store), MA va bene anche subito con BRAT come fallback.

### C — Sync periodico con upstream
- **Effort**: 5 min per il check, ore se ci sono cose da cherry-pick
- **Scope**: `git fetch upstream && git log upstream/main --oneline -20` periodicamente. Storico: upstream è dormant, ma se il maintainer torna è bene saperlo.

### D — Pulizia operativa
- ✅ `*.bun-build` gitignored
- ✅ `docs/features/prompt-requirements.md` rimosso
- Rimasto opzionale: cancellare i 2 file `.bun-build` fisici (~118 MB), si rigenerano al prossimo build

### E — Issue #59 full implementation (binary content types)
- **Effort**: ~2 h
- **Scope**: SDK MCP 1.29.0 supporta nativamente audio/image responses; `f6d004a` lasciò un text short-circuit. Sostituire con response native di tipo image/audio per `get_vault_file`. Beneficiari: utenti che vogliono che l'agente legga PDF, immagini, audio dal vault.

### F — Roadmap dopo il merge community store
- Una volta che la PR `obsidianmd/obsidian-releases#11919` è merged:
  - Aggiornare README rimuovendo "Once approved" e mettendo solo "Available in community store"
  - Aggiornare migration-from-upstream.md indicando il community store come opzione preferita
  - Considerare di aprire issues "good first issue" per attirare contributor (es. test Linux/Windows manuali, traduzioni, etc.)

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
