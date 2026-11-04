/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The newsletter is members-only. Old public URLs go to the members area,
  // which middleware sends to the login page when signed out.
  async redirects() {
    return [
      { source: "/newsletter", destination: "/members/newsletter", permanent: false },
      { source: "/newsletter/:slug", destination: "/members/newsletter/:slug", permanent: false },
      // Company Research now lives on TrenchTick.
      { source: "/members/research", destination: "https://finance-dnrapp.vercel.app", permanent: false },
      { source: "/members/research/:path*", destination: "https://finance-dnrapp.vercel.app", permanent: false },
    ];
  },
  experimental: {
    // lib/newsletter-public.ts reads these JSON files at request time on the
    // dynamic members and admin pages, so ship them with those functions.
    outputFileTracingIncludes: {
      "/members": ["./content/newsletter/**"],
      "/members/newsletter": ["./content/newsletter/**"],
      "/members/newsletter/[slug]": ["./content/newsletter/**"],
      "/admin": ["./content/newsletter/**"],
    },
  },
};

export default nextConfig;
