# Security

Report security concerns privately to the repository owner.

## Secret handling

Private provider keys belong in Vercel environment variables or trusted GitHub Action secrets only. The browser bundle may contain only public variables such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL`.

Never commit:

- `.env` files
- Supabase service-role keys
- Market data provider keys
- Discord webhook URLs
- GitHub tokens
- Workflow logs containing credentials

Run `pnpm run security:secrets` before release. Rotate any key that may have been exposed.
