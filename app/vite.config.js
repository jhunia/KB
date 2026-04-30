import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        cart: resolve(__dirname, 'cart.html'),
        category: resolve(__dirname, 'category.html'),
        product: resolve(__dirname, 'product.html'),
        profile: resolve(__dirname, 'profile.html'),
        coming_soon: resolve(__dirname, 'coming-soon.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        admin_login: resolve(__dirname, 'admin/login.html')
      }
    }
  }
});
