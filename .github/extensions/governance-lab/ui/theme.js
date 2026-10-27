// Primer's tokens only resolve under a recognised [data-color-mode] /
// [data-light-theme] / [data-dark-theme] triple. The host mirrors its own
// theme attributes onto the document root, but its theme names are not
// guaranteed to match Primer's, so pin known-good names on <body> and
// follow the host's light/dark tone.
export const PRIMER_THEMES = new Set([
  'light', 'light_colorblind', 'light_high_contrast', 'light_tritanopia',
  'dark', 'dark_dimmed', 'dark_colorblind', 'dark_high_contrast', 'dark_tritanopia'
]);

export function syncTheme(root, body) {
  const tone = root.getAttribute('data-theme-tone');
  const mode = root.getAttribute('data-color-mode');
  if (tone === 'dark' || tone === 'light') body.setAttribute('data-color-mode', tone);
  else if (mode === 'dark' || mode === 'light') body.setAttribute('data-color-mode', mode);
  else body.setAttribute('data-color-mode', 'auto');

  const light = root.getAttribute('data-light-theme');
  const dark = root.getAttribute('data-dark-theme');
  body.setAttribute('data-light-theme', PRIMER_THEMES.has(light) ? light : 'light');
  body.setAttribute('data-dark-theme', PRIMER_THEMES.has(dark) ? dark : 'dark');
}

export function watchTheme(document) {
  const update = () => syncTheme(document.documentElement, document.body);
  update();
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-color-mode', 'data-light-theme', 'data-dark-theme', 'data-theme-tone']
  });
}
