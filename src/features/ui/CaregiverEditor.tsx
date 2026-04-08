import { useRef, type ChangeEvent } from "react";
import type { CareManual } from "../manual/manualSchema";
import { caregiverSectionContent } from "../manual/manualSections";
import { parseManualBackup, serializeManualBackup } from "../storage/manualBackup";
import { SectionCard } from "./SectionCard";

interface CaregiverEditorProps {
  manual: CareManual;
  onChange: (manual: CareManual) => void;
  onSave: (manual: CareManual) => void;
  onImport: (manual: CareManual) => void;
}

function cloneManual(manual: CareManual): CareManual {
  return structuredClone(manual);
}

export function CaregiverEditor({ manual, onChange, onSave, onImport }: CaregiverEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const patchManual = (update: (draft: CareManual) => void) => {
    const nextManual = cloneManual(manual);
    update(nextManual);
    onChange(nextManual);
  };

  const handleSubjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.subject.name = event.target.value;
    });
  };

  const handleMorningRoutineChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.sections.daily_routine.morning = event.target.value
        ? [
            {
              title: event.target.value,
              notes: `${event.target.value} 전에 차분히 준비한다.`
            }
          ]
        : [];
    });
  };

  const handleMedicationChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.sections.medication.drugs = event.target.value
        ? [
            {
              name: event.target.value,
              dosage: draft.sections.medication.drugs[0]?.dosage || "1정",
              timing: draft.sections.medication.drugs[0]?.timing || "08:30",
              method: draft.sections.medication.drugs[0]?.method || "물과 함께",
              warnings: "",
              photo: ""
            }
          ]
        : [];
    });
  };

  const handleMedicationTimingChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      if (!draft.sections.medication.drugs[0]) {
        draft.sections.medication.drugs = [
          {
            name: "",
            dosage: "1정",
            timing: event.target.value,
            method: "물과 함께",
            warnings: "",
            photo: ""
          }
        ];
        return;
      }

      draft.sections.medication.drugs[0].timing = event.target.value;
    });
  };

  const handleCalmingChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.sections.communication.calming_methods = event.target.value
        ? [event.target.value]
        : [];
    });
  };

  const handleSafeSpaceChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.sections.emotional.safe_spaces = event.target.value ? [event.target.value] : [];
    });
  };

  const handleEmergencyContactChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.subject.emergency_contacts = event.target.value ? [event.target.value] : [];
    });
  };

  const handleRelayTargetNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      draft.relay_targets = event.target.value
        ? [
            {
              name: event.target.value,
              relation: draft.relay_targets[0]?.relation || "가족",
              contact: draft.relay_targets[0]?.contact || "",
              priority: 1
            }
          ]
        : [];
    });
  };

  const handleRelayTargetContactChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchManual((draft) => {
      if (!draft.relay_targets[0]) {
        draft.relay_targets = [
          {
            name: "",
            relation: "가족",
            contact: event.target.value,
            priority: 1
          }
        ];
        return;
      }

      draft.relay_targets[0].contact = event.target.value;
    });
  };

  const handleBackupExport = async () => {
    const passphrase = window.prompt("백업 암호를 입력하세요");
    if (!passphrase) {
      return;
    }

    const serialized = await serializeManualBackup(manual, passphrase);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "careguardian-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const passphrase = window.prompt("백업 암호를 입력하세요");
    if (!passphrase) {
      return;
    }

    const importedManual = await parseManualBackup(await file.text(), passphrase);
    onImport(importedManual);
    event.target.value = "";
  };

  return (
    <div className="grid gap-5">
      <div className="rounded-[32px] bg-ink px-6 py-8 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/55">Caregiver Mode</p>
            <h1 className="mt-3 text-3xl font-semibold">돌봄 매뉴얼 첫 기록</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
              남겨야 할 건 거창한 지식이 아니라, 실제로 통하는 생활 습관입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              백업 불러오기
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void handleBackupExport()}
            >
              암호화 백업 저장
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => void handleBackupImport(event)}
        />
      </div>

      <SectionCard
        title={caregiverSectionContent[0].title}
        description={caregiverSectionContent[0].description}
      >
        <label className="grid gap-2 text-sm font-medium text-ink">
          피돌봄자 이름
          <input
            aria-label="피돌봄자 이름"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.subject.name}
            onChange={handleSubjectNameChange}
            placeholder="예: 수호"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          아침 루틴
          <input
            aria-label="아침 루틴"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.sections.daily_routine.morning[0]?.title ?? ""}
            onChange={handleMorningRoutineChange}
            placeholder="예: 아침 식사"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          긴급 연락처
          <input
            aria-label="긴급 연락처"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.subject.emergency_contacts[0] ?? ""}
            onChange={handleEmergencyContactChange}
            placeholder="예: 이모 010-0000-0000"
          />
        </label>
      </SectionCard>

      <SectionCard
        title={caregiverSectionContent[1].title}
        description={caregiverSectionContent[1].description}
      >
        <label className="grid gap-2 text-sm font-medium text-ink">
          복약 이름
          <input
            aria-label="복약 이름"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.sections.medication.drugs[0]?.name ?? ""}
            onChange={handleMedicationChange}
            placeholder="예: 빨간 알약"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          복약 시각
          <input
            aria-label="복약 시각"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.sections.medication.drugs[0]?.timing ?? ""}
            onChange={handleMedicationTimingChange}
            placeholder="예: 08:30"
          />
        </label>
      </SectionCard>

      <SectionCard
        title={caregiverSectionContent[2].title}
        description={caregiverSectionContent[2].description}
      >
        <label className="grid gap-2 text-sm font-medium text-ink">
          안정화 방법
          <input
            aria-label="안정화 방법"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.sections.communication.calming_methods[0] ?? ""}
            onChange={handleCalmingChange}
            placeholder="예: 조용한 목소리"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          안전 공간
          <input
            aria-label="안전 공간"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.sections.emotional.safe_spaces[0] ?? ""}
            onChange={handleSafeSpaceChange}
            placeholder="예: 거실 소파"
          />
        </label>
      </SectionCard>

      <SectionCard
        title={caregiverSectionContent[3].title}
        description={caregiverSectionContent[3].description}
      >
        <label className="grid gap-2 text-sm font-medium text-ink">
          1차 릴레이 대상
          <input
            aria-label="1차 릴레이 대상"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.relay_targets[0]?.name ?? ""}
            onChange={handleRelayTargetNameChange}
            placeholder="예: 이모"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          릴레이 연락처
          <input
            aria-label="릴레이 연락처"
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 outline-none transition focus:border-sage"
            value={manual.relay_targets[0]?.contact ?? ""}
            onChange={handleRelayTargetContactChange}
            placeholder="예: 010-0000-0000"
          />
        </label>
      </SectionCard>

      <button
        type="button"
        className="rounded-full bg-clay px-6 py-4 text-base font-semibold text-white transition hover:brightness-95"
        onClick={() => onSave(manual)}
      >
        저장하고 동반자 보기
      </button>
    </div>
  );
}
