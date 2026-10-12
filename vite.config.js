import { defineConfig } from 'vite';

// Relative asset paths, so the built site works from any folder on a domain
// (for example /playground/flower-bouquet/).
export default defineConfig({ base: './' });
