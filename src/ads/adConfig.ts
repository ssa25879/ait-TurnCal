/** 토스 애즈 배너(리스트형) 테스트 ID. 개발·테스트 번들에서는 이 ID만 쓴다. */
export const TEST_BANNER_AD_GROUP_ID = "ait-ad-test-banner-id";

/**
 * 배너 광고 그룹 ID를 정한다. 빌드 설정 값이 있으면 그 값, 없으면 fallback.
 * fallback은 개발 서버에서만 테스트 ID이고 출시 빌드에서는 null(배너 미표시)이다.
 */
export function resolveBannerAdGroupId({
  envValue,
  fallback,
}: {
  envValue: string | undefined;
  fallback: string | null;
}): string | null {
  const value = envValue?.trim();
  return value ? value : fallback;
}

/**
 * 실제 ID는 .env.production.local(커밋하지 않음)로만 주입해 테스트에 실제 ID가 섞이지 않게 한다.
 * 테스트 ID는 개발 분기에서만 참조해 출시 빌드 산출물에서 제거되게 한다.
 */
export const BANNER_AD_GROUP_ID = resolveBannerAdGroupId({
  envValue: import.meta.env.VITE_TOSS_BANNER_AD_GROUP_ID,
  fallback: import.meta.env.DEV ? TEST_BANNER_AD_GROUP_ID : null,
});
