import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { colors, radius } from '@/components/theme';

type AppTextInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  autoCorrect?: boolean;
  editable?: boolean;
};

export const AppTextInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  multiline,
  keyboardType,
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  autoCorrect = false,
  editable = true,
}: AppTextInputProps): React.JSX.Element => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        autoCorrect={autoCorrect}
        editable={editable}
        style={[
          styles.input,
          multiline && styles.multiline,
          !editable && styles.disabledInput,
          error ? styles.errorBorder : null,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  required: {
    color: colors.danger,
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  disabledInput: {
    opacity: 0.6,
  },
  errorBorder: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
});
