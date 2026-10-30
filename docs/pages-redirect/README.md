# Pages redirect kit

Keeps old `https://conorluddy.github.io/Topogra/?…` design links working after the rename to `landcube`.

## Why this is needed

Renaming a GitHub repository redirects git and web traffic, but **not the project Pages URL**. Without this kit every shared `conorluddy.github.io/Topogra/…` link returns 404. Do not create a new repo named `Topogra`: it ends the git redirects.

## Manual steps (in order)

1. Merge the rename PR, then publish: `npm publish` (first `landcube` release, 0.3.0).
2. `npm deprecate topogra "Renamed to landcube"`. `npx topogra` keeps working through the deprecated package.
3. Rename the repo on GitHub to `conorluddy/landcube` (Settings > General), then check Pages is served at `https://conorluddy.github.io/landcube/`.
4. Create the user-site repo `conorluddy/conorluddy.github.io` (none exists yet).
5. Copy `docs/pages-redirect/Topogra/index.html` and `docs/pages-redirect/Topogra/404.html` into its `Topogra/` directory, push, and enable Pages from the default branch.
6. Test: `https://conorluddy.github.io/Topogra/?v=1&seed=123#x` lands on `…/landcube/?v=1&seed=123#x`.

Both files forward the path remainder, `location.search` and `location.hash`; the meta refresh is the no-JavaScript fallback. `404.html` covers deep links that have no matching file.

## Host decision

Final host for now: `conorluddy.github.io/landcube/`. A `landcu.be` custom domain via `public/CNAME` is a follow-up; `browserBaseUrl` in `src/cli.ts`, the analytics hostname in `index.html` and README links would then change with it.
