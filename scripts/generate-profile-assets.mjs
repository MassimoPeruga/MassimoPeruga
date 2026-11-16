import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TetrisRenderer } from 'pacman-contribution-graph';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'assets/generated');
const username = 'MassimoPeruga';

async function fetchSnapshot() {
  if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN is required to read the GitHub contribution calendar.');
  const query = `query ($login: String!) {
    user(login: $login) {
      contributionsCollection { contributionCalendar {
        totalContributions weeks { contributionDays { date contributionCount color contributionLevel } }
      } }
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, first: 1) { totalCount }
    }
  }`;
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: username } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub calendar request failed (${response.status}).`);
  const result = await response.json();
  if (result.errors?.length || !result.data?.user) throw new Error('GitHub did not return a valid profile snapshot.');
  return result;
}

const input = process.argv.indexOf('--input');
const snapshot = input >= 0
  ? JSON.parse(await fs.readFile(process.argv[input + 1], 'utf8'))
  : await fetchSnapshot();
const user = snapshot.data?.user;
const calendar = user?.contributionsCollection?.contributionCalendar;
const days = calendar?.weeks?.flatMap(week => week.contributionDays);
if (!days?.length || !Number.isInteger(calendar.totalContributions) || !Number.isInteger(user.repositories.totalCount)) {
  throw new Error('Incomplete profile data; existing generated assets have been preserved.');
}
if (input < 0 && calendar.totalContributions === 0) {
  let previous;
  try {
    previous = JSON.parse(await fs.readFile(path.join(destination, 'snapshot.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions > 0) {
    console.log(`GitHub currently returns an empty calendar. Preserving the verified snapshot from ${previous.capturedAt}.`);
    process.exit(0);
  }
}
const active = days.filter(day => day.contributionCount > 0).length;
const period = `${days[0].date} — ${days.at(-1).date}`;
const stamp = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date()).toUpperCase();

// Supply the already-fetched aggregate calendar to the renderer. No credentials
// are passed to the arcade library or embedded in its generated SVG.
const originalFetch = globalThis.fetch;
let tetris;
try {
  globalThis.fetch = async resource => {
    if (String(resource) !== 'https://api.github.com/graphql') throw new Error('Unexpected arcade data request.');
    return { ok: true, json: async () => snapshot };
  };
  await new TetrisRenderer({
    username, platform: 'github', gameTheme: 'github-dark', showMonthLabels: true,
    githubSettings: { accessToken: 'local-calendar-adapter' },
    svgCallback: svg => { tetris = svg; },
  }).start();
} finally {
  globalThis.fetch = originalFetch;
}
if (!tetris?.includes('<svg')) throw new Error('Tetris rendering failed; existing assets have been preserved.');
const palette = {
  '#0d1117': '#242321', '#161b22': '#34312c', '#0e4429': '#674434',
  '#006d32': '#a15c3c', '#26a641': '#cb794c', '#39d353': '#ef9463',
  '#8b949e': '#b6b1a8', '#ffffff': '#f2ede3', '#aaaaaa': '#ef9463',
};
for (const [before, after] of Object.entries(palette)) tetris = tetris.replaceAll(before, after);
const width = Number(tetris.match(/<svg[^>]*\bwidth="([\d.]+)"/)?.[1]);
const height = Number(tetris.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1]);
if (!width || !height) throw new Error('Invalid Tetris SVG dimensions.');
if (!/<svg[^>]*\bviewBox=/.test(tetris)) tetris = tetris.replace('<svg ', `<svg viewBox="0 0 ${width} ${height}" `);

function buildActivity(mobile = false) {
  const w = mobile ? 480 : 1000;
  const inset = mobile ? 28 : 32;
  const statsHeight = mobile ? 310 : 190;
  const gameWidth = w - inset * 2;
  const gameHeight = gameWidth * height / width;
  const gameY = statsHeight + 48;
  const bottom = gameY + gameHeight + 44;
  const nestedGame = tetris.replace(/<svg\b[^>]*>/, `<svg x="${inset}" y="${gameY}" width="${gameWidth}" height="${gameHeight}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`);
  const metrics = [
    [user.repositories.totalCount, 'Public original repositories'],
    [calendar.totalContributions, 'Calendar contributions'],
    [active, 'Active days'],
  ];
  const labels = metrics.map(([value, label], index) => mobile
    ? `<text x="28" y="${66 + index * 78}" font-size="42" font-weight="700">${value}</text><text x="128" y="${57 + index * 78}" font-size="18">${label}</text>`
    : `<text x="${32 + index * 333}" y="59" font-size="49" font-weight="700">${value}</text><text x="${32 + index * 333}" y="91" font-size="17">${label}</text>`).join('');
  const statsFooter = mobile
    ? `<path d="M28 250H452" stroke="#ffffff33"/><text x="28" y="283" font-size="16" fill="#ef9463">SNAPSHOT · ${stamp}</text>`
    : `<path d="M32 120H968" stroke="#ffffff33"/><text x="32" y="154" font-size="14" fill="#b6b1a8">Activity period: ${period} · Repository count: current snapshot</text><text x="968" y="154" text-anchor="end" font-size="14" fill="#ef9463">${stamp}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${bottom}" viewBox="0 0 ${w} ${bottom}" role="img" aria-label="GitHub activity and Tetris contribution animation"><title>GitHub activity and Tetris</title><desc>${user.repositories.totalCount} public original repositories; ${calendar.totalContributions} calendar contributions; ${active} active days. Calendar period ${period}. Snapshot ${stamp}.</desc><rect width="100%" height="100%" fill="#242321"/><g font-family="Arial,Helvetica,sans-serif" fill="#f2ede3">${labels}${statsFooter}<text x="${inset}" y="${statsHeight + 22}" font-size="${mobile ? 18 : 17}" font-weight="700">MP<tspan fill="#ef9463">.</tspan> / TETRIS</text>${mobile ? '' : `<text x="${w - inset}" y="${statsHeight + 22}" text-anchor="end" font-size="13">THE CONTRIBUTION EDITION</text>`}<path d="M${inset} ${bottom - 28}H${w - inset}" stroke="#ffffff33"/><text x="${inset}" y="${bottom - 9}" fill="#b6b1a8" font-size="${mobile ? 13 : 12}">Your contribution calendar, in play.</text></g>${nestedGame}</svg>\n`;
}

await fs.mkdir(destination, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(destination, 'tetris.svg'), tetris + '\n'),
  fs.writeFile(path.join(destination, 'activity.svg'), buildActivity()),
  fs.writeFile(path.join(destination, 'activity-mobile.svg'), buildActivity(true)),
  fs.writeFile(path.join(destination, 'snapshot.json'), JSON.stringify({
    capturedAt: new Date().toISOString().slice(0, 10),
    data: { user: {
      contributionsCollection: { contributionCalendar: calendar },
      repositories: { totalCount: user.repositories.totalCount },
    } },
  }, null, 2) + '\n'),
]);
console.log('Updated the aggregate GitHub statistics and Tetris SVGs.');
