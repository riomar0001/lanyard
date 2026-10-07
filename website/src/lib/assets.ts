// Which release file is which download. Shared by the build (to bake the
// links into the HTML) and the browser (to refresh them from GitHub).

export type AssetKey = 'windows' | 'macArm' | 'macIntel' | 'linux' | 'npm';

export const ASSET_PATTERNS: Record<AssetKey, RegExp> = {
  windows: /^Lanyard-Setup-.+-x64\.exe$/,
  macArm: /-arm64\.dmg$/,
  macIntel: /-x64\.dmg$/,
  linux: /\.AppImage$/,
  npm: /^lanyard-cli-.+\.tgz$/,
};

export interface GithubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
}

export interface ReleaseInfo {
  version: string;
  url: string;
  assets: Partial<Record<AssetKey, string>>;
}

export const RELEASES_API = 'https://api.github.com/repos/riomar0001/lanyard/releases?per_page=10';

/**
 * The newest published release, prereleases included. GitHub's
 * /releases/latest skips prereleases, so the list is read instead.
 */
export function pickRelease(list: GithubRelease[]): ReleaseInfo | null {
  const release = list.find((r) => !r.draft);
  if (!release) return null;
  const assets: Partial<Record<AssetKey, string>> = {};
  for (const [key, pattern] of Object.entries(ASSET_PATTERNS) as [AssetKey, RegExp][]) {
    const asset = release.assets.find((a) => pattern.test(a.name));
    if (asset) assets[key] = asset.browser_download_url;
  }
  return { version: release.tag_name.replace(/^v/, ''), url: release.html_url, assets };
}
