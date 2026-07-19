import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

interface ScreenCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  icon?: string;
  step?: number;
  totalSteps?: number;
  style?: StyleProp<ViewStyle>;
}

export function ScreenCard({ title, description, icon, step, totalSteps, style, children }: ScreenCardProps) {
  return (
    <View style={[styles.card, style]}>
      {step !== undefined && totalSteps !== undefined && (
        <View style={styles.stepRow}>
          <Text style={styles.stepLabel}>{step} / {totalSteps}</Text>
          <View style={styles.stepBarBg}>
            <View style={[styles.stepBarFill, { width: `${(step / totalSteps) * 100}%` }]} />
          </View>
        </View>
      )}
      <Text style={styles.title}>
        {icon ? `${icon}  ${title}` : title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: "#fffdf8",
    padding: 20,
    gap: 12,
    shadowColor: "#0e1c1f",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 4
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6f8a70"
  },
  stepBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(31, 42, 42, 0.06)"
  },
  stepBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6f8a70"
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a2626"
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#5d6c70"
  },
  body: {
    gap: 12
  }
});
