import { useMemo, useState } from "react";
import type { CareManual } from "@careguardian/care-core/manual";
import {
  buildDailyScheduleCards,
  generateCompanionReply,
  getTimeOfDayGreeting,
  getEmotionOptions
} from "@careguardian/care-core/companion";
import { buildMedicationTimeline } from "@careguardian/care-core/reminders";
import { buildRelayPackage } from "@careguardian/care-core/relay";
import { createWebSpeechController } from "../voice/webSpeech";

interface CompanionHomeProps {
  manual: CareManual;
  onBack: () => void;
}

export function CompanionHome({ manual, onBack }: CompanionHomeProps) {
  const [message, setMessage] = useState("\uC624\uB298 \uBB50 \uD574?");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
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
  const greeting = useMemo(
    () => getTimeOfDayGreeting(manual.subject.name || "\uC0AC\uC6A9\uC790"),
    [manual.subject.name]
  );
  const emotionOptions = useMemo(() => getEmotionOptions(), []);

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
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-sage to-ink px-6 py-8 text-white shadow-card sm:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base uppercase tracking-[0.2em] text-white/70">Companion Mode</p>
            <h1 className="mt-3 text-4xl font-bold">{greeting}</h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-white/85">
              오늘 하루도 함께해요. 일정, 복약, 마음 점검이 준비되어 있습니다.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/30 px-5 py-3 text-base font-medium text-white/90"
            onClick={onBack}
          >
            보호자 편집으로
          </button>
        </div>
      </div>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5 sm:col-span-2">
        <h2 className="text-2xl font-semibold text-ink">오늘 기분은 어때요?</h2>
        <p className="mt-2 text-base text-ink/70">느끼는 대로 하나 골라 주세요.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {emotionOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex min-h-[56px] min-w-[80px] flex-col items-center gap-1 rounded-2xl px-4 py-3 text-center transition ${
                selectedEmotion === opt.value
                  ? "bg-sage/20 ring-2 ring-sage"
                  : "bg-oat hover:bg-sage/10"
              }`}
              onClick={() => setSelectedEmotion(opt.value)}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <span className="text-sm font-medium text-ink">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <h2 className="text-2xl font-semibold text-ink">오늘 일정 카드</h2>
        <ul className="mt-4 grid gap-3">
          {scheduleCards.map((card) => (
            <li
              key={card.id}
              className="rounded-2xl bg-oat px-4 py-4 text-base leading-7 text-ink"
            >
              <div className="font-semibold">{card.title}</div>
              <div className="text-ink/70">{card.description}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <h2 className="text-2xl font-semibold text-ink">복약 타임라인</h2>
        <ul className="mt-4 grid gap-3">
          {medicationTimeline.length === 0 ? (
            <li className="rounded-2xl bg-oat px-4 py-4 text-base text-ink/60">
              아직 등록된 복약이 없습니다. 보호자 편집에서 약 정보를 추가해 주세요. 💊
            </li>
          ) : (
            medicationTimeline.map((reminder) => (
              <li key={reminder.id} className="rounded-2xl bg-oat px-4 py-4 text-base text-ink">
                <div className="font-semibold">{reminder.label}</div>
                <div className="mt-1 text-ink/70">{reminder.detail}</div>
                <div className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-sage">
                  {reminder.status === "overdue" ? "지남" : "예정"}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-ink">릴레이 준비도</h2>
          <button
            type="button"
            className="rounded-full bg-ink px-5 py-3 text-base font-medium text-white"
            onClick={downloadRelayPackage}
          >
            릴레이 패키지 저장
          </button>
        </div>
        <div className="mt-4 rounded-2xl bg-oat px-4 py-4">
          <div className="text-4xl font-bold text-ink">{relayPackage.readinessScore}%</div>
          <div className="mt-1 text-base text-ink/70">{relayPackage.summary}</div>
        </div>
        <ul className="mt-4 grid gap-3">
          {relayPackage.keyActions.map((action, index) => (
            <li key={index} className="rounded-2xl border-2 border-ink/10 px-4 py-3 text-base text-ink">
              {action}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-ink">말벗 응답</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border-2 border-ink/10 px-5 py-3 text-base font-medium text-ink disabled:opacity-40"
              onClick={() => speechController.startListening((transcript) => setMessage(transcript))}
              disabled={!speechController.capabilities.canListen}
            >
              듣고 입력
            </button>
            <button
              type="button"
              className="rounded-full border-2 border-ink/10 px-5 py-3 text-base font-medium text-ink disabled:opacity-40"
              onClick={() => speechController.speak(reply.reply)}
              disabled={!speechController.capabilities.canSpeak}
            >
              음성으로 읽기
            </button>
          </div>
        </div>
        <label className="mt-4 grid gap-3 text-base font-semibold text-ink">
          지금 무엇이 필요해?
          <input
            className="rounded-2xl border-2 border-ink/10 bg-sand px-5 py-4 text-lg outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/30"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className="mt-4 rounded-2xl bg-sand px-5 py-5 text-lg leading-8 text-ink">
          {reply.reply}
        </div>
      </section>
    </div>
  );
}
