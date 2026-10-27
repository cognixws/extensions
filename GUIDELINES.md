# Review guidelines

A submission is one catalog entry plus an icon. Review the pull request
against this checklist. CI has already validated the schema, the id, the
pinned ref's existence, and that a parseable manifest sits at that ref.

## The person reviewing answers, in order

1. **Does it do what the description says?** Read the manifest at the
   pinned ref: declared tools, skills, pages, commands and permissions
   should match the one-sentence description. A calendar extension asking
   for `messages:owner` is a question, not a detail.
2. **Is the source honest?** Skim the repository at the ref: no minified or
   obfuscated blobs, no `curl | sh` in skills or process commands, no
   credentials checked in, commands that do what their names say.
3. **Is it the author's work?** The repo is theirs, the manifest names them
   as publisher, and the icon is theirs to license.
4. **Would you install it?** The catalog is PiCode's opinion. A card you
   would not install on your own machine is a decline, politely explained.

## Refuse when

- The `id` collides with an existing entry, an extension built into the
  app, or a well-known first-party name (`picode-*` is reserved for
  first-party entries; community entries use `tier: "community"`).
- The description oversells or hides what the permissions really do.
- The pinned `ref` is a branch that moves (`main`, `master`): a pin must be
  a tag or a full commit sha, so the reviewed diff stays the thing people
  get. Tag a release and pin that.
- The repository is a fork of someone else's extension with no
  substantial, attributable change.
- Malware-adjacent of any kind: credential harvesting, data exfiltration,
  disguised system commands. Decline, and note the account for the
  maintainers.

## Version bumps (update PRs)

The same checklist, focused on the **diff between the old pinned ref and
the new one** — GitHub shows it on the PR if the entry is touched together
with its bump, otherwise compare the refs in the source repo. A bump that
adds a permission is a full review, not a glance.

## Merging

Squash-merge. The catalog refreshes on every COGNIX[WS] installation within
its refresh interval; nothing else to do.
