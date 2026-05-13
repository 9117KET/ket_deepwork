export default {
  providers: [
    {
      domain: process.env.SITE_URL ?? "http://localhost:5173",
      applicationID: "convex",
    },
  ],
}
