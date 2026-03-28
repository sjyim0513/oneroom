interface PlaceholderPageProps {
  title: string;
  eyebrow: string;
  description: string;
}

export function PlaceholderPage({
  title,
  eyebrow,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="flex h-full items-center justify-center p-6 md:p-10">
      <section className="grid w-full max-w-5xl gap-6 rounded-[28px] border border-[var(--panel-border)] bg-white/75 p-8 shadow-panel md:grid-cols-[1.2fr_0.8fr] md:p-10">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay-600">
            {eyebrow}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-900 md:text-5xl">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] md:text-lg">
            {description}
          </p>
        </div>

        <div className="rounded-[24px] border border-dashed border-ink-300 bg-[linear-gradient(160deg,rgba(255,255,255,0.8),rgba(231,218,192,0.6))] p-6">
          <p className="text-sm font-semibold text-ink-800">다음 단계</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
            <li>같은 장면 구조를 공유하는 재사용 가능한 자산 편집 흐름</li>
            <li>저장한 면과 가구를 조합하는 확장된 구성 도구</li>
            <li>더 정교한 제약 조건, 배치 규칙, 최종 보기 화면</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
