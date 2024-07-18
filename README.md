# Ghost
Team based alt accounts.
https://anonymous.fly.dev

[inspired by @matthew]

## Summary
- This is [Remix](https://remix.run) project; most business logic is in `/app/routes`.
- The data model is a good place to start /prisma/schema.prisma
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

