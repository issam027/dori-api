// Vercel only discovers serverless functions located under /api.
// Keep the Nest bootstrap in src/main.ts so local and traditional hosting
// continue to share exactly the same application entry point.
export { default } from '../src/main';
