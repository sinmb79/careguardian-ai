import { useMemo, useState } from "react";
import type { CareManual } from "../manual/manualSchema";
import { generateCompanionReply } from "../companion/companionEngine";
import { buildDailyScheduleCards } from "../companion/dailySchedule";
import { buildMedicationTimeline } from "../reminders/medicationReminders";
import { buildRelayPackage } from "../relay/relayPackage";
import { createWebSpeechController } from "../voice/webSpeech";

interface CompanionHomeProps {
  manual: CareManual;
  onBack: () => void;
}

export function CompanionHome({ manual, onBack }: CompanionHomeProps) {
  const [message, setMessage] = useState("오늘 뭐 해?");
  const scheduleCards = useMemo(() => buildDailyScheduleCards(manual), [manual]);
  const medicationTimeline = useMemo(
    () => buildMedicationTimeline(manual, new Date()),
    [manual]
  );
  const relayPackage = useMemo(() => buildRelayPackage(manual), [manual]);
  const speechController = useMemo(() => createWebSpeechController(), []);
  const reply = useMemo(
    () =>
      generateCompanionReply({
        manual,
        message
      }),
    [manual, message]
  );

  const downloadRelayPackage = () => {
    const payload = JSON.stringify(relayPackage, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "care-relay-package.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-sage to-ink px-6 py-8 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Companion Mode</p>
            <h1 className="mt-3 text-3xl font-semibold">오늘의 돌봄 동반자</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
              {manual.subject.name || "이름 없는 사용자"}를 위한 하루 흐름과 진정 메모가 준비되어 있습니다.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/90"
            onClick={onBack}
          >
            보호자 편집으로
          </button>
        </div>
      </div>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <h2 className="text-xl font-semibold text-ink">오늘 일정 카드</h2>
        <ul className="mt-4 grid gap-3">
          {scheduleCards.map((card) => (
            <li
              key={card.id}
              className="rounded-2xl bg-oat px-4 py-4 text-sm leading-6 text-ink"
            >
              <div className="font-semibold">{card.title}</div>
              <div className="text-ink/70">{card.description}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <h2 className="text-xl font-semibold text-ink">복약 타임라인</h2>
        <ul className="mt-4 grid gap-3">
          {medicationTimeline.length === 0 ? (
            <li className="rounded-2xl bg-oat px-4 py-4 text-sm text-ink/70">
              아직 등록된 복약이 없습니다.
            </li>
          ) : (
            medicationTimeline.map((reminder) => (
              <li key={reminder.id} className="rounded-2xl bg-oat px-4 py-4 text-sm text-ink">
                <div className="font-semibold">{reminder.label}</div>
                <div className="mt-1 text-ink/70">{reminder.detail}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-sage">
                  {reminder.status === "overdue" ? "지남" : "예정"}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">릴레이 준비도</h2>
          <button
            type="button"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
            onClick={downloadRelayPackage}
          >
            릴레이 패키지 저장
          </button>
        </div>
        <div className="mt-4 rounded-2xl bg-oat px-4 py-4">
          <div className="text-3xl font-semibold text-ink">{relayPackage.readinessScore}%</div>
          <div className="mt-1 text-sm text-ink/70">{relayPackage.summary}</div>
        </div>
        <ul className="mt-4 grid gap-3">
          {relayPackage.keyActions.map((action, index) => (
            <li key={index} className="rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink">
              {action}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">말벗 응답</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              onClick={() => speechController.startListening((transcript) => setMessage(transcript))}
              disabled={!speechController.capabilities.canListen}
            >
              듣고 입력
            </button>
            <button
              type="button"
              className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              onClick={() => speechController.speak(reply.reply)}
              disabled={!speechController.capabilities.canSpeak}
            >
              음성으로 읽기
            </button>
          </div>
        </div>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          지금 무엇이 필요해?
          <input
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className="mt-4 rounded-2xl bg-sand px-4 py-4 text-sm leading-7 text-ink">
          {reply.reply}
        </div>
      </section>
    </div>
  );
}
