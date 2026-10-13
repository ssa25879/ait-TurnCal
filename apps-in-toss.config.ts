import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ait-turncal',
  brand: {
    primaryColor: '#3182F6', // 턴캘 대표 색상(토스 블루) 확정
  },
  permissions: [],
  webBundleDir: 'dist',
});
