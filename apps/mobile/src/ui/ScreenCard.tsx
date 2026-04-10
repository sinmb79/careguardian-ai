import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

interface ScreenCardProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function ScreenCard({ title, description, children }: ScreenCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1b2c31"
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5d6c70"
  },
  body: {
    gap: 12
  }
});
