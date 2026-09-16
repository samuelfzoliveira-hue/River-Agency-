/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // A Central de Aprovação virou a página inicial ("/"); mantém o link antigo funcionando.
        source: "/aprovacao",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
