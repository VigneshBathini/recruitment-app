import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const stages = [
  {
    number: '01',
    title: 'Define the hiring need',
    description: 'Capture the role, team, and headcount requirements.',
  },
  {
    number: '02',
    title: 'Prepare the job description',
    description: 'Align responsibilities and qualifications with the hiring team.',
  },
  {
    number: '03',
    title: 'Review and approve',
    description: 'Route the opening to the right stakeholders for approval.',
  },
  {
    number: '04',
    title: 'Publish the opportunity',
    description: 'Make the approved role available to prospective candidates.',
  },
  {
    number: '05',
    title: 'Review applications',
    description: 'Screen candidates and identify the strongest matches.',
  },
  {
    number: '06',
    title: 'Interview and decide',
    description: 'Coordinate interviews, gather feedback, and make a decision.',
  },
  {
    number: '07',
    title: 'Offer and onboard',
    description: 'Prepare the offer and guide the selected candidate through onboarding.',
  },
];

export default function WorkflowOverviewScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <ThemedText style={[styles.eyebrow, { color: theme.primary }]}>
            RECRUITMENT LIFECYCLE
          </ThemedText>
          <ThemedText type="title">A clearer path to great hires</ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>
            See how each stage connects, from the first hiring request to a
            confident onboarding experience.
          </ThemedText>
        </View>

        <View style={styles.stageList}>
          {stages.map((stage, index) => (
            <View
              key={stage.number}
              style={[
                styles.stageCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.stageNumber,
                  { backgroundColor: theme.primaryMuted },
                ]}
              >
                <ThemedText style={[styles.stageNumberText, { color: theme.primary }]}>
                  {stage.number}
                </ThemedText>
              </View>
              <View style={styles.stageCopy}>
                <ThemedText style={styles.stageTitle}>{stage.title}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary }}>
                  {stage.description}
                </ThemedText>
              </View>
              {index < stages.length - 1 && (
                <ThemedText style={[styles.stageArrow, { color: theme.textSecondary }]}>
                  →
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  stageList: {
    gap: Spacing.two,
  },
  stageCard: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stageNumber: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stageCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  stageArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
});
