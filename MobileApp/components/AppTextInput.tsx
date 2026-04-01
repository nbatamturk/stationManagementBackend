import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputSubmitEditingEventData,
  type TextInputProps,
  type ViewStyle,
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
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
  rightAccessory?: React.ReactNode;
  wrapperStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
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
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  rightAccessory,
  wrapperStyle,
  inputContainerStyle,
}: AppTextInputProps): React.JSX.Element => {
  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.inputContainer,
          multiline && styles.multilineContainer,
          !editable && styles.disabledInput,
          error ? styles.errorBorder : null,
          inputContainerStyle,
        ]}
      >
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
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={[
            styles.input,
            multiline && styles.multiline,
            rightAccessory ? styles.inputWithAccessory : null,
          ]}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
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
  inputContainer: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  multilineContainer: {
    alignItems: 'flex-start',
    minHeight: 84,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  inputWithAccessory: {
    paddingRight: 8,
  },
  accessory: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
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
