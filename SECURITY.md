# Security

Report security concerns privately to the repository owner.

## Secret handling

Private provider keys belong in GitHub Actions secrets only. The browser bundle may contain only public variables such as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, and `VITE_GITHUB_PAGES_BASE_PATH`.

Never commit:

- `.env` files
- Supabase service-role keys
- Market data provider keys
- Discord webhook URLs
- GitHub tokens
- Workflow logs containing credentials

Run `npm run security:secrets` before release. Rotate any key that may have been exposed.
