export const parseSelectOptions = (optionsJson?: string | null): string[] => {
  if (!optionsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((option): option is string => typeof option === 'string');
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { options?: unknown }).options)) {
      return (parsed as { options: unknown[] }).options.filter(
        (option): option is string => typeof option === 'string',
      );
    }

    return [];
  } catch {
    return [];
  }
};

export const normalizeCustomFieldKey = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export const optionsJsonToEditorText = (optionsJson?: string | null): string => {
  const options = parseSelectOptions(optionsJson);
  return options.join('\n');
};

export const optionsEditorTextToJson = (editorText: string): string => {
  const options = editorText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  return JSON.stringify(options);
};
