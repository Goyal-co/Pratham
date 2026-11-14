import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import {
  DEFAULT_CUTOFFS,
  MEAL_LABELS,
  getZonedParts,
  type FixedPlan,
  type MealType,
} from "@pratham/shared";
import { Button, Card, Field, Loader, Muted, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function PlansScreen() {
  const [plans, setPlans] = useState<FixedPlan[]>([]);
  const [cancelDate, setCancelDate] = useState(getZonedParts().dateStr);
  const [loading, setLoading] = useState(true);
  const [cutoffs, setCutoffs] = useState(DEFAULT_CUTOFFS);

  const load = useCallback(async () => {
    const [planData, settings] = await Promise.all([
      api<{ plans: FixedPlan[] }>("/plans"),
      api<{ settings: Record<string, string> }>("/settings"),
    ]);
    setPlans(planData.plans ?? []);
    if (settings.settings) {
      setCutoffs({
        breakfast: settings.settings.breakfast_cutoff,
        lunch: settings.settings.lunch_cutoff,
        dinner: settings.settings.dinner_cutoff,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Title>Fixed plans</Title>
      <Muted>
        Apply everyday meals. Skip a date only before order acceptance closes (IST):
        Breakfast {cutoffs.breakfast} · Lunch {cutoffs.lunch} · Dinner {cutoffs.dinner}
        — set by admin.
      </Muted>

      <Card>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Active plans</Text>
        {plans.length === 0 && <Muted>None yet — apply below.</Muted>}
        {plans.map((p) => (
          <Text key={p.id} style={{ marginBottom: 4, textTransform: "capitalize" }}>
            Everyday {p.meal_type}
          </Text>
        ))}
      </Card>

      {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => (
        <Card key={meal}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>
            {MEAL_LABELS[meal]}
          </Text>
          <Button
            title={`Apply everyday ${MEAL_LABELS[meal]}`}
            onPress={async () => {
              try {
                await api("/plans", {
                  method: "POST",
                  json: { meal_type: meal },
                });
                Alert.alert("Plan active", `Everyday ${MEAL_LABELS[meal]} enabled.`);
                await load();
              } catch (e) {
                Alert.alert("Failed", e instanceof Error ? e.message : "Error");
              }
            }}
          />
          <View style={{ height: 10 }} />
          <Button
            title={`Stop ${MEAL_LABELS[meal]} plan`}
            variant="danger"
            onPress={async () => {
              try {
                await api(`/plans?meal_type=${meal}`, { method: "DELETE" });
                await load();
              } catch (e) {
                Alert.alert("Failed", e instanceof Error ? e.message : "Error");
              }
            }}
          />
          <View style={{ height: 10 }} />
          <Field
            label="Cancel date (YYYY-MM-DD)"
            value={cancelDate}
            onChangeText={setCancelDate}
          />
          <Button
            title={`Skip ${MEAL_LABELS[meal]} for date`}
            variant="secondary"
            onPress={async () => {
              try {
                await api("/plans/cancel-day", {
                  method: "POST",
                  json: { meal_type: meal, cancel_date: cancelDate },
                });
                Alert.alert("Cancelled", `${MEAL_LABELS[meal]} skipped for ${cancelDate}`);
              } catch (e) {
                Alert.alert("Failed", e instanceof Error ? e.message : "Error");
              }
            }}
          />
        </Card>
      ))}
    </ScrollView>
  );
}
