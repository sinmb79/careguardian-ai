export interface CareRoutineItem {
  title: string;
  notes: string;
}

export interface MedicationItem {
  name: string;
  dosage: string;
  timing: string;
  method: string;
  warnings: string;
  photo: string;
}

export interface CareSignal {
  behavior: string;
  meaning: string;
  response: string;
}

export interface RelayTarget {
  name: string;
  relation: string;
  contact: string;
  priority: number;
}

export interface CareManual {
  care_manual_version: string;
  subject: {
    name: string;
    birth_date: string;
    disability_type: string;
    medical_conditions: string[];
    emergency_contacts: string[];
  };
  sections: {
    daily_routine: {
      morning: CareRoutineItem[];
      afternoon: CareRoutineItem[];
      evening: CareRoutineItem[];
      night: CareRoutineItem[];
    };
    medication: {
      drugs: MedicationItem[];
    };
    eating: {
      preferences: string[];
      allergies: string[];
      feeding_method: string;
      special_notes: string;
    };
    communication: {
      verbal_ability: string;
      signals: CareSignal[];
      calming_methods: string[];
    };
    emotional: {
      triggers_anxiety: string[];
      triggers_joy: string[];
      calming_objects: string[];
      safe_spaces: string[];
    };
    personal_notes: string;
  };
  created_by: string;
  created_at: string;
  last_updated: string;
  relay_targets: RelayTarget[];
}

export function createEmptyCareManual(): CareManual {
  return {
    care_manual_version: "1.0",
    subject: {
      name: "",
      birth_date: "",
      disability_type: "",
      medical_conditions: [],
      emergency_contacts: []
    },
    sections: {
      daily_routine: {
        morning: [],
        afternoon: [],
        evening: [],
        night: []
      },
      medication: {
        drugs: []
      },
      eating: {
        preferences: [],
        allergies: [],
        feeding_method: "",
        special_notes: ""
      },
      communication: {
        verbal_ability: "",
        signals: [],
        calming_methods: []
      },
      emotional: {
        triggers_anxiety: [],
        triggers_joy: [],
        calming_objects: [],
        safe_spaces: []
      },
      personal_notes: ""
    },
    created_by: "",
    created_at: "",
    last_updated: "",
    relay_targets: []
  };
}
