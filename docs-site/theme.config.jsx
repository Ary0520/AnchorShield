export default {
  logo: <strong>AnchorShield Docs</strong>,
  project: {
    link: 'https://github.com/anchorshield',
  },
  docsRepositoryBase: 'https://github.com/anchorshield',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – AnchorShield'
    }
  },
  footer: {
    text: 'AnchorShield Protocol \u00A9 2026',
  },
  primaryHue: 165,
  primarySaturation: 100,
}
