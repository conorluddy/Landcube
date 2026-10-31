# Pages redirect kit

Keeps old `https://conorluddy.github.io/Topogra/?…` design links working after the repo rename to `landcube`.

## Why this is needed

The site is served at `https://landcu.be/` (custom domain on the repo's Pages settings). Before the rename, GitHub 301-redirected `conorluddy.github.io/Topogra/…` to `landcu.be`. That redirect is keyed on the repo name, so after the rename every old `conorluddy.github.io/Topogra/…` link returns 404. Do not create a new repo named `Topogra`: it ends the git redirects.

## Manual steps (in order)

1. Merge the release PR; confirm `https://landcu.be/` serves the new build.
2. Stage the user-site repo `conorluddy/conorluddy.github.io` (it exists: private, 2017 content, Pages off) with `Topogra/index.html` from this kit. It must be public, or on a plan that allows Pages for private repos.
3. Rename the repo to `conorluddy/landcube` (Settings > General), then immediately enable Pages on the user-site repo from its default branch.
4. Test: `https://conorluddy.github.io/Topogra/?v=1&seed=123#x` lands on `https://landcu.be/?v=1&seed=123#x`, and `https://landcu.be/` still serves (the custom domain moves with the repo).
5. `npm publish` (first `landcube` release, 0.3.0), then `npm deprecate topogra "Renamed to landcube"`. `npx topogra` keeps working through the deprecated package.

`index.html` forwards the path remainder, `location.search` and `location.hash`; the meta refresh is the no-JavaScript fallback and drops the query, so v1 design links depend on JavaScript. There is no `404.html`: GitHub Pages only serves a 404 page from the site root, and shared links all target `/Topogra/?…`.
