# Profile assets

The README presents the approved portfolio identity, case studies and six groups of technology icons. Graphics are stored in `assets/` so they render directly on GitHub without external statistics services.

`npm ci --ignore-scripts` and `npm run generate` regenerate `assets/generated/`. Generation requires `GH_TOKEN`, reads the aggregate contribution calendar and the count of publicly owned non-fork repositories from GitHub's GraphQL API, and renders Tetris using `pacman-contribution-graph` 5.5.2. Tokens are never included in generated files. The calendar cannot include professional work in external private organizations that is unavailable to this account.

The workflow runs daily at 05:17 UTC, on relevant changes to `main`, and on manual dispatch. Generated-only commits do not trigger another run. If generation fails, the last committed graphics remain visible.

The desktop and mobile activity images contain the same statistics and animation. Their composition differs to preserve legibility on narrow screens.

The initial snapshot was verified on 16 November 2026 and contains 55 calendar contributions. The API subsequently returned an empty calendar. If GitHub returns zero after a previously populated snapshot, generation preserves the last verified graphics and their visible snapshot date. It does not reinterpret unavailable contributions as zero activity or change the account's privacy settings. The public aggregate source snapshot is saved alongside the graphics for reproducibility.

The Tetris engine is [Arcade Contribution Graph Games](https://github.com/abozanona/pacman-contribution-graph), also used by [Profile Readme Generator](https://github.com/maurodesouza/profile-readme-generator). Technology logos retain their existing providers and attribution through their URLs; Airtable's local SVG comes from Simple Icons.
