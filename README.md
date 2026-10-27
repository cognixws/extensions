# COGNIX[WS] extension catalog

This repository is the registry behind the **Browse** tab of the Extensions
screen in [COGNIX[WS]](https://github.com/cognixws/picode). It holds one
catalog entry per extension — never the extensions themselves. An extension
lives in its author's own git repository; the catalog only recommends it.

- `catalog.json` — the catalog. One JSON object per extension.
- `icons/<id>.svg` — the icon each entry points at.
- `GUIDELINES.md` — what reviewers check before a submission merges.
- `API_VERSION` — the highest extension `apiVersion` this catalog accepts.

## Submitting an extension

1. Publish your extension in a **public git repository**. Its root holds
   `picode-extension.json` (see the manifest docs) and a `LICENSE`.
2. Tag a release, e.g. `v1.0.0`. The catalog pins a `ref` — publishing an
   update means a new pull request that bumps it, so every version the
   marketplace recommends was reviewed.
3. Fork this repository, add your icon at `icons/<your-id>.svg`, and add one
   object to `catalog.json`:

   ```json
   {
     "id": "my-extension",
     "name": "My Extension",
     "publisher": "yourname",
     "description": "One sentence on what it adds.",
     "repo": "https://github.com/you/my-extension",
     "ref": "v1.0.0",
     "tags": ["productivity"],
     "icon": "icons/my-extension.svg",
     "tier": "community",
     "pricing": "free"
   }
   ```

4. Open a pull request. CI validates the entry and reads your manifest at
   the pinned ref. A maintainer reviews it against
   [GUIDELINES.md](GUIDELINES.md) and merges. Once merged, the entry
   reaches every COGNIX[WS] installation's Browse tab within its refresh
   interval.

Every submission is reviewed, and not all of them make the cut — the catalog
is an opinion about other people's software, and a broken card is COGNIX[WS]'s
fault, not yours.

## What installing does

The catalog never ships code. When a person installs your extension,
COGNIX[WS] clones your repository at the pinned `ref`, shows them what the
manifest declares — tools, skills, pages, permissions — and installs only
after they accept. A newer `apiVersion` than their installation supports is
refused there, never ignored.
