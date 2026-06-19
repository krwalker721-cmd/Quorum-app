import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Pin the API version this code was written against. Cast because the installed
  // SDK's types only allow its own newer default literal, but pinning an older
  // version is supported at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2024-06-20' as any,
  typescript: true,
})
