# Bundled IBM Plex fonts

IBM Plex Sans variable (normal, weights 400–700) and IBM Plex Mono Regular/Medium/SemiBold preserve the application's existing families and requested weights. Next.js loads these committed files with next/font/local; builds and browsers need no Google font requests.

The files are unmodified assets from the official [Google Fonts repository](https://github.com/google/fonts). sources.json records each upstream path and immutable Git blob hash. OFL.txt contains the upstream SIL Open Font License. Run `node scripts/verify-local-font-assets.mjs` from the repository root to verify exact bytes.

Update fonts only as a reviewed asset change with matching source hashes/licence. Do not regenerate source provenance from a different font file.
