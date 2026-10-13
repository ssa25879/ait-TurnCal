/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 토스 애즈 배너 광고 그룹 ID. 없으면 개발 서버만 테스트 ID를 쓴다. */
  readonly VITE_TOSS_BANNER_AD_GROUP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
