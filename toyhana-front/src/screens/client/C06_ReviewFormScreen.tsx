import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { ErrorBanner } from '@/components/ErrorBanner';
import { StarRating } from '@/components/StarRating';

import { reviewsApi, ApiError } from '@/api';
import { spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ReviewForm'>;

export default function ReviewFormScreen({ route, navigation }: Props) {
  const styles = useStyles((c) => ({
  title: { fontSize: 22, fontWeight: '700', color: c.onSurface, marginTop: spacing.md },
  hallName: { fontSize: 15, color: c.muted, marginTop: 4, marginBottom: spacing.lg },
  label: {
    fontSize: 13, fontWeight: '600', color: c.muted,
    textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm,
  },
  input: { backgroundColor: c.surface, minHeight: 120 },
  submit: { marginTop: spacing.lg, paddingVertical: spacing.xs },
}));

  const { t } = useTranslation();
  const { bookingGuid, subjectName } = route.params;

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rating < 1) { setError(t('review_form.need_rating')); return; }
    setSubmitting(true);
    setError(null);
    try {
      await reviewsApi.create(bookingGuid, rating, text.trim() || undefined);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{t('review_form.title')}</Text>
      <Text style={styles.hallName}>{subjectName}</Text>

      <ErrorBanner message={error} />

      <Text style={styles.label}>{t('review_form.rating_label')}</Text>
      <StarRating value={rating} onChange={setRating} size={36} />

      <Text style={styles.label}>{t('review_form.text_label')}</Text>
      <TextInput
        mode="outlined"
        value={text}
        onChangeText={setText}
        placeholder={t('review_form.text_placeholder')}
        multiline
        numberOfLines={4}
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={submit}
        loading={submitting}
        disabled={submitting}
        style={styles.submit}
      >
        {t('review_form.submit')}
      </Button>
    </Screen>
  );
}
