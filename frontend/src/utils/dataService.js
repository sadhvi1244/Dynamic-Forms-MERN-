export const loadData = async (selectedEntity, API_BASE_URL, schema) => {
  try {
    const config = schema?.record?.[selectedEntity];
    if (!config) return [];

    const response = await fetch(`${API_BASE_URL}${config.route}`);
    if (response.ok) {
      const result = await response.json();
      return result.data || [];
    } else {
      const stored = localStorage.getItem(`data_${selectedEntity}`);
      return stored ? JSON.parse(stored) : [];
    }
  } catch (error) {
    const stored = localStorage.getItem(`data_${selectedEntity}`);
    return stored ? JSON.parse(stored) : [];
  }
};

export const saveData = async (entity, data) => {
  localStorage.setItem(`data_${entity}`, JSON.stringify(data));
  return data;
};
