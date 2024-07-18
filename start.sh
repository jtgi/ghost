#!/bin/sh -ex

pnpm exec prisma migrate resolve --rolled-back 20240718094118_add_authorid
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start