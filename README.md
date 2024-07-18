# Ghost
Team based alt accounts.
https://anonymous.fly.dev

*inspired by [@matthew](https://warpcast.com/matthew) and the late night crew*

## Summary
- Built with [Remix](https://remix.run) and [prisma](https://prisma.io).
- If you want to read code, start with the [Data Model](https://github.com/jtgi/ghost/blob/main/prisma/schema.prisma), then read business logic in [Route Files](https://github.com/jtgi/ghost/tree/main/app/routes).
- Signer keys for the ghost accounts are managed by Neynar, ghost only stores an unique id, together with the neynar api key casts can be authored.
- Hosted on fly.io with sqlite for storage.

## Local Dev
```sh
pnpm install
pnpm dev
```

## Deployment
- Any commit to `main` triggers a deploy.

## Contributing
- Pull requests encouraged
- Since this deals with signers all requests will be reviewed by [@jtgi](https://warpcast.com/jtgi).

