/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile images
      'graph.microsoft.com',       // Microsoft profile images
      'appleid.cdn-apple.com',     // Apple profile images
    ],
  },
}

module.exports = nextConfig
