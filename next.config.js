/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // أي مستضيف https — يغطي شعارات المدارس من أي مصدر
      { protocol: "https", hostname: "**" },
    ],
  },
}

module.exports = nextConfig