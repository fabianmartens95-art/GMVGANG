import { createHash } from 'node:crypto';

export function contentDigest(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function versionHtmlAssets(html, versions) {
  let output = html;
  for (const [assetPath, version] of Object.entries(versions)) {
    const versioned = assetPath + '?v=' + version;
    output = output
      .replaceAll('href="' + assetPath + '"', 'href="' + versioned + '"')
      .replaceAll("href='" + assetPath + "'", "href='" + versioned + "'")
      .replaceAll('src="' + assetPath + '"', 'src="' + versioned + '"')
      .replaceAll("src='" + assetPath + "'", "src='" + versioned + "'");
  }
  return output;
}

export function versionCssImports(css, versions) {
  let output = css;
  for (const [assetPath, version] of Object.entries(versions)) {
    const versioned = assetPath + '?v=' + version;
    output = output
      .replaceAll('url("' + assetPath + '")', 'url("' + versioned + '")')
      .replaceAll("url('" + assetPath + "')", "url('" + versioned + "')")
      .replaceAll('url(' + assetPath + ')', 'url(' + versioned + ')');
  }
  return output;
}
